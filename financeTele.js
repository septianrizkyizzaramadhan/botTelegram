require("dotenv").config();

const { Bot, InputFile } = require("grammy");
const finance = require("./finance");

const bot = new Bot(process.env.BOT_TOKEN_FINANCE);
const FINANCE_TOPIC_ID = Number(process.env.TOPIC_FINANCE);

// ========================================
// CEK TOPIC
// ========================================

function isFinanceTopic(ctx) {
    // Kalau TOPIC_FINANCE tidak di-set / NaN, terima semua (fallback)
    if (!FINANCE_TOPIC_ID || isNaN(FINANCE_TOPIC_ID)) return true;

    return ctx.message?.message_thread_id === FINANCE_TOPIC_ID;
}

// ========================================
// FORMAT RUPIAH
// ========================================

function formatRupiah(amount) {
    return `Rp${Number(amount).toLocaleString("id-ID")}`;
}

// ========================================
// START
// ========================================

bot.command("start", async (ctx) => {
    if (!isFinanceTopic(ctx)) return;

    await ctx.reply(
        "BOT KEUANGAN\n\n" +
        "Perintah yang tersedia:\n\n" +
        "/pemasukan 50000 freelance\n" +
        "/pengeluaran 15000 makan nasi\n" +
        "/keuangan\n" +
        "/riwayat\n" +
        "/grafikday\n" +
        "/grafikmonth"
    );
});

// ========================================
// PEMASUKAN
// Format:
// /pemasukan 50000 freelance
// ========================================

bot.hears(/^\/pemasukan\s+(\d+)(?:\s+(.+))?$/i, async (ctx) => {
    if (!isFinanceTopic(ctx)) return;

    const userId = String(ctx.from.id);
    const amount = Number(ctx.match[1]);
    const note = ctx.match[2] || "";

    try {
        finance.addTransaction(
            userId,
            "income",
            amount,
            "Pemasukan",
            note
        );

        await ctx.reply(
            "Pemasukan berhasil dicatat.\n\n" +
            `Jumlah: ${formatRupiah(amount)}\n` +
            `Catatan: ${note || "-"}`
        );
    } catch (error) {
        await ctx.reply(
            `Gagal mencatat pemasukan.\n${error.message}`
        );
    }
});

// ========================================
// PENGELUARAN
// Format:
// /pengeluaran 15000 makan nasi
// ========================================

bot.hears(
    /^\/pengeluaran\s+(\d+)(?:\s+(\S+))?(?:\s+(.+))?$/i,
    async (ctx) => {
        if (!isFinanceTopic(ctx)) return;

        const userId = String(ctx.from.id);
        const amount = Number(ctx.match[1]);
        const category = ctx.match[2] || "Lainnya";
        const note = ctx.match[3] || "";

        try {
            finance.addTransaction(
                userId,
                "expense",
                amount,
                category,
                note
            );

            await ctx.reply(
                "Pengeluaran berhasil dicatat.\n\n" +
                `Jumlah: ${formatRupiah(amount)}\n` +
                `Kategori: ${category}\n` +
                `Catatan: ${note || "-"}`
            );
        } catch (error) {
            await ctx.reply(
                `Gagal mencatat pengeluaran.\n${error.message}`
            );
        }
    }
);

// ========================================
// KEUANGAN
// ========================================

bot.command("keuangan", async (ctx) => {
    if (!isFinanceTopic(ctx)) return;

    const userId = String(ctx.from.id);
    const summary = finance.getSummary(userId);

    await ctx.reply(
        "KEUANGAN\n\n" +
        `Pemasukan  : ${formatRupiah(summary.income)}\n` +
        `Pengeluaran: ${formatRupiah(summary.expense)}\n` +
        `Saldo      : ${formatRupiah(summary.balance)}`
    );
});

// ========================================
// RIWAYAT
// ========================================

