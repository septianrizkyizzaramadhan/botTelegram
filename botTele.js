const { Bot } = require("grammy");
const config = require("./config/config");

// ================= CONFIG =================

const bot = new Bot(config.bots.storage.token);

const {
  upload: TOPIC_UPLOAD,
  pdf: TOPIC_PDF,
  image: TOPIC_IMG,
  video: TOPIC_VIDEO,
} = config.topics;

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

  let targetTopicId = null;
  let fileType = null;

  // ================= VIDEO =================

  if (msg.video) {
    fileType = "Video";
    targetTopicId = TOPIC_VIDEO;

    console.log("-> Tipe: Video");
    console.log(
      "-> MIME:",
      msg.video.mime_type || "tidak diketahui"
    );
  }

  // ================= MP4 SEBAGAI DOCUMENT =================

  else if (
    msg.document &&
    msg.document.mime_type === "video/mp4"
  ) {
    fileType = "Video MP4";
    targetTopicId = TOPIC_VIDEO;

    console.log("-> Tipe: Video MP4 sebagai Document");
    console.log("-> MIME:", msg.document.mime_type);
  }

  // ================= FOTO =================

  else if (msg.photo) {
    fileType = "Foto";
    targetTopicId = TOPIC_IMG;

    console.log("-> Tipe: Foto");
    console.log("-> Jumlah resolusi:", msg.photo.length);
  }

  // ================= DOCUMENT =================

  else if (msg.document) {
    fileType = "Dokumen";
    targetTopicId = TOPIC_PDF;

    console.log("-> Tipe: Dokumen");
    console.log(
      "-> MIME:",
      msg.document.mime_type || "tidak diketahui"
    );
  }

  // ================= TIDAK DIDUKUNG =================

  else {
    console.log("-> Tipe pesan tidak didukung.");
    return;
  }

  // ================= VALIDASI TARGET =================

  if (!targetTopicId) {
    console.error(
      `-> Target topic untuk ${fileType} tidak ditemukan.`
    );
    return;
  }

  // ================= COPY MESSAGE =================

  try {
    console.log(
      `-> Menyalin ${fileType} ke topic ${targetTopicId}...`
    );

    await ctx.api.copyMessage(
      ctx.chat.id,
      ctx.chat.id,
      msg.message_id,
      {
        message_thread_id: targetTopicId,
      }
    );

    // ================= REPLY =================

    await ctx.reply(
      `Berhasil upload ${fileType} ke topic!`,
      {
        reply_parameters: {
          message_id: msg.message_id,
        },
      }
    );

    console.log(
      `[BERHASIL] ${fileType} → Topic ${targetTopicId}`
    );

  } catch (error) {
    console.error(
      "[ERROR API TELEGRAM]:",
      error.message
    );
  }
});

// ================= GLOBAL ERROR HANDLER =================

bot.catch((err) => {
  console.error(
    "❌ Grammy Error:",
    err.error
  );
});

// ================= START =================

console.log("Bot penyimpanan berjalan...");

bot.start({
  onStart: (botInfo) => {
    console.log(
      `✅ Bot aktif sebagai @${botInfo.username}`
    );
  },
});