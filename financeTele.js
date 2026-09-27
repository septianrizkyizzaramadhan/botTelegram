require("dotenv").config();

const { Bot, InputFile } = require("grammy");
const finance = require("./finance");
const { createFinanceChart } = finance;

const bot = new Bot(process.env.BOT_TOKEN_FINANCE);
const FINANCE_TOPIC_ID = Number(process.env.TOPIC_FINANCE);

// ========================================
// CEK TOPIC
// ========================================

function isFinanceTopic(ctx) {
  if (!FINANCE_TOPIC_ID || isNaN(FINANCE_TOPIC_ID)) return true;
  return ctx.message?.message_thread_id === FINANCE_TOPIC_ID;
}

// ========================================
// FORMAT HELPERS
// ========================================

function formatRupiah(amount) {
  return `Rp${Number(amount).toLocaleString("id-ID")}`;
}

function formatRupiahShort(amount) {
  if (amount >= 1_000_000_000) return `Rp${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1)}jt`;
  if (amount >= 1_000) return `Rp${(amount / 1_000).toFixed(0)}rb`;
  return `Rp${amount}`;
}

function progressBar(current, max, length = 10) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function header(title) {
  const line = "─".repeat(title.length + 4);
  return `╭${line}╮\n│  ${title}  │\n╰${line}╯`;
}

function divider() {
  return "━━━━━━━━━━━━━━━━━━━━━━";
}

// ========================================
// START
// ========================================

bot.command("start", async (ctx) => {
  if (!isFinanceTopic(ctx)) return;

  const text =
    `${header("💰 FINANCE BOT 💰")}\n\n` +
    `<b>📝 Command List:</b>\n` +
    `• <code>/pemasukan 50000 freelance</code>\n` +
    `• <code>/pengeluaran 15000 makan nasi</code>\n` +
    `• <code>/keuangan</code> — summary\n` +
    `• <code>/riwayat</code> — 10 transaksi terakhir\n` +
    `• <code>/grafikday</code> — dashboard harian\n` +
    `• <code>/grafikmonth</code> — dashboard bulanan`;

  await ctx.reply(text, { parse_mode: "HTML" });
});

// ========================================
// PEMASUKAN
// ========================================

