# Multi-Feature Telegram Bot Engine

Kumpulan bot Telegram yang jalan bareng dalam satu project Node.js. Pakai [grammY](https://grammy.dev/) sebagai framework-nya, dan semua instance di-manage lewat satu `main.js` pakai `child_process.fork()`.

Bot-bot ini di-design buat dipakai di **Telegram Supergroup dengan Topics** — jadi setiap fitur punya "ruangannya" sendiri.

---

##  Fitur

### 1. Storage Auto-Sorting Bot (`botTele.js`)

Bot buat ngerapihin file yang masuk ke grup.

- Upload file ke topik Upload → otomatis dipindah ke topik yang sesuai
- Kategorisasi otomatis:
  -  **Document / PDF** → topik PDF
  -  **Photo / Image** → topik Foto
  -  **Video / MP4** → topik Video
- Kirim notifikasi kalau file berhasil dipindah

---

### 2. Interactive Trading & Mini Games (`gameTele.js`)

Bot hiburan + trading simulator dalam satu topik.

** Real-Time Trading**
- Simulasi harga BTC/USDT yang gerak terus tiap 2 detik
- Candlestick chart real-time via QuickChart API
- Bisa Open **LONG** / **SHORT**
- Setting margin, leverage (sampai 50x), Stop Loss, Take Profit
- PnL dihitung otomatis, kena liquidation? ya hangus

** Mini Games**
-  **Slot Machine** — jackpot triple 777 (10x), triple match (3x)
-  **Dice Roller** — angka 4-6 menang, 2.5x
-  **Darts Arena** — bullseye 5x, skor 4-5 dapat 2x

Semua pakai sistem taruhan saldo lokal (`balances.json`).

---

### 3. RPG Adventure (`gameTele.js` → folder `game/`)

RPG turn-based yang bisa dimainkan langsung dari chat. **Mata uangnya terpisah** dari saldo trading (pakai `coin`, bukan `$`).

**Fitur utama:**
- **Grind Monster** — lawan monster sesuai level kamu. Makin tinggi level, makin kuat monsternya
- **Boss Fight** — tiap level kelipatan 10 (10, 20, 30, ...), muncul boss dengan reward gede & drop item langka
- **Daily Quest** — 5 milestone (10, 25, 50, 100, 200 kill), masing-masing bisa diklaim sekali per hari
- **Shop** — beli senjata, armor, potion, bag upgrade
- **Inventory** — lihat item, equipment, dan kapasitas tas
- **Level System** — XP bar, auto level-up, stat ATK/DEF naik tiap naik level
- **Energy System** — tiap grind butuh energy, boss butuh lebih banyak

Semua data RPG disimpan terpisah di `data/dataGame.json`.

---

### 4. Finance Tracker (`financeTele.js` → folder `finance/`)

Bot pencatatan keuangan pribadi, lengkap dengan visualisasi chart.

**Command:**
- `/pemasukan 50000 freelance` — catat pemasukan
- `/pengeluaran 15000 makan nasi` — catat pengeluaran + kategori
- `/keuangan` — lihat ringkasan (pemasukan, pengeluaran, saldo)
- `/riwayat` — 10 transaksi terakhir
- `/grafikday` — dashboard harian (chart + stat cards)
- `/grafikmonth` — dashboard bulanan

**Visualisasi:**
-  **Dashboard Chart** — line chart pemasukan vs pengeluaran + 4 stat card di atasnya (Sisa Saldo, Total Masuk, Total Keluar, Keluar Hari Ini)
-  **Donut Chart** — breakdown pengeluaran per kategori
- Tema **dark mode** biar enak dilihat di Telegram
- Dikirim sebagai album (2 gambar sekaligus)

Chart di-render pakai `chartjs-node-canvas`, bukan external API.

---

### 5. Multi-Process Architecture (`main.js`)

Semua bot di atas jalan sebagai **child process terpisah** dari satu entry point.

- Pakai `child_process.fork()`
- Kalau salah satu bot crash, dia auto-restart
- Cukup jalankan `node main.js` atau `npm start`, semua bot langsung nyala

---

## Stack

- **Runtime:** Node.js v20+
- **Framework Bot:** [grammY](https://grammy.dev/)
- **Process Manager:** Node.js `child_process.fork()`
- **Chart:**
  - `quickchart.io` (trading)
  - `chartjs-node-canvas` (finance)
- **Config:** `dotenv`
- **Storage:** JSON file (`balances.json`, `dataGame.json`, dll)

---

## Instalasi

### 1. Clone repo

```bash
git clone https://github.com/septianrizkyizzaramadhan/botTelegram.git
cd botTelegram