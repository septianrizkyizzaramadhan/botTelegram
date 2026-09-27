require("dotenv").config();
const { Bot, InlineKeyboard, InputFile } = require("grammy");
const fs = require("fs");
const path = require("path");

const game = require("./game");

const bot = new Bot(process.env.BOT_TOKEN_GAME);
const TOPIC_GAME_ID = Number(process.env.TOPIC_GAME);
const DB_FILE = path.join(__dirname, "balances.json");

// ================= HELPER =================
function progressBar(current, max, length = 10) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function formatNumber(n) {
  return Number(n).toLocaleString("id-ID");
}

function header(title) {
  const line = "─".repeat(title.length + 4);
  return `╭${line}╮\n│  ${title}  │\n╰${line}╯`;
}

function divider() {
  return "━━━━━━━━━━━━━━━━━━━━━━";
}

// ================= GLOBAL MARKET ENGINE (GBM) =================
let currentMarketPrice = 65000;
let marketHistory = [65000];
let candles = [];
let marketTrend = 0;
let marketVolatility = 0.008;
let fundingCounter = 0;

const SPREAD_PCT = 0.0005;
const FEE_PCT = 0.001;
const FUNDING_PCT = 0.0001;
const MARGIN_CALL_LEVEL = 20;

const tradeHistory = new Map();

function getAskPrice() { return currentMarketPrice * (1 + SPREAD_PCT); }
function getBidPrice() { return currentMarketPrice * (1 - SPREAD_PCT); }

function addTradeHistory(userId, trade) {
  if (!tradeHistory.has(userId)) tradeHistory.set(userId, []);
  const arr = tradeHistory.get(userId);
  arr.unshift(trade);
  if (arr.length > 10) arr.pop();
}

function initCandles() {
  let price = 65000;
  let now = Date.now() - 10 * 60 * 1000;
  candles = [];
  for (let i = 0; i < 10; i++) {
    const open = price;
    const high = open + Math.random() * 200;
    const low = open - Math.random() * 200;
    const close = low + Math.random() * (high - low);
    price = close;
    candles.push({
      x: new Date(now + i * 60000).toLocaleTimeString("id-ID", { minute: "2-digit", second: "2-digit" }),
      o: Math.round(open), h: Math.round(high), l: Math.round(low), c: Math.round(close)
    });
  }
  currentMarketPrice = price;
}
initCandles();

const activePositions = new Map();
const userTradingConfigs = new Map();
const userBetConfigs = new Map();

// ================= BALANCES =================
function loadBalances() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (err) { console.error("Error load balances:", err); }
  return {};
}

function saveBalances(data) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8"); }
  catch (err) { console.error("Error save balances:", err); }
}

let balances = loadBalances();

function getBalance(userId) {
  if (balances[userId] === undefined) {
    balances[userId] = 1000;
    saveBalances(balances);
  }
  return balances[userId];
}

// ================= CHART TEXT =================
function generateChartText(prices) {
  if (prices.length === 0) return "";
  const recent = prices.slice(-10);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;

  let chart = "<code>📈 BTC/USDT — LIVE MARKET\n";
  chart += "─────────────────────────────\n";
  recent.forEach((price, i) => {
    const bars = Math.round(((price - min) / range) * 12) + 1;
    const barStr = "█".repeat(bars);
    const arrow = i === 0 ? " " : (price > recent[i - 1] ? "↑" : "↓");
    chart += `$${price.toFixed(0).padStart(6)} ${arrow} ${barStr}\n`;
  });
  chart += "─────────────────────────────\n";
  chart += `High: $${max.toFixed(2)}\n`;
  chart += `Low:  $${min.toFixed(2)}</code>`;
  return chart;
}

