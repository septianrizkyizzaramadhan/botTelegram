const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "finance.json");

function ensureFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
    }
}

function loadData() {
    ensureFile();

    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveData(data) {
    ensureFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(userId) {
    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            transactions: []
        };

        saveData(data);
    }

    return data[userId];
}

module.exports = {
    loadData,
    saveData,
    getUser
};