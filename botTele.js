require("dotenv").config();
const { Bot } = require("grammy");


const bot = new Bot(process.env.BOT_TOKEN_PENYIMPANAN);

const TOPIC_UPLOAD = Number(process.env.TOPIC_UPLOAD);
const TOPIC_PDF = Number(process.env.TOPIC_PDF);
const TOPIC_IMG = Number(process.env.TOPIC_IMG);
const TOPIC_MP4 = Number(process.env.TOPIC_VIDEO);


bot.on("message", async (ctx) => {
  const msg = ctx.message;

  // Debug 1: Cek apakah ada pesan masuk & berapa thread_id nya
  console.log("--- PESAN MASUK ---");
  console.log("Pesan berasal dari Thread ID:", msg.message_thread_id);
  console.log("ID Topik Upload yang dicari:", TOPIC_UPLOAD);

  // Cek apakah pesan ada di topik Upload
  if (msg.message_thread_id === TOPIC_UPLOAD) {
    console.log("-> Pesan VALID di topik Upload!");

    let targetTopicId = null;

    if (msg.document) {
      console.log("-> Tipe file: Dokumen (MIME:", msg.document.mime_type, ")");
      targetTopicId = TOPIC_PDF;
    }

    else if (msg.photo) {
        console.log('->Tipe file: Foto (Total resolusi yang tersedia:', msg.photo.length, ')');
        targetTopicId = TOPIC_IMG;
    }

    else if (msg.mp4) {
        console.log('-> Tipe file: Mp4 (MIME:', msg.mp4.mime_type, ')');
        targetTopicId = TOPIC_MP4
    }

    if (targetTopicId) {
      try {
        await ctx.api.copyMessage(
          ctx.chat.id,
          ctx.chat.id,
          msg.message_id,
          { message_thread_id: targetTopicId }
        );

        const replyBot = await ctx.reply(
            `Berhail upload ke topic **${targetTopicId}**!`,
            {
                reply_parameters : {message_id: msg.message_id},
                parse_mode: 'Markdown'
            }
        )

        console.log(`[BERHASIL] File disalin ke topik ID: ${targetTopicId}`);
      } catch (error) {
        console.error("[ERROR API Telegram]:", error.message);
      }
    }
  } else {
    console.log("-> Pesan diabaikan karena bukan di topik Upload.");
  }
});

console.log("Bot berjalan...");
bot.start();