const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

// ================= HELPER =================

function formatRupiahShort(value) {
    if (value >= 1_000_000_000) return "Rp" + (value / 1_000_000_000).toFixed(1) + "M";
    if (value >= 1_000_000) return "Rp" + (value / 1_000_000).toFixed(1) + "jt";
    if (value >= 1_000) return "Rp" + (value / 1_000).toFixed(0) + "rb";
    return "Rp" + value;
}

function formatRupiah(value) {
    return "Rp" + Number(value).toLocaleString("id-ID");
}

const CATEGORY_COLORS = [
    "#f472b6", "#a78bfa", "#60a5fa", "#34d399", "#fbbf24",
    "#fb7185", "#22d3ee", "#c084fc", "#4ade80", "#f97316"
];

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ================= PLUGIN STAT CARDS =================

function makeStatCardsPlugin(topY = 70) {
    return {
        id: "statCards",
        beforeDraw: (chart, args, opts) => {
            const { ctx } = chart;
            const data = opts?.data || {};
            const w = chart.width;
            const padding = 16;
            const gap = 12;
            const cardCount = 4;
            const cardW = (w - padding * 2 - gap * (cardCount - 1)) / cardCount;
            const cardH = 82;

            const cards = [
                { label: "SISA SALDO",      value: formatRupiah(data.balance || 0),      accent: "#22d3ee" },
                { label: "TOTAL MASUK",     value: formatRupiah(data.income || 0),       accent: "#34d399" },
                { label: "TOTAL KELUAR",    value: formatRupiah(data.expense || 0),      accent: "#fb7185" },
                { label: "KELUAR HARI INI", value: formatRupiah(data.todayExpense || 0), accent: "#fbbf24" }
            ];

            ctx.save();

            cards.forEach((c, i) => {
                const x = padding + i * (cardW + gap);
                const y = topY;

                ctx.fillStyle = "#111a2e";
                ctx.strokeStyle = "#1f2b47";
                ctx.lineWidth = 1;
                roundRect(ctx, x, y, cardW, cardH, 12);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = c.accent;
                roundRect(ctx, x, y, 4, cardH, 12);
                ctx.fill();

                ctx.fillStyle = "#7c8aa5";
                ctx.font = "600 11px sans-serif";
                ctx.textBaseline = "top";
                ctx.fillText(c.label, x + 16, y + 14);

                ctx.fillStyle = "#e6edf7";
                ctx.font = "700 18px sans-serif";
                ctx.fillText(c.value, x + 16, y + 36);
            });

            ctx.restore();
        }
    };
}

// ================= 1. DASHBOARD LINE CHART =================

async function createMainDashboardChart({
    labels,
    incomeData,
    expenseData,
    summary = {},
    title = "Dashboard Keuangan"
}) {
    const width = 1000;
    const height = 600;

    const canvas = new ChartJSNodeCanvas({
        width,
        height,
        backgroundColour: "#0b1220"
    });

    const config = {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Pemasukan",
                    data: incomeData,
                    borderColor: "#34d399",
                    backgroundColor: "rgba(52, 211, 153, 0.15)",
                    borderWidth: 3,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: "#34d399",
                    pointBorderColor: "#0b1220",
                    pointBorderWidth: 2,
                    pointRadius: 3
                },
                {
                    label: "Pengeluaran",
                    data: expenseData,
                    borderColor: "#fb7185",
                    backgroundColor: "rgba(251, 113, 133, 0.15)",
                    borderWidth: 3,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: "#fb7185",
                    pointBorderColor: "#0b1220",
                    pointBorderWidth: 2,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: false,
            animation: false,
            layout: { padding: { top: 170, left: 16, right: 16, bottom: 16 } },
            plugins: {
                title: {
                    display: true,
                    text: [
                        title,
                        `UangJajan • ${new Date().toLocaleString("id-ID", { month: "long", year: "numeric" })}`
                    ],
                    color: "#e6edf7",
                    align: "start",
                    padding: { top: 12, bottom: 4 },
                    font: [{ size: 20, weight: "700" }, { size: 12, weight: "500" }]
                },
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#cbd5e1",
                        font: { size: 12, weight: "600" },
                        usePointStyle: true,
                        pointStyle: "rectRounded",
                        padding: 14
                    }
                },
                tooltip: { enabled: false },
                statCards: {
                    data: {
                        balance: summary.balance || 0,
                        income: summary.income || 0,
                        expense: summary.expense || 0,
                        todayExpense: summary.todayExpense || 0
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#7c8aa5", font: { size: 11, weight: "600" } },
                    grid: { color: "rgba(124, 138, 165, 0.08)", drawBorder: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#7c8aa5",
                        font: { size: 11, weight: "600" },
                        callback: (v) => formatRupiahShort(v)
                    },
                    grid: { color: "rgba(124, 138, 165, 0.08)", drawBorder: false }
                }
            }
        },
        plugins: [makeStatCardsPlugin(70)]
    };

    return await canvas.renderToBuffer(config);
}

// ================= 2. DOUGHNUT KATEGORI =================

async function createCategoryChart({
    categoryMap = {},
    title = "Kategori Pengeluaran"
}) {
    const width = 700;
    const height = 620;

    const canvas = new ChartJSNodeCanvas({
        width,
        height,
        backgroundColour: "#0b1220"
    });

    const entries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    let labels = entries.map(([k]) => k);
    let values = entries.map(([, v]) => v);

    if (labels.length === 0) {
        labels = ["Belum ada data"];
        values = [1];
    }

    const colors = labels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
    const topCat = entries[0];

    const config = {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: "#0b1220",
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: false,
            animation: false,
            cutout: "62%",
            layout: { padding: { top: 16, left: 24, right: 24, bottom: 16 } },
            plugins: {
                title: {
                    display: true,
                    text: [
                        title,
                        topCat
                            ? `Terbesar: ${topCat[0]} (${formatRupiahShort(topCat[1])})`
                            : "Belum ada pengeluaran"
                    ],
                    color: "#e6edf7",
                    align: "start",
                    padding: { top: 12, bottom: 10 },
                    font: [{ size: 18, weight: "700" }, { size: 12, weight: "500" }]
                },
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#cbd5e1",
                        font: { size: 12, weight: "600" },
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 12
                    }
                },
                tooltip: { enabled: false }
            }
        }
    };

    return await canvas.renderToBuffer(config);
}

module.exports = {
    // alias biar kompatibel kalau ada kode lama
    createFinanceChart: createMainDashboardChart,
    createMainDashboardChart,
    createCategoryChart,
    formatRupiah,
    formatRupiahShort
};