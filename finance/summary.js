const { getTransactions } = require("./transaction");

function getSummary(userId) {
    const transactions = getTransactions(userId);

    let income = 0;
    let expense = 0;

    for (const transaction of transactions) {
        if (transaction.type === "income") {
            income += transaction.amount;
        }

        if (transaction.type === "expense") {
            expense += transaction.amount;
        }
    }

    return {
        income,
        expense,
        balance: income - expense
    };
}

function getMonthlySummary(userId, year, month) {
    const transactions = getTransactions(userId);

    let income = 0;
    let expense = 0;

    const categories = {};

    for (const transaction of transactions) {
        const date = new Date(transaction.date);

        if (
            date.getFullYear() !== year ||
            date.getMonth() + 1 !== month
        ) {
            continue;
        }

        if (transaction.type === "income") {
            income += transaction.amount;
        }

        if (transaction.type === "expense") {
            expense += transaction.amount;

            categories[transaction.category] =
                (categories[transaction.category] || 0) +
                transaction.amount;
        }
    }

    return {
        income,
        expense,
        balance: income - expense,
        categories
    };
}

// ================= TAMBAHAN BARU =================
function getExpenseByCategory(userId) {
    const transactions = getTransactions(userId);
    const map = {};

    for (const t of transactions) {
        if (t.type !== "expense") continue;
        const cat = t.category || "Lainnya";
        map[cat] = (map[cat] || 0) + t.amount;
    }

    return map;
}

module.exports = {
    getSummary,
    getMonthlySummary,
    getExpenseByCategory   // ← tambahkan ini
};