// ================= PRICE ENGINE + POSITION + FUNDING =================
setInterval(async () => {
  if (Math.random() < 1 / 15) {
    marketTrend = (Math.random() - 0.5) * 0.002;
    marketVolatility = 0.004 + Math.random() * 0.01;
  }

  const changePercent = marketTrend + (Math.random() - 0.5) * 2 * marketVolatility;
  currentMarketPrice = Math.max(1, currentMarketPrice * (1 + changePercent));
  currentMarketPrice = Math.round(currentMarketPrice * 100) / 100;

  marketHistory.push(currentMarketPrice);
  if (marketHistory.length > 100) marketHistory.shift();

  let lastCandle = candles[candles.length - 1];
  lastCandle.c = currentMarketPrice;
  if (currentMarketPrice > lastCandle.h) lastCandle.h = currentMarketPrice;
  if (currentMarketPrice < lastCandle.l) lastCandle.l = currentMarketPrice;

  if (Math.random() < 0.2) {
    if (candles.length >= 20) candles.shift();
    const timeStr = new Date().toLocaleTimeString("id-ID", { minute: "2-digit", second: "2-digit" });
    candles.push({ x: timeStr, o: currentMarketPrice, h: currentMarketPrice, l: currentMarketPrice, c: currentMarketPrice });
  }

  // CHECK POSISI
  for (const [userId, pos] of activePositions.entries()) {
    let shouldClose = false;
    let closeReason = "";

    const exitPrice = pos.type === "LONG" ? getBidPrice() : getAskPrice();
    const priceChangeRatio = (exitPrice - pos.entryPrice) / pos.entryPrice;
    let pnlRatio = pos.type === "LONG" ? priceChangeRatio * pos.leverage : -priceChangeRatio * pos.leverage;
    let netProfit = pos.margin * pnlRatio;

    const equity = pos.margin + netProfit;
    const marginLevel = (equity / pos.margin) * 100;

    if (pos.tpPrice) {
      if ((pos.type === "LONG" && currentMarketPrice >= pos.tpPrice) ||
          (pos.type === "SHORT" && currentMarketPrice <= pos.tpPrice)) {
        shouldClose = true;
        closeReason = "🎯 TAKE PROFIT (TP) HIT!";
      }
    }

    if (pos.slPrice) {
      if ((pos.type === "LONG" && currentMarketPrice <= pos.slPrice) ||
          (pos.type === "SHORT" && currentMarketPrice >= pos.slPrice)) {
        shouldClose = true;
        closeReason = "🛑 STOP LOSS (SL) HIT!";
      }
    }

    if (marginLevel <= MARGIN_CALL_LEVEL) {
      shouldClose = true;
      closeReason = `💀 MARGIN CALL! (${marginLevel.toFixed(1)}%)`;
      netProfit = -pos.margin;
    }

    if (shouldClose) {
      activePositions.delete(userId);

      const feeClose = pos.margin * pos.leverage * FEE_PCT;
      netProfit -= feeClose;

      let totalReturn = pos.margin + netProfit;
      if (totalReturn < 0) totalReturn = 0;

      balances[userId] = (balances[userId] || 0) + totalReturn;
      saveBalances(balances);

      addTradeHistory(userId, {
        type: pos.type, entryPrice: pos.entryPrice, exitPrice: currentMarketPrice,
        margin: pos.margin, leverage: pos.leverage, pnl: netProfit,
        reason: closeReason, time: new Date().toISOString()
      });

      try {
        await bot.api.editMessageText(
          pos.chatId, pos.messageId,
          `🔄 <b>POSISI CLOSED: ${closeReason}</b>\n\n` +
          `• Posisi: <b>${pos.type}</b> (${pos.leverage}x)\n` +
          `• Margin: <b>$${pos.margin.toFixed(2)}</b>\n` +
          `• Entry: <b>$${pos.entryPrice.toFixed(2)}</b>\n` +
          `• Exit: <b>$${currentMarketPrice.toFixed(2)}</b>\n` +
          `• Fee: <b>-$${feeClose.toFixed(2)}</b>\n` +
          `• PnL: <b>${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(2)}</b>\n\n` +
          `Saldo: <b>$${balances[userId].toFixed(2)}</b>`,
          { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🏠 Menu Utama", "menu_game") }
        );
      } catch (err) { console.error("Auto-Close:", err.message); }
    }
  }

  // FUNDING RATE
  fundingCounter++;
  if (fundingCounter >= 30) {
    fundingCounter = 0;
    for (const [userId, pos] of activePositions.entries()) {
      const fundingFee = (pos.margin * pos.leverage) * FUNDING_PCT;
      pos.margin -= fundingFee;

      if (pos.margin <= 0) {
        activePositions.delete(userId);
        try {
          await bot.api.sendMessage(pos.chatId, `💀 <b>POSISI LIQUIDATED</b>\nFunding fee menghabiskan margin.`,
            { message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML" });
        } catch (e) {}
        continue;
      }

      try {
        await bot.api.sendMessage(pos.chatId,
          `💸 <b>Funding Fee</b> (${pos.type}): -$${fundingFee.toFixed(4)}`,
          { message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML" });
      } catch (e) {}
    }
  }
}, 2000);

// ================= QUICKCHART =================
async function getChartImageBuffer(candleData) {
  const recent = candleData.slice(-20);
  const formattedData = recent.map((c) => ({ x: c.x, o: c.o, h: c.h, l: c.l, c: c.c }));

  const chartConfig = {
    type: "candlestick",
    data: { datasets: [{ label: "BTC/USDT", data: formattedData }] },
    options: { legend: { display: false }, title: { display: true, text: "BTC/USDT — 1m (20 candles)" } }
  };

  const response = await fetch("https://quickchart.io/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      width: 700, height: 400, backgroundColor: "#0b1220", format: "png", chart: chartConfig
    })
  });

  if (!response.ok) throw new Error(`QuickChart error: ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

// ================= MAIN MENU =================
function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text("📈 Trading Arena", "menu_trading")
    .row()
    .text("🎰 Slot Machine", "info_slot")
    .text("🎲 Dadu Arena", "info_dadu")
    .row()
    .text("🎯 Darts Arena", "info_dart")
    .text("💵 Cek Saldo", "check_balance")
    .row()
    .text("⚔️ RPG Adventure", "rpg_menu");
}

function getMainMenuText(userId) {
  const rpg = game.profile.getProfile(userId);
  return (
    `🎮 <b>TELEGRAM MINI GAME & TRADING CENTER</b>\n\n` +
    `• BTC Market: <b>$${currentMarketPrice.toFixed(2)}</b>\n` +
    `• Saldo Anda: <b>$${getBalance(userId).toFixed(2)}</b>\n` +
    `• RPG Coin: <b>${formatNumber(rpg.coin)}</b> | Level: <b>${rpg.level}</b>\n\n` +
    `Pilih permainan di bawah:`
  );
}

async function sendAndPinMainMenu() {
  try {
    const msg = await bot.api.sendMessage(
      TOPIC_GAME_ID,
      `🎮 <b>TELEGRAM MINI GAME & TRADING CENTER</b>\n\nPilih permainan di bawah:`,
      { reply_markup: getMainMenuKeyboard(), message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML" }
    );
    await bot.api.pinChatMessage(TOPIC_GAME_ID, msg.message_id);
  } catch (err) { console.log("Auto-pin info:", err.message); }
}

// ================= BASIC HANDLERS =================
bot.command("game", async (ctx) => {
  await ctx.reply(getMainMenuText(ctx.from.id), {
    reply_markup: getMainMenuKeyboard(), message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML"
  });
});

bot.on("message:text", async (ctx, next) => {
  if (ctx.message.message_thread_id === TOPIC_GAME_ID) {
    if (ctx.message.text.startsWith("/")) return next();
    return ctx.reply(getMainMenuText(ctx.from.id), {
      reply_markup: getMainMenuKeyboard(), message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML"
    });
  }
  return next();
});

bot.callbackQuery("check_balance", async (ctx) => {
  await ctx.answerCallbackQuery({ text: `Saldo: $${getBalance(ctx.from.id).toFixed(2)}`, show_alert: true });
});

bot.callbackQuery("menu_game", async (ctx) => {
  try {
    await ctx.editMessageText(getMainMenuText(ctx.from.id), {
      reply_markup: getMainMenuKeyboard(), parse_mode: "HTML"
    });
  } catch (e) {}
  await ctx.answerCallbackQuery().catch(() => {});
});

bot.command(["mycash", "mc"], async (ctx) => {
  await ctx.reply(`💵 Saldo: <b>$${getBalance(ctx.from.id).toFixed(2)}</b>`, { parse_mode: "HTML" });
});

// ================= TRADING =================
bot.callbackQuery("menu_trading", async (ctx) => {
  const userId = ctx.from.id;
  if (activePositions.has(userId)) return renderActivePositionMenu(ctx);
  if (!userTradingConfigs.has(userId)) {
    userTradingConfigs.set(userId, { margin: 100, leverage: 10, slPct: 0.02, tpPct: 0.04 });
  }
  await renderTradingSetupMenu(ctx);
  await ctx.answerCallbackQuery().catch(() => {});
});

async function renderTradingSetupMenu(ctx) {
  const userId = ctx.from.id;
  const config = userTradingConfigs.get(userId);

  const priceSlPct = config.slPct / config.leverage;
  const priceTpPct = config.tpPct / config.leverage;
  const entryLong = getAskPrice();
  const entryShort = getBidPrice();
  const longTp = entryLong * (1 + priceTpPct);
  const longSl = entryLong * (1 - priceSlPct);
  const feeOpen = config.margin * config.leverage * FEE_PCT;

  const keyboard = new InlineKeyboard()
    .text(`💵 Margin: $${config.margin}`, "cycle_margin")
    .text(`⚡ Lev: ${config.leverage}x`, "cycle_leverage")
    .row()
    .text(`🎯 TP: +${config.tpPct * 100}%`, "toggle_tp")
    .text(`🛑 SL: -${config.slPct * 100}%`, "toggle_sl")
    .row()
    .text("📈 OPEN LONG", "open_LONG")
    .text("📉 OPEN SHORT", "open_SHORT")
    .row()
    .text("📜 History", "trade_history")
    .text("🏠 Menu Utama", "menu_game");

  const caption =
    `🕯️ <b>SPOT FUTURES TRADING</b>\n\n` +
    `• <b>Harga BTC:</b> $${currentMarketPrice.toFixed(2)}\n` +
    `• <b>Ask:</b> $${entryLong.toFixed(2)} | <b>Bid:</b> $${entryShort.toFixed(2)}\n` +
    `• <b>Spread:</b> 0.05%\n\n` +
    `• <b>Margin:</b> $${config.margin} | <b>Lev:</b> ${config.leverage}x\n` +
    `• <b>Size:</b> $${(config.margin * config.leverage).toFixed(2)}\n` +
    `• <b>Fee Open:</b> $${feeOpen.toFixed(2)}\n\n` +
    `• <b>TP (LONG):</b> $${longTp.toFixed(2)}\n` +
    `• <b>SL (LONG):</b> $${longSl.toFixed(2)}\n\n` +
    `<i>Funding 0.01%/menit • Margin call 20%</i>`;

  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    try {
      if (ctx.callbackQuery.message.photo) {
        await ctx.editMessageCaption({ caption, reply_markup: keyboard, parse_mode: "HTML" });
      } else {
        await ctx.editMessageText(caption, { reply_markup: keyboard, parse_mode: "HTML" });
      }
    } catch (e) {}
  } else {
    try {
      const imageBuffer = await getChartImageBuffer(candles);
      await ctx.replyWithPhoto(new InputFile(imageBuffer, "chart.png"), {
        caption, reply_markup: keyboard, message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML"
      });
    } catch (e) {
      await ctx.reply(caption, { reply_markup: keyboard, message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML" });
    }
  }
}

bot.callbackQuery("cycle_margin", async (ctx) => {
  const config = userTradingConfigs.get(ctx.from.id);
  const margins = [10, 25, 50, 100, 250, 500];
  config.margin = margins[(margins.indexOf(config.margin) + 1) % margins.length];
  await ctx.answerCallbackQuery({ text: `Margin → $${config.margin}` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery("cycle_leverage", async (ctx) => {
  const config = userTradingConfigs.get(ctx.from.id);
  const leverages = [1, 5, 10, 20, 50];
  config.leverage = leverages[(leverages.indexOf(config.leverage) + 1) % leverages.length];
  await ctx.answerCallbackQuery({ text: `Lev → ${config.leverage}x` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery("toggle_tp", async (ctx) => {
  const config = userTradingConfigs.get(ctx.from.id);
  config.tpPct = config.tpPct === 0.04 ? 0.08 : (config.tpPct === 0.08 ? 0.02 : 0.04);
  await ctx.answerCallbackQuery({ text: `TP: ${config.tpPct * 100}%` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery("toggle_sl", async (ctx) => {
  const config = userTradingConfigs.get(ctx.from.id);
  config.slPct = config.slPct === 0.02 ? 0.04 : (config.slPct === 0.04 ? 0.01 : 0.02);
  await ctx.answerCallbackQuery({ text: `SL: ${config.slPct * 100}%` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery(/^open_(LONG|SHORT)$/, async (ctx) => {
  const userId = ctx.from.id;
  const posType = ctx.match[1];

  if (activePositions.has(userId)) {
    return ctx.answerCallbackQuery({ text: "❗ Masih ada posisi aktif!", show_alert: true });
  }

  const config = userTradingConfigs.get(userId);
  const userCash = getBalance(userId);
  const feeOpen = config.margin * config.leverage * FEE_PCT;
  const totalCost = config.margin + feeOpen;

  if (userCash < totalCost) {
    return ctx.answerCallbackQuery({ text: `❗ Saldo kurang! Butuh $${totalCost.toFixed(2)}`, show_alert: true });
  }

  balances[userId] -= totalCost;
  saveBalances(balances);

  const entryPrice = posType === "LONG" ? getAskPrice() : getBidPrice();
  const priceSlPct = config.slPct / config.leverage;
  const priceTpPct = config.tpPct / config.leverage;
  const tpPrice = posType === "LONG" ? entryPrice * (1 + priceTpPct) : entryPrice * (1 - priceTpPct);
  const slPrice = posType === "LONG" ? entryPrice * (1 - priceSlPct) : entryPrice * (1 + priceSlPct);

  const msg = await ctx.reply("⏳ Membuka posisi...", { message_thread_id: TOPIC_GAME_ID });

  activePositions.set(userId, {
    type: posType, margin: config.margin, leverage: config.leverage,
    entryPrice, tpPrice, slPrice, chatId: ctx.chat.id, messageId: msg.message_id, openedAt: Date.now()
  });

  await ctx.answerCallbackQuery({ text: `✅ ${posType} dibuka!` });
  await renderActivePositionMenu(ctx, userId);
});

async function renderActivePositionMenu(ctx, directUserId = null) {
  const userId = directUserId || ctx.from.id;
  const pos = activePositions.get(userId);
  if (!pos) return;

  const exitPrice = pos.type === "LONG" ? getBidPrice() : getAskPrice();
  const priceChangeRatio = (exitPrice - pos.entryPrice) / pos.entryPrice;
  const pnlRatio = pos.type === "LONG" ? priceChangeRatio * pos.leverage : -priceChangeRatio * pos.leverage;
  const netProfit = pos.margin * pnlRatio;
  const equity = pos.margin + netProfit;
  const marginLevel = (equity / pos.margin) * 100;
  const marginBar = progressBar(Math.min(marginLevel, 100), 100);

  const text =
    `🚨 <b>POSISI TRADING AKTIF</b>\n\n` +
    `${generateChartText(marketHistory)}\n\n` +
    `• Posisi: <b>${pos.type}</b> (${pos.leverage}x)\n` +
    `• Margin: <b>$${pos.margin.toFixed(2)}</b>\n` +
    `• Entry: <b>$${pos.entryPrice.toFixed(2)}</b>\n` +
    `• Current: <b>$${currentMarketPrice.toFixed(2)}</b>\n` +
    `• TP: <b>$${pos.tpPrice.toFixed(2)}</b> | SL: <b>$${pos.slPrice.toFixed(2)}</b>\n\n` +
    `• PnL: <b>${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(2)}</b> (${(pnlRatio * 100).toFixed(2)}%)\n` +
    `• Margin: <code>${marginBar}</code> <b>${marginLevel.toFixed(1)}%</b>\n\n` +
    `<i>Spread 0.05% | Fee 0.1% | Funding 0.01%/menit</i>`;

  const keyboard = new InlineKeyboard()
    .text("🔄 Refresh", "refresh_active")
    .row()
    .text("🔴 CLOSE POSITION", "manual_close")
    .row()
    .text("🏠 Menu Utama", "menu_game");

  try {
    await bot.api.editMessageText(pos.chatId, pos.messageId, text, {
      reply_markup: keyboard, parse_mode: "HTML"
    });
  } catch (e) {}
}

bot.callbackQuery("refresh_active", async (ctx) => {
  await renderActivePositionMenu(ctx);
  await ctx.answerCallbackQuery({ text: "Refreshed!" }).catch(() => {});
});

bot.callbackQuery("manual_close", async (ctx) => {
  const userId = ctx.from.id;
  const pos = activePositions.get(userId);
  if (!pos) return ctx.answerCallbackQuery({ text: "Posisi tidak ditemukan!", show_alert: true });

  activePositions.delete(userId);

  const exitPrice = pos.type === "LONG" ? getBidPrice() : getAskPrice();
  const priceChangeRatio = (exitPrice - pos.entryPrice) / pos.entryPrice;
  const pnlRatio = pos.type === "LONG" ? priceChangeRatio * pos.leverage : -priceChangeRatio * pos.leverage;
  let netProfit = pos.margin * pnlRatio;
  const feeClose = pos.margin * pos.leverage * FEE_PCT;
  netProfit -= feeClose;

  let totalReturn = pos.margin + netProfit;
  if (totalReturn < 0) totalReturn = 0;

  balances[userId] = (balances[userId] || 0) + totalReturn;
  saveBalances(balances);

  addTradeHistory(userId, {
    type: pos.type, entryPrice: pos.entryPrice, exitPrice: currentMarketPrice,
    margin: pos.margin, leverage: pos.leverage, pnl: netProfit,
    reason: "Manual Close", time: new Date().toISOString()
  });

  await ctx.answerCallbackQuery({ text: "Posisi ditutup!" });

  const statusText = netProfit >= 0 ? "🟢 <b>CLOSE (PROFIT)!</b>" : "🔻 <b>CLOSE (RUGI)!</b>";

  try {
    await ctx.editMessageText(
      `${statusText}\n\n` +
      `• ${pos.type} ${pos.leverage}x\n` +
      `• Entry: <b>$${pos.entryPrice.toFixed(2)}</b>\n` +
      `• Exit: <b>$${currentMarketPrice.toFixed(2)}</b>\n` +
      `• Fee: <b>-$${feeClose.toFixed(2)}</b>\n` +
      `• PnL: <b>${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(2)}</b>\n\n` +
      `Saldo: <b>$${balances[userId].toFixed(2)}</b>`,
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🏠 Menu Utama", "menu_game") }
    );
  } catch (e) {}
});

// ================= TRADE HISTORY =================
bot.callbackQuery("trade_history", async (ctx) => {
  const userId = ctx.from.id;
  const history = tradeHistory.get(userId) || [];
  if (history.length === 0) return ctx.answerCallbackQuery({ text: "Belum ada history.", show_alert: true });

  let text = "<b>📜 TRADE HISTORY</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n";
  history.forEach((t) => {
    const emoji = t.pnl >= 0 ? "🟢" : "🔴";
    const sign = t.pnl >= 0 ? "+" : "";
    text += `${emoji} <b>${t.type}</b> ${t.leverage}x\n`;
    text += `   ${t.entryPrice.toFixed(2)} → ${t.exitPrice.toFixed(2)}\n`;
    text += `   PnL: <b>${sign}$${t.pnl.toFixed(2)}</b>\n`;
    text += `   <i>${t.reason}</i>\n\n`;
  });

  const kb = new InlineKeyboard().text("🔙 Balik", "menu_trading").text("🏠 Menu", "menu_game");
  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(text, { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" });
  }
  await ctx.answerCallbackQuery().catch(() => {});
});

bot.command("history", async (ctx) => {
  const history = tradeHistory.get(ctx.from.id) || [];
  if (history.length === 0) return ctx.reply("Belum ada trade history.");

  let text = "📜 <b>TRADE HISTORY</b>\n\n";
  history.forEach((t) => {
    const emoji = t.pnl >= 0 ? "🟢" : "🔴";
    const sign = t.pnl >= 0 ? "+" : "";
    text += `${emoji} <b>${t.type}</b> ${t.leverage}x | ${sign}$${t.pnl.toFixed(2)}\n`;
  });
  await ctx.reply(text, { parse_mode: "HTML" });
});

// ================= MINI GAMES HELPERS =================
const SLOT_SYMBOLS = [
  { id: "cherry", emoji: "🍒", payout: 5, name: "Cherry" },
  { id: "lemon", emoji: "🍋", payout: 8, name: "Lemon" },
  { id: "bell", emoji: "🔔", payout: 15, name: "Bell" },
  { id: "diamond", emoji: "💎", payout: 30, name: "Diamond" },
  { id: "star", emoji: "⭐", payout: 50, name: "Star" },
  { id: "seven", emoji: "7️⃣", payout: 100, name: "Seven" }
];

function spinSlot() {
  const result = [];
  for (let i = 0; i < 3; i++) {
    result.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
  }
  return result;
}

const DICE_EMOJI = ["", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

function getDiceStreak(userId) {
  if (!userBetConfigs.has(userId)) return 0;
  return userBetConfigs.get(userId).daduStreak || 0;
}

function setDiceStreak(userId, val) {
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  userBetConfigs.get(userId).daduStreak = val;
}

const DART_ZONES = [
  { key: "bullseye", label: "🎯 BULLSEYE!", multiplier: 5, chance: 0.15 },
  { key: "inner", label: "🎯 Inner Ring", multiplier: 2.5, chance: 0.30 },
  { key: "outer", label: "🎯 Outer Ring", multiplier: 1.5, chance: 0.35 },
  { key: "miss", label: "❌ Meleset", multiplier: 0, chance: 0.20 }
];

function rollDart() {
  const rand = Math.random();
  let cum = 0;
  for (const zone of DART_ZONES) {
    cum += zone.chance;
    if (rand <= cum) return zone;
  }
  return DART_ZONES[3];
}

function makeBetKeyboard(gameType, currentBet) {
  return new InlineKeyboard()
    .text("$5", `setbet_${gameType}_5`)
    .text("$10", `setbet_${gameType}_10`)
    .text("$25", `setbet_${gameType}_25`)
    .row()
    .text("$50", `setbet_${gameType}_50`)
    .text("$100", `setbet_${gameType}_100`)
    .text("🔥 All-In", `setbet_${gameType}_allin`)
    .row()
    .text(`🎮 MAIN ($${currentBet})`, `start_${gameType}`)
    .row()
    .text("🏠 Kembali", "menu_game");
}

// ================= SLOT =================
bot.callbackQuery("info_slot", async (ctx) => {
  const userId = ctx.from.id;
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const bet = userBetConfigs.get(userId).slot;

  await ctx.editMessageText(
    `🎰 <b>SLOT MACHINE DELUXE</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>Simbol (3 sama):</b>\n` +
    `🍒 5x · 🍋 8x · 🔔 15x\n` +
    `💎 30x · ⭐ 50x · 7️⃣ 100x\n\n` +
    `<b>2 simbol sama:</b> refund 1.5x\n\n` +
    `Saldo: <b>$${getBalance(userId).toFixed(2)}</b>\n` +
    `Taruhan: <b>$${bet}</b>`,
    { reply_markup: makeBetKeyboard("slot", bet), parse_mode: "HTML" }
  );
});

bot.callbackQuery("start_slot", async (ctx) => {
  const userId = ctx.from.id;
  const config = userBetConfigs.get(userId) || { slot: 20 };
  const BET = config.slot;

  if (BET <= 0 || getBalance(userId) < BET) {
    return ctx.answerCallbackQuery({ text: `❗ Saldo kurang! Butuh $${BET}`, show_alert: true });
  }

  balances[userId] -= BET;
  saveBalances(balances);
  await ctx.answerCallbackQuery({ text: "Memutar..." });

  const spinMsg = await ctx.reply(`🎰 <b>SPINNING...</b>\n\n❓ | ❓ | ❓`, { message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML" });

  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 500));
    const temp = spinSlot();
    try {
      await ctx.api.editMessageText(spinMsg.chat.id, spinMsg.message_id,
        `🎰 <b>SPINNING...</b>\n\n${temp[0].emoji} | ${temp[1].emoji} | ${temp[2].emoji}`,
        { parse_mode: "HTML" });
    } catch (e) {}
  }

  await new Promise(r => setTimeout(r, 500));

  const result = spinSlot();
  const [a, b, c] = result;
  let reward = 0;
  let statusText = "";
  let bonusText = "";

  if (a.id === b.id && b.id === c.id) {
    reward = BET * a.payout;
    statusText = `🎉 <b>JACKPOT ${a.name.toUpperCase()}!</b>`;
    bonusText = `3x ${a.emoji} → ${a.payout}x`;
  } else if (a.id === b.id || b.id === c.id || a.id === c.id) {
    reward = Math.round(BET * 1.5);
    statusText = `✨ <b>HAMPIR MENANG!</b>`;
    bonusText = `2 simbol sama → refund 1.5x`;
  } else {
    statusText = `❌ <b>ZONK!</b>`;
    bonusText = `Coba lagi!`;
  }

  balances[userId] += reward;
  saveBalances(balances);

  const netPnl = reward - BET;
  const pnlText = netPnl >= 0 ? `+$${netPnl.toFixed(2)}` : `-$${Math.abs(netPnl).toFixed(2)}`;

  try {
    await ctx.api.editMessageText(spinMsg.chat.id, spinMsg.message_id,
      `🎰 <b>SLOT MACHINE</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `╭─────────────────╮\n` +
      `│  ${a.emoji}  │  ${b.emoji}  │  ${c.emoji}  │\n` +
      `╰─────────────────╯\n\n` +
      `${statusText}\n${bonusText}\n\n` +
      `💰 Taruhan: <b>$${BET}</b>\n` +
      `💵 Menang: <b>$${reward}</b>\n` +
      `📊 PnL: <b>${pnlText}</b>\n\n` +
      `Saldo: <b>$${balances[userId].toFixed(2)}</b>`,
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🎰 Spin Lagi", "start_slot").text("🏠 Menu", "menu_game") });
  } catch (e) {}
});

// ================= DADU =================
bot.callbackQuery("info_dadu", async (ctx) => {
  const userId = ctx.from.id;
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const bet = userBetConfigs.get(userId).dadu;
  const streak = getDiceStreak(userId);

  await ctx.editMessageText(
    `🎲 <b>DADU ARENA</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>Aturan:</b>\n` +
    `• Pilih angka 1-6\n` +
    `• Tebak tepat: <b>5x</b>\n` +
    `• Tebak ±1: <b>2x</b>\n` +
    `• Salah: hangus\n\n` +
    `<b>🔥 Streak Bonus:</b>\n` +
    `• 3x menang: +20%\n` +
    `• 5x menang: +50%\n\n` +
    `Saldo: <b>$${getBalance(userId).toFixed(2)}</b>\n` +
    `Streak: <b>${streak}x</b>`,
    { reply_markup: makeBetKeyboard("dadu", bet), parse_mode: "HTML" }
  );
});

bot.callbackQuery(/^dadu_pick_([1-6])$/, async (ctx) => {
  const userId = ctx.from.id;
  const pick = parseInt(ctx.match[1]);
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  userBetConfigs.get(userId).daduPick = pick;
  await ctx.answerCallbackQuery({ text: `Pilih angka ${pick}` });
});

bot.callbackQuery("start_dadu", async (ctx) => {
  const userId = ctx.from.id;
  const config = userBetConfigs.get(userId) || { dadu: 10 };
  const BET = config.dadu;

  if (BET <= 0 || getBalance(userId) < BET) {
    return ctx.answerCallbackQuery({ text: `❗ Saldo kurang! Butuh $${BET}`, show_alert: true });
  }

  if (!config.daduPick) {
    const kb = new InlineKeyboard();
    for (let i = 1; i <= 6; i++) {
      kb.text(`${DICE_EMOJI[i]} ${i}`, `dadu_pick_${i}`);
      if (i % 3 === 0) kb.row();
    }
    kb.row().text("🏠 Kembali", "menu_game");

    try {
      return await ctx.editMessageText(
        `🎲 <b>DADU ARENA</b>\n\nPilih angka taruhanmu (1-6):\n\n💰 Taruhan: <b>$${BET}</b>`,
        { reply_markup: kb, parse_mode: "HTML" }
      );
    } catch (e) {
      return await ctx.reply(
        `🎲 <b>DADU ARENA</b>\n\nPilih angka taruhanmu (1-6):\n\n💰 Taruhan: <b>$${BET}</b>`,
        { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" }
      );
    }
  }

  balances[userId] -= BET;
  saveBalances(balances);
  await ctx.answerCallbackQuery({ text: "Mengocok dadu..." });

  const pick = config.daduPick;
  const diceMsg = await ctx.reply(
    `🎲 <b>MENGGOCOK DADU...</b>\n\nTebakanmu: ${DICE_EMOJI[pick]} <b>${pick}</b>\n\n❓`,
    { message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML" }
  );

  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 400));
    const temp = Math.floor(Math.random() * 6) + 1;
    try {
      await ctx.api.editMessageText(diceMsg.chat.id, diceMsg.message_id,
        `🎲 <b>MENGGOCOK DADU...</b>\n\nTebakanmu: ${DICE_EMOJI[pick]} <b>${pick}</b>\n\n${DICE_EMOJI[temp]} ${temp}`,
        { parse_mode: "HTML" });
    } catch (e) {}
  }

  await new Promise(r => setTimeout(r, 500));

  const result = Math.floor(Math.random() * 6) + 1;
  let reward = 0;
  let statusText = "";
  let multiplier = 0;

  if (result === pick) {
    multiplier = 5;
    statusText = `🎯 <b>TEPAT SASARAN!</b>`;
  } else if (Math.abs(result - pick) === 1) {
    multiplier = 2;
    statusText = `✨ <b>DEKAT!</b>`;
  } else {
    statusText = `❌ <b>MELESET!</b>`;
  }

  reward = BET * multiplier;

  let streak = getDiceStreak(userId);
  let bonusText = "";
  if (reward > 0) {
    streak++;
    setDiceStreak(userId, streak);
    if (streak >= 5) {
      const bonus = Math.round(reward * 0.5);
      reward += bonus;
      bonusText = `🔥 <b>STREAK 5x! +50% (+$${bonus})</b>`;
    } else if (streak >= 3) {
      const bonus = Math.round(reward * 0.2);
      reward += bonus;
      bonusText = `🔥 <b>STREAK 3x! +20% (+$${bonus})</b>`;
    }
  } else {
    setDiceStreak(userId, 0);
    streak = 0;
  }

  balances[userId] += reward;
  saveBalances(balances);

  const netPnl = reward - BET;
  const pnlText = netPnl >= 0 ? `+$${netPnl.toFixed(2)}` : `-$${Math.abs(netPnl).toFixed(2)}`;

  try {
    await ctx.api.editMessageText(diceMsg.chat.id, diceMsg.message_id,
      `🎲 <b>DADU ARENA</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `╭───────────────────╮\n` +
      `│  Hasil: ${DICE_EMOJI[result]} <b>${result}</b>\n` +
      `│  Tebak: ${DICE_EMOJI[pick]} <b>${pick}</b>\n` +
      `╰───────────────────╯\n\n` +
      `${statusText}\n` +
      (multiplier > 0 ? `Multiplier: <b>${multiplier}x</b>\n` : "") +
      (bonusText ? `${bonusText}\n` : "") +
      `\n💰 Taruhan: <b>$${BET}</b>\n` +
      `💵 Menang: <b>$${reward}</b>\n` +
      `📊 PnL: <b>${pnlText}</b>\n` +
      `🔥 Streak: <b>${streak}x</b>\n\n` +
      `Saldo: <b>$${balances[userId].toFixed(2)}</b>`,
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🎲 Main Lagi", "dadu_reset").text("🏠 Menu", "menu_game") });
  } catch (e) {}
});

bot.callbackQuery("dadu_reset", async (ctx) => {
  const userId = ctx.from.id;
  if (userBetConfigs.has(userId)) delete userBetConfigs.get(userId).daduPick;

  const BET = userBetConfigs.get(userId)?.dadu || 10;
  const kb = new InlineKeyboard();
  for (let i = 1; i <= 6; i++) {
    kb.text(`${DICE_EMOJI[i]} ${i}`, `dadu_pick_${i}`);
    if (i % 3 === 0) kb.row();
  }
  kb.row().text("🏠 Kembali", "menu_game");

  try {
    await ctx.editMessageText(
      `🎲 <b>DADU ARENA</b>\n\nPilih angka taruhanmu (1-6):\n\n💰 Taruhan: <b>$${BET}</b>`,
      { reply_markup: kb, parse_mode: "HTML" }
    );
  } catch (e) {
    await ctx.reply(
      `🎲 <b>DADU ARENA</b>\n\nPilih angka taruhanmu (1-6):\n\n💰 Taruhan: <b>$${BET}</b>`,
      { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" }
    );
  }
  await ctx.answerCallbackQuery().catch(() => {});
});

// ================= DARTS =================
bot.callbackQuery("info_dart", async (ctx) => {
  const userId = ctx.from.id;
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const bet = userBetConfigs.get(userId).dart;

  await ctx.editMessageText(
    `🎯 <b>DARTS ARENA</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>Target & Hadiah:</b>\n` +
    `🎯 Bullseye — <b>5x</b> (15% chance)\n` +
    `🎯 Inner Ring — <b>2.5x</b> (30%)\n` +
    `🎯 Outer Ring — <b>1.5x</b> (35%)\n` +
    `❌ Meleset — <b>hangus</b> (20%)\n\n` +
    `Saldo: <b>$${getBalance(userId).toFixed(2)}</b>\n` +
    `Taruhan: <b>$${bet}</b>`,
    { reply_markup: makeBetKeyboard("dart", bet), parse_mode: "HTML" }
  );
});

bot.callbackQuery("start_dart", async (ctx) => {
  const userId = ctx.from.id;
  const config = userBetConfigs.get(userId) || { dart: 15 };
  const BET = config.dart;

  if (BET <= 0 || getBalance(userId) < BET) {
    return ctx.answerCallbackQuery({ text: `❗ Saldo kurang! Butuh $${BET}`, show_alert: true });
  }

  balances[userId] -= BET;
  saveBalances(balances);
  await ctx.answerCallbackQuery({ text: "Melempar..." });

  const dartMsg = await ctx.reply(`🎯 <b>MELEMPAR...</b>\n\n❓`, { message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML" });

  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 400));
    const temp = ["🎯", "💨", "🎯", "❌"][Math.floor(Math.random() * 4)];
    try {
      await ctx.api.editMessageText(dartMsg.chat.id, dartMsg.message_id,
        `🎯 <b>MELEMPAR...</b>\n\n${temp}`,
        { parse_mode: "HTML" });
    } catch (e) {}
  }

  await new Promise(r => setTimeout(r, 500));

  const result = rollDart();
  const reward = Math.round(BET * result.multiplier);
  balances[userId] += reward;
  saveBalances(balances);

  const netPnl = reward - BET;
  const pnlText = netPnl >= 0 ? `+$${netPnl.toFixed(2)}` : `-$${Math.abs(netPnl).toFixed(2)}`;

  const statusText = result.multiplier > 0 ? `✅ <b>${result.label}</b>` : `❌ <b>${result.label}</b>`;
  const multiText = result.multiplier > 0 ? `Multiplier: <b>${result.multiplier}x</b>` : `Coba lagi!`;

  try {
    await ctx.api.editMessageText(dartMsg.chat.id, dartMsg.message_id,
      `🎯 <b>DARTS ARENA</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `╭───────────────────╮\n` +
      `│  ${result.key === "bullseye" ? "🎯🎯🎯" : result.key === "inner" ? "🎯🎯" : result.key === "outer" ? "🎯" : "❌"}  ${result.label}\n` +
      `╰───────────────────╯\n\n` +
      `${statusText}\n${multiText}\n\n` +
      `💰 Taruhan: <b>$${BET}</b>\n` +
      `💵 Menang: <b>$${reward}</b>\n` +
      `📊 PnL: <b>${pnlText}</b>\n\n` +
      `Saldo: <b>$${balances[userId].toFixed(2)}</b>`,
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🎯 Lempar Lagi", "start_dart").text("🏠 Menu", "menu_game") });
  } catch (e) {}
});

// ================= BET SETTER =================
bot.callbackQuery(/^setbet_(slot|dadu|dart)_(5|10|25|50|100|allin)$/, async (ctx) => {
  const userId = ctx.from.id;
  const gameType = ctx.match[1];
  const valStr = ctx.match[2];

  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const config = userBetConfigs.get(userId);

  if (valStr === "allin") config[gameType] = Math.floor(getBalance(userId));
  else config[gameType] = parseInt(valStr);

  await ctx.answerCallbackQuery({ text: `Bet ${gameType} → $${config[gameType]}` });

  const kb = makeBetKeyboard(gameType, config[gameType]);
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: kb });
  } catch (e) {}
});