bot.hears(/^\/pemasukan\s+(\d+)(?:\s+(.+))?$/i, async (ctx) => {
  if (!isFinanceTopic(ctx)) return;

  const userId = String(ctx.from.id);
  const amount = Number(ctx.match[1]);
  const note = ctx.match[2] || "";

  try {
    finance.addTransaction(userId, "income", amount, "Pemasukan", note);
    const summary = finance.getSummary(userId);

    const text =
      `✅ <b>PEMASUKAN DICATAT</b>\n` +
      `${divider()}\n` +
      `💰 Jumlah: <b>${formatRupiah(amount)}</b>\n` +
      `📝 Catatan: <i>${note || "-"}</i>\n` +
      `${divider()}\n\n` +
      `📊 <b>Saldo Sekarang:</b>\n` +
      `💵 Total: <b>${formatRupiah(summary.balance)}</b>`;

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (error) {
    await ctx.reply(`❌ Gagal: ${error.message}`);
  }
});

// ========================================
// PENGELUARAN
// ========================================

bot.hears(/^\/pengeluaran\s+(\d+)(?:\s+(\S+))?(?:\s+(.+))?$/i, async (ctx) => {
  if (!isFinanceTopic(ctx)) return;

  const userId = String(ctx.from.id);
  const amount = Number(ctx.match[1]);
  const category = ctx.match[2] || "Lainnya";
  const note = ctx.match[3] || "";

  try {
    finance.addTransaction(userId, "expense", amount, category, note);
    const summary = finance.getSummary(userId);

    const text =
      `✅ <b>PENGELUARAN DICATAT</b>\n` +
      `${divider()}\n` +
      `💸 Jumlah: <b>${formatRupiah(amount)}</b>\n` +
      `🏷️ Kategori: <b>${category}</b>\n` +
      `📝 Catatan: <i>${note || "-"}</i>\n` +
      `${divider()}\n\n` +
      `📊 <b>Saldo Sekarang:</b>\n` +
      `💵 Total: <b>${formatRupiah(summary.balance)}</b>`;

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (error) {
    await ctx.reply(`❌ Gagal: ${error.message}`);
  }
});

// ========================================
// KEUANGAN
// ========================================

bot.command("keuangan", async (ctx) => {
  if (!isFinanceTopic(ctx)) return;

  const userId = String(ctx.from.id);
  const summary = finance.getSummary(userId);

  const total = summary.income + summary.expense;
  const incomePct = total > 0 ? Math.round((summary.income / total) * 100) : 0;
  const expensePct = total > 0 ? Math.round((summary.expense / total) * 100) : 0;

  const incomeBar = progressBar(summary.income, total || 1);
  const expenseBar = progressBar(summary.expense, total || 1);

  const text =
    `${header("💰 KEUANGAN 💰")}\n\n` +
    `📥 <b>Pemasukan</b>\n` +
    `   ${formatRupiah(summary.income)}\n` +
    `   <code>${incomeBar}</code> ${incomePct}%\n\n` +
    `📤 <b>Pengeluaran</b>\n` +
    `   ${formatRupiah(summary.expense)}\n` +
    `   <code>${expenseBar}</code> ${expensePct}%\n\n` +
    `${divider()}\n` +
    `💵 <b>Saldo</b>\n` +
    `   <b>${formatRupiah(summary.balance)}</b>`;

  await ctx.reply(text, { parse_mode: "HTML" });
});

// ========================================
// RIWAYAT
// ========================================

bot.command("riwayat", async (ctx) => {
  if (!isFinanceTopic(ctx)) return;

  const userId = String(ctx.from.id);
  const transactions = finance.getTransactions(userId);

  if (transactions.length === 0) {
    await ctx.reply("📭 Belum ada transaksi.");
    return;
  }

  let text = `${header("📜 RIWAYAT TRANSAKSI")}\n\n`;
  const recent = transactions.slice(0, 10);

  recent.forEach((t, i) => {
    const icon = t.type === "income" ? "📥" : "📤";
    const sign = t.type === "income" ? "+" : "-";
    text += `${i + 1}. ${icon} <b>${sign}${formatRupiah(t.amount)}</b>\n`;
    text += `   🏷️ ${t.category} · <i>${t.note || "-"}</i>\n\n`;
  });

  text += `<i>Menampilkan ${recent.length} dari ${transactions.length} transaksi</i>`;

  await ctx.reply(text, { parse_mode: "HTML" });
});

// ========================================
// GRAFIK HARIAN
// ========================================

bot.command(["grafikday", "grafikDay"], async (ctx) => {
  if (!isFinanceTopic(ctx)) return;

  const userId = String(ctx.from.id);
  const transactions = finance.getTransactions(userId);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const labels = [];
  const incomeData = [];
  const expenseData = [];

  for (let day = 1; day <= daysInMonth; day++) {
    labels.push(String(day));
    let inc = 0, exp = 0;
    for (const t of transactions) {
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        if (t.type === "income") inc += t.amount;
        if (t.type === "expense") exp += t.amount;
      }
    }
    incomeData.push(inc);
    expenseData.push(exp);
  }

  const totalIncome = incomeData.reduce((a, b) => a + b, 0);
  const totalExpense = expenseData.reduce((a, b) => a + b, 0);
  const balance = totalIncome - totalExpense;

  let todayExpense = 0;
  for (const t of transactions) {
    const d = new Date(t.date);
    if (t.type === "expense" && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
      todayExpense += t.amount;
    }
  }

  const categoryMap = finance.getExpenseByCategory
    ? finance.getExpenseByCategory(userId)
    : {};

  try {
    const { createMainDashboardChart, createCategoryChart } = require("./finance/chart");

    const mainBuffer = await createMainDashboardChart({
      labels, incomeData, expenseData,
      summary: { balance, income: totalIncome, expense: totalExpense, todayExpense },
      title: `Dashboard Harian`
    });

    const catBuffer = await createCategoryChart({
      categoryMap,
      title: "Kategori Pengeluaran"
    });

    const daysWithIncome = incomeData.filter(v => v > 0).length || 1;
    const daysWithExpense = expenseData.filter(v => v > 0).length || 1;
    const avgIncome = totalIncome / daysWithIncome;
    const avgExpense = totalExpense / daysWithExpense;

    let caption =
      `${header("📊 DASHBOARD HARIAN")}\n` +
      `📅 ${now.toLocaleString("id-ID", { month: "long", year: "numeric" })}\n` +
      `${divider()}\n\n` +
      `📥 <b>Pemasukan</b>\n` +
      `   ${formatRupiah(totalIncome)}\n` +
      `   Avg: ${formatRupiah(Math.round(avgIncome))}/hari\n\n` +
      `📤 <b>Pengeluaran</b>\n` +
      `   ${formatRupiah(totalExpense)}\n` +
      `   Avg: ${formatRupiah(Math.round(avgExpense))}/hari\n\n` +
      `${divider()}\n` +
      `💵 <b>Saldo:</b> ${formatRupiah(balance)}\n` +
      `📅 <b>Keluar hari ini:</b> ${formatRupiah(todayExpense)}`;

    await ctx.replyWithMediaGroup([
      {
        type: "photo",
        media: new InputFile(mainBuffer, "dashboard-harian.png"),
        caption,
        parse_mode: "HTML"
      },
      {
        type: "photo",
        media: new InputFile(catBuffer, "kategori-harian.png")
      }
    ]);
  } catch (error) {
    console.error("Grafik Harian Error:", error);
    await ctx.reply(`❌ Gagal membuat grafik.\n<code>${error.message}</code>`, { parse_mode: "HTML" });
  }
});

// ========================================
// GRAFIK BULANAN
// ========================================

bot.command(["grafikmonth", "grafikMonth", "grafikMount"], async (ctx) => {
  if (!isFinanceTopic(ctx)) return;

  const userId = String(ctx.from.id);
  const transactions = finance.getTransactions(userId);

  const now = new Date();
  const year = now.getFullYear();
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

  const incomeData = new Array(12).fill(0);
  const expenseData = new Array(12).fill(0);

  for (const t of transactions) {
    const d = new Date(t.date);
    if (d.getFullYear() !== year) continue;
    if (t.type === "income") incomeData[d.getMonth()] += t.amount;
    if (t.type === "expense") expenseData[d.getMonth()] += t.amount;
  }

  const totalIncome = incomeData.reduce((a, b) => a + b, 0);
  const totalExpense = expenseData.reduce((a, b) => a + b, 0);
  const balance = totalIncome - totalExpense;

  const today = new Date();
  let todayExpense = 0;
  for (const t of transactions) {
    const d = new Date(t.date);
    if (t.type === "expense" && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
      todayExpense += t.amount;
    }
  }

  const categoryMap = finance.getExpenseByCategory
    ? finance.getExpenseByCategory(userId)
    : {};

  try {
    const { createMainDashboardChart, createCategoryChart } = require("./finance/chart");

    const mainBuffer = await createMainDashboardChart({
      labels: months, incomeData, expenseData,
      summary: { balance, income: totalIncome, expense: totalExpense, todayExpense },
      title: `Dashboard Bulanan`
    });

    const catBuffer = await createCategoryChart({
      categoryMap,
      title: "Kategori Pengeluaran"
    });

    const monthsWithIncome = incomeData.filter(v => v > 0).length || 1;
    const monthsWithExpense = expenseData.filter(v => v > 0).length || 1;
    const avgIncome = totalIncome / monthsWithIncome;
    const avgExpense = totalExpense / monthsWithExpense;

    let caption =
      `${header("📊 DASHBOARD BULANAN")}\n` +
      `📅 Tahun ${year}\n` +
      `${divider()}\n\n` +
      `📥 <b>Pemasukan</b>\n` +
      `   ${formatRupiah(totalIncome)}\n` +
      `   Avg: ${formatRupiah(Math.round(avgIncome))}/bulan\n\n` +
      `📤 <b>Pengeluaran</b>\n` +
      `   ${formatRupiah(totalExpense)}\n` +
      `   Avg: ${formatRupiah(Math.round(avgExpense))}/bulan\n\n` +
      `${divider()}\n` +
      `💵 <b>Saldo:</b> ${formatRupiah(balance)}\n` +
      `📅 <b>Keluar hari ini:</b> ${formatRupiah(todayExpense)}`;

    await ctx.replyWithMediaGroup([
      {
        type: "photo",
        media: new InputFile(mainBuffer, "dashboard.png"),
        caption,
        parse_mode: "HTML"
      },
      {
        type: "photo",
        media: new InputFile(catBuffer, "kategori.png")
      }
    ]);
  } catch (error) {
    console.error("Grafik Bulanan Error:", error);
    await ctx.reply(`❌ Gagal membuat grafik.\n<code>${error.message}</code>`, { parse_mode: "HTML" });
  }
});

// ========================================
// ERROR HANDLER
// ========================================

bot.catch((error) => {
  console.error("Finance Bot Error:", error.error || error);
});

bot.start();
console.log("Finance Bot berjalan...");