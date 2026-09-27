require("dotenv").config();
const { Bot, InlineKeyboard, InputFile } = require("grammy");
const fs = require("fs");
const path = require("path");

const bot = new Bot(process.env.BOT_TOKEN_GAME);
const TOPIC_GAME_ID = Number(process.env.TOPIC_GAME);
const DB_FILE = path.join(__dirname, "balances.json");

// ================= GLOBAL MARKET ENGINE (REALTIME & OHLC) =================
let currentMarketPrice = 65000;
let marketHistory = [64950, 64980, 65000, 65020, 65000];
let candles = [];

function initCandles() {
  let price = 65000;
  let now = Date.now() - 8 * 60 * 1000;
  candles = [];

  for (let i = 0; i < 8; i++) {
    const open = price;
    const high = open + Math.random() * 150;
    const low = open - Math.random() * 150;
    const close = low + Math.random() * (high - low);
    price = close;

    candles.push({
      x: new Date(now + i * 60000).toLocaleTimeString("id-ID", { minute: "2-digit", second: "2-digit" }),
      o: Math.round(open),
      h: Math.round(high),
      l: Math.round(low),
      c: Math.round(close)
    });
  }
  currentMarketPrice = price;
}
initCandles();

// Storage Posisi Aktif User, Config Trading, & Session Bet Mini Games
const activePositions = new Map();
const userTradingConfigs = new Map();
const userBetConfigs = new Map();

// ================= BACA & SIMPAN BALANCES =================
function loadBalances() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error membaca file balances.json:", err);
  }
  return {};
}

function saveBalances(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error menyimpan ke file balances.json:", err);
  }
}

let balances = loadBalances();

function getBalance(userId) {
  if (balances[userId] === undefined) {
    balances[userId] = 1000;
    saveBalances(balances);
  }
  return balances[userId];
}

// ================= VISUALISASI CHART TEXT =================
function generateChartText(prices) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  let chart = "```\n📈 BTC/USDT REAL-TIME MARKET\n-----------------------------------\n";
  
  prices.slice(-6).forEach((price, index) => {
    const bars = Math.round(((price - min) / (max - min || 1)) * 10) + 1;
    const barStr = "🟩".repeat(bars);
    chart += `T${index + 1}: $${price.toFixed(2)} | ${barStr}\n`;
  });
  chart += "-----------------------------------\n```";
  return chart;
}

// ================= ENGINE PASAR (BERJALAN SETIAP 2 DETIK) =================
setInterval(async () => {
  const deltaPercent = (Math.random() - 0.5) * 0.012;
  currentMarketPrice = Math.round(currentMarketPrice * (1 + deltaPercent));
  
  marketHistory.push(currentMarketPrice);
  if (marketHistory.length > 20) marketHistory.shift();

  let lastCandle = candles[candles.length - 1];
  lastCandle.c = currentMarketPrice;
  if (currentMarketPrice > lastCandle.h) lastCandle.h = currentMarketPrice;
  if (currentMarketPrice < lastCandle.l) lastCandle.l = currentMarketPrice;

  if (Math.random() < 0.3) {
    if (candles.length >= 10) candles.shift();
    const timeStr = new Date().toLocaleTimeString("id-ID", { minute: "2-digit", second: "2-digit" });
    candles.push({
      x: timeStr,
      o: currentMarketPrice,
      h: currentMarketPrice,
      l: currentMarketPrice,
      c: currentMarketPrice
    });
  }

  // CHECK POSISI AKTIF
  for (const [userId, pos] of activePositions.entries()) {
    let shouldClose = false;
    let closeReason = "";

    const priceChangeRatio = (currentMarketPrice - pos.entryPrice) / pos.entryPrice;
    let pnlRatio = pos.type === "LONG" ? priceChangeRatio * pos.leverage : -priceChangeRatio * pos.leverage;
    let netProfit = pos.margin * pnlRatio;

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

    if (netProfit <= -pos.margin) {
      shouldClose = true;
      closeReason = "💥 LIQUIDATED (Margin Hangus)!";
      netProfit = -pos.margin;
    }

    if (shouldClose) {
      activePositions.delete(userId);

      let totalReturn = pos.margin + netProfit;
      if (totalReturn < 0) totalReturn = 0;

      balances[userId] += totalReturn;
      saveBalances(balances);

      try {
        await bot.api.editMessageText(
          pos.chatId,
          pos.messageId,
          `🔔 **POSISI CLOSED: ${closeReason}**\n\n` +
          `• Posisi: **${pos.type}** (Leverage ${pos.leverage}x)\n` +
          `• Margin: **$${pos.margin.toFixed(2)}**\n` +
          `• Entry Price: **$${pos.entryPrice.toFixed(2)}**\n` +
          `• Exit Price: **$${currentMarketPrice.toFixed(2)}**\n` +
          `• Hasil PnL: **${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(2)}**\n\n` +
          `Total Saldo: **$${balances[userId].toFixed(2)}**`,
          {
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard().text("🎮 Menu Utama", "menu_game")
          }
        );
      } catch (err) {
        console.error("Error Auto-Close alert:", err.message);
      }
    }
  }
}, 2000);