// ================= RPG ADVENTURE =================
bot.callbackQuery("rpg_menu", async (ctx) => {
  const userId = ctx.from.id;
  const p = game.profile.getProfile(userId);
  const status = game.grinding.getGrindingStatus(userId);

  const requiredXP = p.level * 100;
  const xpBar = progressBar(p.xp, requiredXP);
  const xpPercent = Math.round((p.xp / requiredXP) * 100);

  let statusLine = "";
  if (status.bossAvailable) {
    statusLine = `👑 <b>BOSS READY!</b>\n   ${status.boss.name}\n   ⚡ Cost: <b>${status.boss.energyCost}</b>`;
  } else if (status.cooldownRemaining > 0) {
    statusLine = `⏳ Cooldown: <b>${Math.ceil(status.cooldownRemaining / 1000)}s</b>`;
  } else {
    statusLine = `✅ <b>Siap Grind!</b>`;
  }

  const text =
    `${header("⚔️  RPG ADVENTURE  ⚔️")}\n\n` +
    `👤 Level <b>${p.level}</b> · ✨ <b>${p.xp}/${requiredXP} XP</b>\n` +
    `✨ <code>${xpBar}</code> <b>${xpPercent}%</b>\n\n` +
    `💰 Coin <b>${formatNumber(p.coin)}</b>   ⚡ Energy <b>${p.energy}/${p.maxEnergy}</b>\n` +
    `🗡️ ATK <b>${p.stats.attack}</b>   🛡️ DEF <b>${p.stats.defense}</b>\n\n` +
    `${divider()}\n${statusLine}\n${divider()}\n\n` +
    `<i>Mata uang RPG (Coin) terpisah dari Trading ($)</i>`;

  const kb = new InlineKeyboard()
    .text(status.bossAvailable ? "👑 LAWAN BOSS" : "⚔️ Grind Monster", "rpg_grind")
    .text("📜 Daily Quest", "rpg_quest")
    .row()
    .text("🛒 Shop", "rpg_shop")
    .text("🎒 Inventory", "rpg_inv")
    .row()
    .text("🔄 Refresh", "rpg_menu")
    .text("🏠 Menu Utama", "menu_game");

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(text, { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" });
  }
  await ctx.answerCallbackQuery().catch(() => {});
});

bot.callbackQuery("rpg_grind", async (ctx) => {
  const userId = ctx.from.id;
  const result = game.grinding.grind(userId);

  if (!result.success) {
    if (result.type === "cooldown") {
      return ctx.answerCallbackQuery({
        text: `⏳ Tunggu ${Math.ceil(result.remaining / 1000)}s!`,
        show_alert: true
      });
    }
    if (result.type === "energy") {
      return ctx.answerCallbackQuery({ text: `⚡ ${result.message}`, show_alert: true });
    }
  }

  // Rarity emoji
  const rarityEmoji = result.rarity?.emoji || "⚪";
  const rarityLabel = result.rarity?.label || "Common";

  await ctx.answerCallbackQuery({
    text: result.isBoss ? `👑 BOSS FIGHT!` : `Kill ${result.monster.name}!`
  });

  // Header dengan rarity
  let headerText;
  if (result.isBoss) {
    headerText = `👑  BOSS DIKALAHKAN!  👑`;
  } else if (result.monster.rarity === "mythic") {
    headerText = `🔴💀 MYTHIC ENCOUNTER! 💀🔴`;
  } else if (result.monster.rarity === "legendary") {
    headerText = `🟠⭐ LEGENDARY SPAWN! ⭐🟠`;
  } else if (result.monster.rarity === "epic") {
    headerText = `🟣 EPIC ENCOUNTER! 🟣`;
  } else {
    headerText = `⚔️  ${result.monster.name.toUpperCase()} DIKALAHKAN!`;
  }

  let text = `<b>${headerText}</b>\n`;
  text += `${rarityEmoji} <b>${rarityLabel}</b> · ${result.monster.name}\n\n`;

  // Reward box
  text += `╭─────────────────────────╮\n`;
  text += `│  ✨  XP    <b>+${result.xp}</b>${result.isCrit ? " 💥" : ""}\n`;
  text += `│  💰  Coin  <b>+${result.coin}</b>${result.isCrit ? " 💥" : ""}\n`;
  if (result.droppedItem) {
    text += `│  🎁  Drop  <b>${result.droppedItem}</b>\n`;
  }
  text += `╰─────────────────────────╯\n`;

  if (result.isCrit) {
    text += `\n💥 <b>CRITICAL HIT! (2x reward)</b>\n`;
  }
  if (result.levelUps > 0) {
    text += `\n🎉 <b>LEVEL UP! (+${result.levelUps})</b>\n`;
  }

  const requiredXP = result.profile.level * 100;
  const xpBar = progressBar(result.profile.xp, requiredXP);

  text += `\n⚡ Energy <b>${result.profile.energy}/${result.profile.maxEnergy}</b>\n`;
  text += `💰 Coin <b>${formatNumber(result.profile.coin)}</b>\n`;
  text += `📜 Quest <b>${result.quest.kills}</b>\n`;
  text += `✨ <code>${xpBar}</code> <b>${result.profile.xp}/${requiredXP}</b>`;

  await ctx.reply(text, {
    message_thread_id: TOPIC_GAME_ID,
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard()
      .text("⚔️ Grind Lagi", "rpg_grind")
      .text("🏠 RPG Menu", "rpg_menu")
  });
});


bot.callbackQuery("rpg_quest", async (ctx) => {
  const q = game.quest.getQuest(ctx.from.id);
  let text = `${header("📜  DAILY QUEST  📜")}\n\nKills hari ini: <b>${q.kills}</b>\n\n`;
  q.milestones.forEach((m) => {
    const icon = m.claimed ? "✅" : (m.reached ? "🎁" : "⏳");
    text += `${icon} <b>${m.kills} kill</b> → ${formatNumber(m.coin)}c + ${m.xp} XP\n`;
  });
  if (q.allDone) text += `\n🎉 <b>Semua quest selesai!</b>`;

  const kb = new InlineKeyboard();
  q.milestones.forEach((m, i) => {
    if (m.reached && !m.claimed) kb.text(`🎁 Claim ${m.kills} kill`, `rpg_claim_${i}`).row();
  });
  kb.text("🏠 RPG Menu", "rpg_menu");

  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(text, { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" });
  }
  await ctx.answerCallbackQuery().catch(() => {});
});

bot.callbackQuery(/^rpg_claim_(\d+)$/, async (ctx) => {
  const idx = parseInt(ctx.match[1]);
  const res = game.quest.claimQuestReward(ctx.from.id, idx);
  if (!res.success) return ctx.answerCallbackQuery({ text: res.message, show_alert: true });

  await ctx.answerCallbackQuery({ text: "Reward diterima!" });

  let text = `🎁 <b>QUEST REWARD!</b>\n\n`;
  text += `╭──────────────────────╮\n`;
  text += `│  💰 Coin  <b>+${formatNumber(res.coin)}</b>\n`;
  text += `│  ✨ XP    <b>+${res.xp}</b>\n`;
  text += `╰──────────────────────╯\n`;
  if (res.levelUps > 0) text += `\n🎉 <b>LEVEL UP! (+${res.levelUps})</b>`;

  await ctx.reply(text, {
    message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("🏠 RPG Menu", "rpg_menu")
  });
});

// ================= RPG SHOP HELPERS =================
function tierLabel(tier) {
  const map = { common: "⚪ Common", rare: "🔵 Rare", epic: "🟣 Epic", legendary: "🟠 Legendary", mythic: "🔴 Mythic" };
  return map[tier] || "⚪ Common";
}

function itemStatInfo(item) {
  if (item.type === "weapon") return `⚔️ +${item.attack} ATK`;
  if (item.type === "armor") return `🛡️ +${item.defense} DEF`;
  if (item.heal) return `❤️ +${item.heal} Energy`;
  if (item.xp) return `✨ +${item.xp} XP`;
  if (item.slots) return `🎒 +${item.slots} Slots`;
  return "";
}

// ================= SHOP MENU =================
bot.callbackQuery("rpg_shop", async (ctx) => {
  try {
    const p = game.profile.getProfile(ctx.from.id);

    const text =
      `<b>🛒 RPG SHOP 🛒</b>\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 Coin: <b>${formatNumber(p.coin)}</b>\n` +
      `⚔️ ATK: <b>${p.stats.attack}</b>  |  🛡️ DEF: <b>${p.stats.defense}</b>\n` +
      `🗡️ Weapon: <b>${p.equipment.weapon || "-"}</b>\n` +
      `🛡️ Armor: <b>${p.equipment.armor || "-"}</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Pilih kategori:`;

    const kb = new InlineKeyboard()
      .text("⚔️ Weapons", "rpg_shop_weapon")
      .text("🛡️ Armors", "rpg_shop_armor")
      .row()
      .text("🧪 Consumables", "rpg_shop_consumable")
      .text("🎒 Bag Upgrades", "rpg_shop_bag")
      .row()
      .text("🏠 RPG Menu", "rpg_menu");

    try {
      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
    } catch (e) {
      await ctx.reply(text, { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" });
    }
    await ctx.answerCallbackQuery().catch(() => {});
  } catch (err) {
    console.error("RPG Shop Error:", err);
    await ctx.answerCallbackQuery({ text: `Error: ${err.message}`, show_alert: true }).catch(() => {});
  }
});

bot.callbackQuery(/^rpg_shop_(weapon|armor|consumable|bag)$/, async (ctx) => {
  try {
    const category = ctx.match[1];
    const items = game.shop.getShopItemsByType();
    const list = items[category] || [];
    const p = game.profile.getProfile(ctx.from.id);

    const titles = { weapon: "⚔️ WEAPONS", armor: "🛡️ ARMORS", consumable: "🧪 CONSUMABLES", bag: "🎒 BAG UPGRADES" };

    let text = `<b>${titles[category]}</b>\n━━━━━━━━━━━━━━━━━━━━━━\n💰 Coin: <b>${formatNumber(p.coin)}</b>\n\n`;
    list.sort((a, b) => a.price - b.price);

    const kb = new InlineKeyboard();

    for (const item of list) {
      const owned =
        (item.type === "weapon" && p.equipment.weapon === item.id) ||
        (item.type === "armor" && p.equipment.armor === item.id);
      const canAfford = p.coin >= item.price;

      text += `${tierLabel(item.tier)} <b>${item.name}</b>\n`;
      text += `   ${itemStatInfo(item)} — 💰 <b>${formatNumber(item.price)}</b>\n`;
      text += `   <i>${item.desc}</i>\n`;
      if (owned) text += `   ✅ <b>Sudah dimiliki</b>\n`;
      else if (!canAfford) text += `   ❌ <i>Coin kurang</i>\n`;
      text += `\n`;

      let label, cb;
      if (owned) { label = `✅ ${item.name}`; cb = "shop_noop"; }
      else { label = `${item.name} (${formatNumber(item.price)})`; cb = `rpg_buy_${item.id}`; }
      kb.text(label, cb).row();
    }

    kb.text("🔙 Balik", "rpg_shop").text("🏠 RPG Menu", "rpg_menu");

    try {
      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
    } catch (e) {
      await ctx.reply(text, { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" });
    }
    await ctx.answerCallbackQuery().catch(() => {});
  } catch (err) {
    console.error("RPG Shop Category Error:", err);
    await ctx.answerCallbackQuery({ text: `Error: ${err.message}`, show_alert: true }).catch(() => {});
  }
});

bot.callbackQuery("shop_noop", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "❌ Kamu sudah punya item ini!", show_alert: true });
});

bot.callbackQuery(/^rpg_buy_(.+)$/, async (ctx) => {
  try {
    const itemId = ctx.match[1];
    const res = game.shop.buyItem(ctx.from.id, itemId);
    if (!res.success) return ctx.answerCallbackQuery({ text: `❌ ${res.message}`, show_alert: true });

    await ctx.answerCallbackQuery({ text: `✅ Beli ${res.item.name}!` });
    const p = game.profile.getProfile(ctx.from.id);

    let text = `<b>✅ PEMBELIAN BERHASIL!</b>\n\n`;
    text += `📦 <b>${res.item.name}</b>\n`;
    text += `🏷️ ${tierLabel(res.item.tier)}\n`;
    text += `💰 Harga: <b>${formatNumber(res.item.price)}</b>\n`;
    text += `💵 Sisa Coin: <b>${formatNumber(p.coin)}</b>\n`;

    if (res.item.type === "weapon") text += `\n⚔️ ATK: <b>${p.stats.attack}</b>`;
    else if (res.item.type === "armor") text += `\n🛡️ DEF: <b>${p.stats.defense}</b>`;
    else if (res.item.type === "bag") text += `\n🎒 Bag Slots: <b>${p.bagSlots}</b>`;
    else if (res.item.type === "consumable") text += `\n🎒 Cek <b>Inventory</b> untuk pakai.`;

    await ctx.reply(text, {
      message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("🛒 Balik", "rpg_shop").text("🏠 RPG Menu", "rpg_menu")
    });
  } catch (err) { console.error("RPG Buy Error:", err); }
});

// ================= INVENTORY =================
bot.callbackQuery("rpg_inv", async (ctx) => {
  try {
    const inv = game.inventory.getInventory(ctx.from.id);
    const p = game.profile.getProfile(ctx.from.id);
    const items = game.shop.getShopItems();

    let text = `<b>🎒 INVENTORY 🎒</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const entries = Object.entries(inv.inventory).filter(([_, n]) => n > 0);

    if (entries.length === 0) text += `<i>Inventory kosong...</i>\n`;
    else {
      text += `<b>📦 Items:</b>\n`;
      entries.forEach(([id, n]) => {
        const item = items[id];
        text += `• ${item ? item.name : id} x <b>${n}</b>\n`;
      });
    }

    text += `\n<b>⚙️ Equipment:</b>\n`;
    text += `🗡️ Weapon: <b>${items[inv.equipment.weapon]?.name || inv.equipment.weapon || "-"}</b>\n`;
    text += `🛡️ Armor:  <b>${items[inv.equipment.armor]?.name || inv.equipment.armor || "-"}</b>\n`;

    const used = entries.reduce((a, [, n]) => a + n, 0);
    const bagBar = progressBar(used, inv.bagSlots);

    text += `\n🎒 Bag <code>${bagBar}</code> <b>${used}/${inv.bagSlots}</b>\n`;
    text += `\n💰 Coin: <b>${formatNumber(p.coin)}</b>`;

    const kb = new InlineKeyboard();
    const consumables = entries.filter(([id]) => items[id] && items[id].type === "consumable");
    if (consumables.length > 0) {
      consumables.forEach(([id]) => {
        kb.text(`🧪 Pakai ${items[id].name}`, `rpg_use_${id}`).row();
      });
    }
    kb.text("🏠 RPG Menu", "rpg_menu");

    try {
      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
    } catch (e) {
      await ctx.reply(text, { message_thread_id: TOPIC_GAME_ID, reply_markup: kb, parse_mode: "HTML" });
    }
    await ctx.answerCallbackQuery().catch(() => {});
  } catch (err) {
    console.error("RPG Inventory Error:", err);
    await ctx.answerCallbackQuery({ text: `Error: ${err.message}`, show_alert: true }).catch(() => {});
  }
});

bot.callbackQuery(/^rpg_use_(.+)$/, async (ctx) => {
  try {
    const itemId = ctx.match[1];
    const res = game.shop.useItem(ctx.from.id, itemId);
    if (!res.success) return ctx.answerCallbackQuery({ text: `❌ ${res.message}`, show_alert: true });

    const p = game.profile.getProfile(ctx.from.id);
    await ctx.answerCallbackQuery({ text: `✅ Item dipakai!` });

    let text = `<b>✅ ITEM DIGUNAKAN!</b>\n\n`;
    text += `⚡ Energy: <b>${p.energy}/${p.maxEnergy}</b>\n`;
    text += `✨ XP: <b>${p.xp}/${p.level * 100}</b>`;

    await ctx.reply(text, {
      message_thread_id: TOPIC_GAME_ID, parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("🎒 Inventory", "rpg_inv").text("🏠 RPG Menu", "rpg_menu")
    });
  } catch (err) { console.error("RPG Use Item Error:", err); }
});



// ================= ERROR HANDLER =================
bot.catch((err) => {
  console.error("Grammy Error:", err.error);
});

console.log("🎮 Bot Real-Time Trading & Interactive Mini Games Berjalan!");

bot.start({
  onStart: () => {
    sendAndPinMainMenu();
  }
});