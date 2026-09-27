const { loadData, saveData, getUser } = require("./storage");

function addTransaction(userId, type, amount, category, note = "") {
    if (!["income", "expense"].includes(type)) {
        throw new Error("Tipe transaksi tidak valid.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Jumlah harus lebih dari 0.");
    }

    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            transactions: []
        };
    }

    const transaction = {
        id: Date.now().toString(),
        type,
        amount,
        category: category || "Lainnya",
        note: note || "",
        date: new Date().toISOString()
    };

    data[userId].transactions.push(transaction);

    saveData(data);

    return transaction;
}

function getTransactions(userId) {
    const user = getUser(userId);

    return [...user.transactions].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    );
}

function deleteTransaction(userId, transactionId) {
    const data = loadData();

    if (!data[userId]) {
        return false;
    }

    const before = data[userId].transactions.length;

    data[userId].transactions =
        data[userId].transactions.filter(
            transaction => transaction.id !== transactionId
        );

    saveData(data);

    return data[userId].transactions.length < before;
}

module.exports = {
    addTransaction,
    getTransactions,
    deleteTransaction
};