bot.command("riwayat", async (ctx) => {
    if (!isFinanceTopic(ctx)) return;

    const userId = String(ctx.from.id);
    const transactions = finance.getTransactions(userId);

    if (transactions.length === 0) {
        await ctx.reply("Belum ada transaksi.");
        return;
    }

    const text = transactions
        .slice(0, 10)
        .map((transaction, index) => {
            const sign = transaction.type === "income" ? "+" : "-";

            return (
                `${index + 1}. ${sign} ${formatRupiah(transaction.amount)}\n` +
                `   ${transaction.category} — ${transaction.note || "-"}`
            );
        })
        .join("\n\n");

    await ctx.reply(
        `RIWAYAT TRANSAKSI\n\n${text}`
    );
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
            if (
                d.getFullYear() === year &&
                d.getMonth() === month &&
                d.getDate() === day
            ) {
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
        if (
            t.type === "expense" &&
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
        ) {
            todayExpense += t.amount;
        }
    }

    const categoryMap = finance.getExpenseByCategory
        ? finance.getExpenseByCategory(userId)
        : {};

    try {
        const {
            createMainDashboardChart,
            createCategoryChart
        } = require("./finance/chart");

        const mainBuffer = await createMainDashboardChart({
            labels,
            incomeData,
            expenseData,
            summary: { balance, income: totalIncome, expense: totalExpense, todayExpense },
            title: `Dashboard Harian — ${now.toLocaleString("id-ID", { month: "long", year: "numeric" })}`
        });

        const catBuffer = await createCategoryChart({
            categoryMap,
            title: "Kategori Pengeluaran"
        });

        const daysWithIncome = incomeData.filter(v => v > 0).length || 1;
        const daysWithExpense = expenseData.filter(v => v > 0).length || 1;
        const avgIncome = totalIncome / daysWithIncome;
        const avgExpense = totalExpense / daysWithExpense;

        const caption =
            `📊 *DASHBOARD HARIAN*\n` +
            `Periode: ${now.toLocaleString("id-ID", { month: "long", year: "numeric" })}\n\n` +
            `💰 Pemasukan: *${formatRupiah(totalIncome)}*\n` +
            `   Avg: ${formatRupiah(Math.round(avgIncome))}/hari\n\n` +
            `💸 Pengeluaran: *${formatRupiah(totalExpense)}*\n` +
            `   Avg: ${formatRupiah(Math.round(avgExpense))}/hari\n\n` +
            `💼 Saldo: *${formatRupiah(balance)}*`;

        await ctx.replyWithMediaGroup([
            {
                type: "photo",
                media: new InputFile(mainBuffer, "dashboard-harian.png"),
                caption,
                parse_mode: "Markdown"
            },
            {
                type: "photo",
                media: new InputFile(catBuffer, "kategori-harian.png")
            }
        ]);
    } catch (error) {
        console.error("Grafik Harian Error:", error);
        await ctx.reply(`Gagal membuat grafik harian.\n${error.message}`);
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

    const labels = months;
    const incomeData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);

    for (const t of transactions) {
        const d = new Date(t.date);
        if (d.getFullYear() !== year) continue;
        if (t.type === "income") incomeData[d.getMonth()] += t.amount;
        if (t.type === "expense") expenseData[d.getMonth()] += t.amount;
    }

    // Summary
    const totalIncome = incomeData.reduce((a, b) => a + b, 0);
    const totalExpense = expenseData.reduce((a, b) => a + b, 0);
    const balance = totalIncome - totalExpense;

    // Pengeluaran hari ini
    const today = new Date();
    let todayExpense = 0;
    for (const t of transactions) {
        const d = new Date(t.date);
        if (
            t.type === "expense" &&
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()
        ) {
            todayExpense += t.amount;
        }
    }

    const categoryMap = finance.getExpenseByCategory
        ? finance.getExpenseByCategory(userId)
        : {};

    try {
        const {
            createMainDashboardChart,
            createCategoryChart
        } = require("./finance/chart");

        const mainBuffer = await createMainDashboardChart({
            labels,
            incomeData,
            expenseData,
            summary: {
                balance,
                income: totalIncome,
                expense: totalExpense,
                todayExpense
            },
            title: `Dashboard Keuangan ${year}`
        });

        const catBuffer = await createCategoryChart({
            categoryMap,
            title: "Kategori Pengeluaran"
        });

        const monthsWithIncome = incomeData.filter(v => v > 0).length || 1;
        const monthsWithExpense = expenseData.filter(v => v > 0).length || 1;
        const avgIncome = totalIncome / monthsWithIncome;
        const avgExpense = totalExpense / monthsWithExpense;

        const caption =
            `📊 *DASHBOARD KEUANGAN ${year}*\n\n` +
            `💰 Pemasukan: *${formatRupiah(totalIncome)}*\n` +
            `   Avg: ${formatRupiah(Math.round(avgIncome))}/bulan\n\n` +
            `💸 Pengeluaran: *${formatRupiah(totalExpense)}*\n` +
            `   Avg: ${formatRupiah(Math.round(avgExpense))}/bulan\n\n` +
            `💼 Saldo: *${formatRupiah(balance)}*\n` +
            `📅 Keluar hari ini: *${formatRupiah(todayExpense)}*`;

        await ctx.replyWithMediaGroup([
            {
                type: "photo",
                media: new InputFile(mainBuffer, "dashboard.png"),
                caption,
                parse_mode: "Markdown"
            },
            {
                type: "photo",
                media: new InputFile(catBuffer, "kategori.png")
            }
        ]);
    } catch (error) {
        console.error("Grafik Bulanan Error:", error);
        await ctx.reply(`Gagal membuat grafik.\n${error.message}`);
    }
});

// ========================================
// ERROR HANDLER
// ========================================

bot.catch((error) => {
    console.error(
        "Finance Bot Error:",
        error.error || error
    );
});

// ========================================
// START BOT
// ========================================

bot.start();

console.log("Finance Bot berjalan...");