// ================= QUICKCHART GENERATOR =================
async function getChartImageBuffer(candleData) {
  const formattedData = candleData.map((c) => ({
    x: c.x, o: c.o, h: c.h, l: c.l, c: c.c
  }));

  const chartConfig = {
    type: 'candlestick',
    data: { datasets: [{ label: 'BTC/USDT', data: formattedData }] },
    options: { legend: { display: false }, title: { display: true, text: 'BTC/USDT 1m Candlestick Chart' } }
  };

  const response = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ width: 600, height: 350, backgroundColor: 'white', format: 'png', chart: chartConfig })
  });

  if (!response.ok) throw new Error(`Gagal mengambil chart: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ================= HELPER MENU UTAMA =================
function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text("📊 Trading Arena (Real-time)", "menu_trading")
    .row()
    .text("🎰 Slot Machine", "info_slot")
    .text("🎯 Lempar Darts", "info_dart")
    .row()
    .text("🎲 Kocok Dadu", "info_dadu")
    .text("💵 Cek Saldo", "check_balance");
}

function getMainMenuText(userId) {
  return (
    `🎮 **TELEGRAM MINI GAME & TRADING CENTER**\n\n` +
    `• BTC Market Price: **$${currentMarketPrice.toFixed(2)}**\n` +
    `• Saldo Anda: **$${getBalance(userId).toFixed(2)}**\n\n` +
    `Pilih permainan atau arena trading di bawah:`
  );
}

// AUTO PIN PESAN UTAMA SAAT BOT DITANGKAP
async function sendAndPinMainMenu() {
  try {
    const msg = await bot.api.sendMessage(
      TOPIC_GAME_ID,
      `🎮 **TELEGRAM MINI GAME & TRADING CENTER**\n\n` +
      `Pilih permainan atau arena trading di bawah untuk mulai bermain:`,
      {
        reply_markup: getMainMenuKeyboard(),
        message_thread_id: TOPIC_GAME_ID,
        parse_mode: "Markdown"
      }
    );
    await bot.api.pinChatMessage(TOPIC_GAME_ID, msg.message_id);
  } catch (err) {
    console.log("Auto-pin info:", err.message);
  }
}

// ================= TELEGRAM HANDLERS =================

bot.command("game", async (ctx) => {
  await ctx.reply(getMainMenuText(ctx.from.id), {
    reply_markup: getMainMenuKeyboard(),
    message_thread_id: TOPIC_GAME_ID,
    parse_mode: "Markdown"
  });
});

// Auto-Respond Setiap Ada Pesan Teks di Topik Game
bot.on("message:text", async (ctx, next) => {
  if (ctx.message.message_thread_id === TOPIC_GAME_ID) {
    if (ctx.message.text.startsWith("/")) return next();

    return ctx.reply(getMainMenuText(ctx.from.id), {
      reply_markup: getMainMenuKeyboard(),
      message_thread_id: TOPIC_GAME_ID,
      parse_mode: "Markdown"
    });
  }
  return next();
});

bot.callbackQuery("check_balance", async (ctx) => {
  const cash = getBalance(ctx.from.id);
  await ctx.answerCallbackQuery({ text: `Saldo kamu: $${cash.toFixed(2)}`, show_alert: true });
});

bot.callbackQuery("menu_game", async (ctx) => {
  await ctx.editMessageText(getMainMenuText(ctx.from.id), {
    reply_markup: getMainMenuKeyboard(),
    parse_mode: "Markdown"
  });
});

// ================= TRADING ARENA HANDLERS =================
bot.callbackQuery("menu_trading", async (ctx) => {
  const userId = ctx.from.id;

  if (activePositions.has(userId)) {
    return renderActivePositionMenu(ctx);
  }

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

  const longTp = currentMarketPrice * (1 + priceTpPct);
  const longSl = currentMarketPrice * (1 - priceSlPct);

  const keyboard = new InlineKeyboard()
    .text(`💵 Margin: $${config.margin}`, "cycle_margin")
    .text(`⚡ Leverage: ${config.leverage}x`, "cycle_leverage")
    .row()
    .text(`🎯 Target TP: +${config.tpPct * 100}%`, "toggle_tp")
    .text(`🛑 Target SL: -${config.slPct * 100}%`, "toggle_sl")
    .row()
    .text("📈 OPEN LONG (BUY)", "open_LONG")
    .text("📉 OPEN SHORT (SELL)", "open_SHORT")
    .row()
    .text("🎮 Menu Utama", "menu_game");

  const caption =
    `🕯️ **CANDLESTICK & REALTIME TRADING**\n\n` +
    `• **Harga BTC Now:** $${currentMarketPrice.toFixed(2)}\n` +
    `• **Margin:** $${config.margin} | **Leverage:** ${config.leverage}x\n` +
    `• **Posisi Size:** $${(config.margin * config.leverage).toFixed(2)}\n` +
    `• **Est. TP Target (LONG):** $${longTp.toFixed(2)} (+${config.tpPct * 100}% PnL)\n` +
    `• **Est. SL Target (LONG):** $${longSl.toFixed(2)} (-${config.slPct * 100}% PnL)\n\n` +
    `*Klik tombol Margin / Leverage untuk mengubah setting!*`;

  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    try {
      if (ctx.callbackQuery.message.photo) {
        await ctx.editMessageCaption({
          caption: caption,
          reply_markup: keyboard,
          parse_mode: "Markdown"
        });
      } else {
        await ctx.editMessageText(caption, {
          reply_markup: keyboard,
          parse_mode: "Markdown"
        });
      }
    } catch (e) {
      // Mengabaikan error jika konten pesan tidak mengalami perubahan
    }
  } else {
    try {
      const imageBuffer = await getChartImageBuffer(candles);
      await ctx.replyWithPhoto(new InputFile(imageBuffer, "chart.png"), {
        caption: caption,
        reply_markup: keyboard,
        message_thread_id: TOPIC_GAME_ID,
        parse_mode: "Markdown"
      });
    } catch (e) {
      await ctx.reply(caption, {
        reply_markup: keyboard,
        message_thread_id: TOPIC_GAME_ID,
        parse_mode: "Markdown"
      });
    }
  }
}

bot.callbackQuery("cycle_margin", async (ctx) => {
  const userId = ctx.from.id;
  const config = userTradingConfigs.get(userId);
  const margins = [10, 25, 50, 100, 250, 500];
  const nextIdx = (margins.indexOf(config.margin) + 1) % margins.length;
  config.margin = margins[nextIdx];
  
  await ctx.answerCallbackQuery({ text: `Margin diubah ke $${config.margin}` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery("cycle_leverage", async (ctx) => {
  const userId = ctx.from.id;
  const config = userTradingConfigs.get(userId);
  const leverages = [1, 5, 10, 20, 50];
  const nextIdx = (leverages.indexOf(config.leverage) + 1) % leverages.length;
  config.leverage = leverages[nextIdx];
  
  await ctx.answerCallbackQuery({ text: `Leverage diubah ke ${config.leverage}x` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery("toggle_tp", async (ctx) => {
  const userId = ctx.from.id;
  const config = userTradingConfigs.get(userId);
  config.tpPct = config.tpPct === 0.04 ? 0.08 : (config.tpPct === 0.08 ? 0.02 : 0.04);
  
  await ctx.answerCallbackQuery({ text: `Target TP PnL: ${config.tpPct * 100}%` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery("toggle_sl", async (ctx) => {
  const userId = ctx.from.id;
  const config = userTradingConfigs.get(userId);
  config.slPct = config.slPct === 0.02 ? 0.04 : (config.slPct === 0.04 ? 0.01 : 0.02);
  
  await ctx.answerCallbackQuery({ text: `Target SL PnL: ${config.slPct * 100}%` }).catch(() => {});
  await renderTradingSetupMenu(ctx);
});

bot.callbackQuery(/^open_(LONG|SHORT)$/, async (ctx) => {
  const userId = ctx.from.id;
  const posType = ctx.match[1];

  if (activePositions.has(userId)) {
    return ctx.answerCallbackQuery({ text: "❌ Kamu masih memiliki posisi yang aktif!", show_alert: true });
  }

  const config = userTradingConfigs.get(userId);
  const userCash = getBalance(userId);

  if (userCash < config.margin) {
    return ctx.answerCallbackQuery({ text: `❌ Saldo kurang! Butuh Margin $${config.margin}`, show_alert: true });
  }

  balances[userId] -= config.margin;
  saveBalances(balances);

  const entryPrice = currentMarketPrice;
  const priceSlPct = config.slPct / config.leverage;
  const priceTpPct = config.tpPct / config.leverage;

  const tpPrice = posType === "LONG" ? entryPrice * (1 + priceTpPct) : entryPrice * (1 - priceTpPct);
  const slPrice = posType === "LONG" ? entryPrice * (1 - priceSlPct) : entryPrice * (1 + priceSlPct);

  const msg = await ctx.reply("⏳ Membuka posisi trading...", { message_thread_id: TOPIC_GAME_ID });

  activePositions.set(userId, {
    type: posType,
    margin: config.margin,
    leverage: config.leverage,
    entryPrice: entryPrice,
    tpPrice: tpPrice,
    slPrice: slPrice,
    chatId: ctx.chat.id,
    messageId: msg.message_id
  });

  await ctx.answerCallbackQuery({ text: `Posisi ${posType} Berhasil Dibuka!` });
  await renderActivePositionMenu(ctx, userId);
});

async function renderActivePositionMenu(ctx, directUserId = null) {
  const userId = directUserId || ctx.from.id;
  const pos = activePositions.get(userId);

  if (!pos) return;

  const priceChangeRatio = (currentMarketPrice - pos.entryPrice) / pos.entryPrice;
  let pnlRatio = pos.type === "LONG" ? priceChangeRatio * pos.leverage : -priceChangeRatio * pos.leverage;
  let netProfit = pos.margin * pnlRatio;

  const chartText = generateChartText(marketHistory);

  const keyboard = new InlineKeyboard()
    .text("🔄 Live Refresh PnL", "refresh_active")
    .row()
    .text("🔴 CLOSE POSITION (Manual)", "manual_close");

  const text =
    `🚨 **POSISI TRADING AKTIF**\n\n` +
    `${chartText}\n` +
    `• Posisi: **${pos.type}** (Margin $${pos.margin} | Lev ${pos.leverage}x)\n` +
    `• Entry Price: **$${pos.entryPrice.toFixed(2)}**\n` +
    `• Current Price: **$${currentMarketPrice.toFixed(2)}**\n` +
    `• Target TP: **$${pos.tpPrice.toFixed(2)}**\n` +
    `• Target SL: **$${pos.slPrice.toFixed(2)}**\n\n` +
    `• Floating PnL: **${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(2)}** (${(pnlRatio * 100).toFixed(2)}%)\n\n` +
    `*Harga di-update otomatis di background.*`;

  try {
    await bot.api.editMessageText(pos.chatId, pos.messageId, text, { reply_markup: keyboard, parse_mode: "Markdown" });
  } catch (e) {}
}

bot.callbackQuery("refresh_active", async (ctx) => {
  await renderActivePositionMenu(ctx);
  await ctx.answerCallbackQuery({ text: "PnL Diperbarui!" }).catch(() => {});
});

bot.callbackQuery("manual_close", async (ctx) => {
  const userId = ctx.from.id;
  const pos = activePositions.get(userId);

  if (!pos) {
    return ctx.answerCallbackQuery({ text: "Posisi sudah ditutup/tidak ditemukan!", show_alert: true });
  }

  activePositions.delete(userId);

  const priceChangeRatio = (currentMarketPrice - pos.entryPrice) / pos.entryPrice;
  let pnlRatio = pos.type === "LONG" ? priceChangeRatio * pos.leverage : -priceChangeRatio * pos.leverage;
  let netProfit = pos.margin * pnlRatio;

  let totalReturn = pos.margin + netProfit;
  if (totalReturn < 0) totalReturn = 0;

  balances[userId] += totalReturn;
  saveBalances(balances);

  await ctx.answerCallbackQuery({ text: "Posisi Berhasil Ditutup!" });

  const statusText = netProfit >= 0 ? "🎉 **POSISI DITUTUP (PROFIT)!**" : "📉 **POSISI DITUTUP (RUGI)!**";

  try {
    await ctx.editMessageText(
      `${statusText}\n\n` +
      `• Posisi: **${pos.type}** (${pos.leverage}x)\n` +
      `• Entry Price: **$${pos.entryPrice.toFixed(2)}**\n` +
      `• Close Price: **$${currentMarketPrice.toFixed(2)}**\n` +
      `• Hasil PnL: **${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(2)}**\n\n` +
      `Total Saldo: **$${balances[userId].toFixed(2)}**`,
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("🎮 Menu Utama", "menu_game")
      }
    );
  } catch (e) {}
});

// ================= MINI GAMES SETUP & TARUHAN =================

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
    .text(`🚀 SPIN/PUTAR ($${currentBet})`, `start_${gameType}`)
    .row()
    .text("🎮 Kembali Ke Menu", "menu_game");
}

bot.callbackQuery("info_slot", async (ctx) => {
  const userId = ctx.from.id;
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const bet = userBetConfigs.get(userId).slot;

  await ctx.editMessageText(
    `🎰 **SLOT MACHINE ARENA**\n\n` +
    `**Aturan Permainan:**\n` +
    `• Putar mesin slot animasi bawaan Telegram.\n` +
    `• **Triple 777:** Hadiah Multiplier **10x** dari nilai taruhan!\n` +
    `• **Triple Simbol Lain:** Hadiah Multiplier **3x** dari nilai taruhan.\n` +
    `• **Selain itu:** Taruhan hangus.\n\n` +
    `Saldo Anda: **$${getBalance(userId).toFixed(2)}**\n` +
    `Pilih Nominal Taruhan:`,
    { reply_markup: makeBetKeyboard("slot", bet), parse_mode: "Markdown" }
  );
});

bot.callbackQuery("info_dadu", async (ctx) => {
  const userId = ctx.from.id;
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const bet = userBetConfigs.get(userId).dadu;

  await ctx.editMessageText(
    `🎲 **KOCOK DADU ARENA**\n\n` +
    `**Aturan Permainan:**\n` +
    `• Kocok dadu 3D animasi real-time.\n` +
    `• **Mendapat Angka 4, 5, atau 6:** MENANG! Mendapat **2.5x** dari nilai taruhan.\n` +
    `• **Mendapat Angka 1, 2, atau 3:** KALAH. Taruhan hangus.\n\n` +
    `Saldo Anda: **$${getBalance(userId).toFixed(2)}**\n` +
    `Pilih Nominal Taruhan:`,
    { reply_markup: makeBetKeyboard("dadu", bet), parse_mode: "Markdown" }
  );
});

bot.callbackQuery("info_dart", async (ctx) => {
  const userId = ctx.from.id;
  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const bet = userBetConfigs.get(userId).dart;

  await ctx.editMessageText(
    `🎯 **LEMPAR DARTS ARENA**\n\n` +
    `**Aturan Permainan:**\n` +
    `• Lempar anak panah ke papan target secara animasi.\n` +
    `• **Bullseye (Tepat di Tengah / Skor 6):** Hadiah Multiplier **5x**!\n` +
    `• **Lingkaran Dalam (Skor 4-5):** Hadiah Multiplier **2x**.\n` +
    `• **Meleset (Skor 1-3):** Taruhan hangus.\n\n` +
    `Saldo Anda: **$${getBalance(userId).toFixed(2)}**\n` +
    `Pilih Nominal Taruhan:`,
    { reply_markup: makeBetKeyboard("dart", bet), parse_mode: "Markdown" }
  );
});

bot.callbackQuery(/^setbet_(slot|dadu|dart)_(5|10|25|50|100|allin)$/, async (ctx) => {
  const userId = ctx.from.id;
  const game = ctx.match[1];
  const valStr = ctx.match[2];

  if (!userBetConfigs.has(userId)) userBetConfigs.set(userId, { slot: 20, dadu: 10, dart: 15 });
  const config = userBetConfigs.get(userId);

  if (valStr === "allin") {
    config[game] = Math.floor(getBalance(userId));
  } else {
    config[game] = parseInt(valStr);
  }

  await ctx.answerCallbackQuery({ text: `Taruhan ${game.toUpperCase()} diset ke $${config[game]}` });

  if (game === "slot") ctx.api.editMessageReplyMarkup(ctx.chat.id, ctx.callbackQuery.message.message_id, { reply_markup: makeBetKeyboard("slot", config.slot) });
  if (game === "dadu") ctx.api.editMessageReplyMarkup(ctx.chat.id, ctx.callbackQuery.message.message_id, { reply_markup: makeBetKeyboard("dadu", config.dadu) });
  if (game === "dart") ctx.api.editMessageReplyMarkup(ctx.chat.id, ctx.callbackQuery.message.message_id, { reply_markup: makeBetKeyboard("dart", config.dart) });
});

// ================= EKSEKUSI MINI GAMES ANIMASI =================

bot.callbackQuery("start_slot", async (ctx) => {
  const userId = ctx.from.id;
  const config = userBetConfigs.get(userId) || { slot: 20 };
  const BET = config.slot;
  const userCash = getBalance(userId);

  if (BET <= 0 || userCash < BET) {
    return ctx.answerCallbackQuery({ text: `❌ Saldo kurang! Taruhan: $${BET}, Saldo: $${userCash.toFixed(2)}`, show_alert: true });
  }

  balances[userId] -= BET;
  saveBalances(balances);

  await ctx.answerCallbackQuery({ text: "Memutar Slot Machine..." });
  const slotMsg = await ctx.replyWithDice("🎰", { message_thread_id: TOPIC_GAME_ID });
  const val = slotMsg.dice.value;

  setTimeout(async () => {
    let reward = 0;
    let message = "";

    if (val === 64) {
      reward = BET * 10;
      message = `🔥 **JACKPOT TRIPLE 777!** 🔥\nKamu memenangkan **+$${reward}**!`;
    } else if ([1, 22, 43].includes(val)) {
      reward = BET * 3;
      message = `🎉 **TRIPLE MATCH!** 🎉\nKamu memenangkan **+$${reward}**!`;
    } else {
      message = `❌ **BELUM BERUNTUNG!**\nKamu kehilangan taruhan **-$${BET}**.`;
    }

    balances[userId] += reward;
    saveBalances(balances);

    await ctx.reply(
      `${message}\n\nTotal Saldo: **$${balances[userId].toFixed(2)}**`,
      {
        message_thread_id: TOPIC_GAME_ID,
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("🎮 Menu Utama", "menu_game")
      }
    );
  }, 3000);
});

bot.callbackQuery("start_dadu", async (ctx) => {
  const userId = ctx.from.id;
  const config = userBetConfigs.get(userId) || { dadu: 10 };
  const BET = config.dadu;
  const userCash = getBalance(userId);

  if (BET <= 0 || userCash < BET) {
    return ctx.answerCallbackQuery({ text: `❌ Saldo kurang! Taruhan: $${BET}, Saldo: $${userCash.toFixed(2)}`, show_alert: true });
  }

  balances[userId] -= BET;
  saveBalances(balances);

  await ctx.answerCallbackQuery({ text: "Melempar Dadu..." });
  const diceMsg = await ctx.replyWithDice("🎲", { message_thread_id: TOPIC_GAME_ID });
  const result = diceMsg.dice.value;

  setTimeout(async () => {
    let reward = 0;
    let message = "";

    if (result >= 4) {
      reward = Math.round(BET * 2.5);
      message = `🎉 **ANGKA DADU: ${result} (MENANG!)**\nKamu mendapat **+$${reward}**!`;
    } else {
      message = `❌ **ANGKA DADU: ${result} (KALAH)**\nTaruhan **-$${BET}** hangus.`;
    }

    balances[userId] += reward;
    saveBalances(balances);

    await ctx.reply(
      `${message}\n\nTotal Saldo: **$${balances[userId].toFixed(2)}**`,
      {
        message_thread_id: TOPIC_GAME_ID,
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("🎮 Menu Utama", "menu_game")
      }
    );
  }, 3000);
});

bot.callbackQuery("start_dart", async (ctx) => {
  const userId = ctx.from.id;
  const config = userBetConfigs.get(userId) || { dart: 15 };
  const BET = config.dart;
  const userCash = getBalance(userId);

  if (BET <= 0 || userCash < BET) {
    return ctx.answerCallbackQuery({ text: `❌ Saldo kurang! Taruhan: $${BET}, Saldo: $${userCash.toFixed(2)}`, show_alert: true });
  }

  balances[userId] -= BET;
  saveBalances(balances);

  await ctx.answerCallbackQuery({ text: "Melempar Anak Panah..." });
  const dartMsg = await ctx.replyWithDice("🎯", { message_thread_id: TOPIC_GAME_ID });
  const score = dartMsg.dice.value;

  setTimeout(async () => {
    let reward = 0;
    let message = "";

    if (score === 6) {
      reward = BET * 5;
      message = `🎯 **BULLSEYE! TEPAT DI TENGAH!** 🎯\nKamu memenangkan **+$${reward}**!`;
    } else if (score >= 4) {
      reward = BET * 2;
      message = `✨ **TEMBAKAN BAGUS (Skor: ${score})**\nKamu mendapat **+$${reward}**!`;
    } else {
      message = `❌ **MELESET! (Skor: ${score})**\nKamu kehilangan **-$${BET}**.`;
    }

    balances[userId] += reward;
    saveBalances(balances);

    await ctx.reply(
      `${message}\n\nTotal Saldo: **$${balances[userId].toFixed(2)}**`,
      {
        message_thread_id: TOPIC_GAME_ID,
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("🎮 Menu Utama", "menu_game")
      }
    );
  }, 3000);
});

bot.command(["mycash", "mc"], async (ctx) => {
  const cash = getBalance(ctx.from.id);
  await ctx.reply(`💵 Saldo Kamu: **$${cash.toFixed(2)}**`, { parse_mode: "Markdown" });
});

bot.catch((err) => {
  console.error("Grammy Error:", err.error);
});

console.log("🎮 Bot Real-Time Trading & Interactive Mini Games Berjalan!");

bot.start({
  onStart: () => {
    sendAndPinMainMenu();
  }
});