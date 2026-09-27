# 🤖 Multi-Feature Telegram Bot Engine

Proyek ini adalah sistem **Telegram Bot Multi-Instance** berbasis Node.js yang berjalan menggunakan framework [grammY](https://grammy.dev/). Sistem ini mengintegrasikan dua fungsi utama dalam satu manajemen *child process*: **Auto-Sorting File Storage** dan **Real-Time Crypto Trading Simulator & Interactive Mini Games** untuk Telegram Supergroup Topics.

---

## 🌟 Fitur Utama

### 1. 📦 Storage Auto-Sorting Bot (`botTele.js`)
* **Auto Forward/Copy:** Mendeteksi file yang diunggah ke *Topik Upload* spesifik dan menyalinnya secara otomatis ke topik tujuan yang sesuai.
* **Smart File Categorization:**
  * 📄 **Document/PDF** $\rightarrow$ Topik PDF
  * 🖼️ **Photo/Image** $\rightarrow$ Topik Foto
  * 🎥 **Video/MP4** $\rightarrow$ Topik Video
* **Auto Reply Confirmation:** Memberikan notifikasi saat media berhasil dipindahkan.

### 2. 🎮 Interactive Trading & Mini Games Bot (`gameTele.js`)
* **📊 Real-Time Candlestick Charting:** Simulasi pasar kripto BTC/USDT yang menghasilkan grafik *Candlestick* dinamis via QuickChart API.
* **📈 Leverage & Margin Trading:** Fitur Open LONG/SHORT, penyesuaian Stop Loss (SL), Take Profit (TP), kalkulasi PnL dinamis, dan sistem otomatis *Liquidation*.
* **🎰 Interactive Telegram Mini Games:**
  * 🎰 **Slot Machine** (Sistem Multiplier Jackpot)
  * 🎲 **Dice Roller** (Sistem Taruhan Angka)
  * 🎯 **Darts Arena** (Bullseye Multiplier)
* **💰 Local Balance Engine:** Menggunakan sistem penyimpanan saldo lokal (`balances.json`).

### 3. 🚀 Multi-Process Architecture (`main.js`)
* Memanfaatkan Node.js `child_process.fork()` untuk menjalankan beberapa bot secara paralel dalam satu alur eksekusi (`npm start`).
* **Auto-Restart Recovery:** Menjaga uptime bot dengan melakukan restart otomatis jika terjadi eror/crash pada salah satu instance.

---

## 🛠️ Teknologi & Stack

* **Runtime:** Node.js (v20+)
* **Framework Bot:** grammY
* **Process Manager:** Node.js `child_process`
* **Chart Engine:** QuickChart API
* **Environment Config:** `dotenv`

---

## ⚙️ Panduan Instalasi & Penggunaan

### 1. Clone Repositori
```bash
git clone [https://github.com/USERNAME_KAMU/NAMA_REPO_KAMU.git](https://github.com/USERNAME_KAMU/NAMA_REPO_KAMU.git)
cd NAMA_REPO_KAMU