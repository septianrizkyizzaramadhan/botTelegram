const { Bot } = require("grammy");
const config = require("./config/config");

// ================= CONFIG =================

const bot = new Bot(config.bots.storage.token);

const {
  upload: TOPIC_UPLOAD,
  pdf: TOPIC_PDF,
  image: TOPIC_IMG,
  video: TOPIC_VIDEO,
  audio: TOPIC_AUDIO,     // ← tambah di config.js
  doc: TOPIC_DOC,         // ← tambah di config.js (buat docx, xlsx, dll)
  archive: TOPIC_ARCHIVE, // ← tambah di config.js (buat zip, rar, dll)
} = config.topics;

// ================= HELPER: DETEKSI TIPE FILE =================

/**
 * Mapping MIME type → topic tujuan.
 * Tambah baris baru kalau mau support tipe lain.
 */
function detectFileType(msg) {
  // ---------- VIDEO ----------
  if (msg.video) {
    return { type: "Video", topic: TOPIC_VIDEO };
  }

  // ---------- AUDIO (mp3, m4a, ogg, dll) ----------
  if (msg.audio) {
    return { type: "Audio", topic: TOPIC_AUDIO };
  }

  // ---------- VOICE NOTE ----------
  if (msg.voice) {
    return { type: "Voice Note", topic: TOPIC_AUDIO };
  }

  // ---------- FOTO ----------
  if (msg.photo) {
    return { type: "Foto", topic: TOPIC_IMG };
  }

  // ---------- DOCUMENT ----------
  if (msg.document) {
    const doc = msg.document;
    const mime = (doc.mime_type || "").toLowerCase();
    const fileName = (doc.file_name || "").toLowerCase();

    // Video mp4 yang dikirim sebagai document
    if (mime === "video/mp4" || fileName.endsWith(".mp4")) {
      return { type: "Video MP4", topic: TOPIC_VIDEO };
    }

    // Audio sebagai document (mp3, m4a, wav, dll)
    if (
      mime.startsWith("audio/") ||
      fileName.endsWith(".mp3") ||
      fileName.endsWith(".m4a") ||
      fileName.endsWith(".wav") ||
      fileName.endsWith(".ogg") ||
      fileName.endsWith(".flac")
    ) {
      return { type: "Audio File", topic: TOPIC_AUDIO };
    }

    // PDF
    if (mime === "application/pdf" || fileName.endsWith(".pdf")) {
      return { type: "PDF", topic: TOPIC_PDF };
    }

    // Image (jpg, png, webp sebagai document)
    if (
      mime.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(fileName)
    ) {
      return { type: "Image File", topic: TOPIC_IMG };
    }

    // Office documents (docx, xlsx, pptx)
    if (
      mime.includes("wordprocessingml") ||   // .docx
      mime.includes("spreadsheetml") ||       // .xlsx
      mime.includes("presentationml") ||      // .pptx
      mime === "application/msword" ||        // .doc
      mime === "application/vnd.ms-excel" ||  // .xls
      mime === "application/vnd.ms-powerpoint" || // .ppt
      /\.(docx|doc|xlsx|xls|pptx|ppt)$/i.test(fileName)
    ) {
      return { type: "Office Document", topic: TOPIC_DOC };
    }

    // Archive (zip, rar, 7z, tar, gz)
    if (
      mime.includes("zip") ||
      mime.includes("rar") ||
      mime.includes("7z") ||
      mime.includes("tar") ||
      mime.includes("gzip") ||
      /\.(zip|rar|7z|tar|gz|bz2)$/i.test(fileName)
    ) {
      return { type: "Archive", topic: TOPIC_ARCHIVE };
    }

    // Text files (txt, md, csv, json, dll)
    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/xml" ||
      /\.(txt|md|csv|json|xml|log)$/i.test(fileName)
    ) {
      return { type: "Text File", topic: TOPIC_DOC };
    }

    // Default: semua document lain masuk ke PDF/Doc topic
    return { type: "Dokumen", topic: TOPIC_PDF };
  }

  // ---------- TIDAK DIDUKUNG ----------
  return null;
}

// ================= MESSAGE HANDLER =================

bot.on("message", async (ctx) => {
  const msg = ctx.message;

  console.log("\n--- PESAN MASUK ---");
  console.log("Thread ID:", msg.message_thread_id);
  console.log("Upload Topic:", TOPIC_UPLOAD);

  // ================= CEK TOPIC =================

  if (msg.message_thread_id !== TOPIC_UPLOAD) {
    console.log("-> Pesan diabaikan: bukan topic Upload.");
    return;
  }

  console.log("-> Pesan VALID di topic Upload!");

  // ================= DETEKSI TIPE =================

  const detected = detectFileType(msg);

  if (!detected) {
    console.log("-> Tipe pesan tidak didukung.");
    return;
  }

  const { type: fileType, topic: targetTopicId } = detected;

  console.log(`-> Tipe terdeteksi: ${fileType}`);
  console.log(`-> Target topic: ${targetTopicId}`);

  if (!targetTopicId) {
    console.error(`-> Target topic untuk ${fileType} tidak ada di config.`);
    return;
  }

  // ================= COPY MESSAGE =================

  try {
    console.log(`-> Menyalin ${fileType} ke topic ${targetTopicId}...`);

    await ctx.api.copyMessage(
      ctx.chat.id,
      ctx.chat.id,
      msg.message_id,
      { message_thread_id: targetTopicId }
    );

    // ================= REPLY =================

    await ctx.reply(
      `✅ Berhasil upload ${fileType} ke topic!`,
      {
        reply_parameters: { message_id: msg.message_id }
      }
    );

    console.log(`[BERHASIL] ${fileType} → Topic ${targetTopicId}`);

  } catch (error) {
    console.error("[ERROR API TELEGRAM]:", error.message);
  }
});

// ================= GLOBAL ERROR HANDLER =================

bot.catch((err) => {
  console.error("❌ Grammy Error:", err.error);
});

// ================= START =================

console.log("Bot penyimpanan berjalan...");

bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot aktif sebagai @${botInfo.username}`);
  },
});