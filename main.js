const { fork } = require("child_process");
const path = require("path");
require("dotenv").config();

console.log("🚀 Memulai menjalankan semua bot...\n");

function startBot(scriptPath, botName) {
  console.log(`[${botName}] Menjalankan script...`);
  
  const child = fork(scriptPath, [], { env: process.env });

  child.on("exit", (code) => {
    console.error(`[${botName}] Terhenti dengan exit code ${code}. Merestart dalam 5 detik...`);
    setTimeout(() => startBot(scriptPath, botName), 5000);
  });
}

// Fix: Ganti "botStorage.js" ke "botTele.js"
startBot(path.join(__dirname, "botTele.js"), "Bot Storage");
startBot(path.join(__dirname, "gameTele.js"), "Bot Game");
startBot(path.join(__dirname, "financeTele.js"), "Bot Notes");