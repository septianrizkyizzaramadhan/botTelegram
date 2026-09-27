require("dotenv").config();

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Environment variable ${name} belum diatur`
    );
  }

  return value;
}

function requiredNumber(name) {
  const value = Number(required(name));

  if (!Number.isInteger(value)) {
    throw new Error(
      `${name} harus berupa angka`
    );
  }

  return value;
}

module.exports = {
  bots: {
    storage: {
      token: required("BOT_TOKEN_PENYIMPANAN"),
    },

    game: {
      token: required("BOT_TOKEN_GAME"),
    },
  },

  topics: {
    upload: requiredNumber("TOPIC_UPLOAD"),
    pdf: requiredNumber("TOPIC_PDF"),
    image: requiredNumber("TOPIC_IMG"),
    video: requiredNumber("TOPIC_VIDEO"),
    game: requiredNumber("TOPIC_GAME"),
    audio: requiredNumber("TOPIC_AUDIO"),
    doc: requiredNumber("TOPIC_DOC"),
    archive: requiredNumber("TOPIC_ARCHIVE")
  },

  database: {
    balancesFile:
      process.env.BALANCES_FILE || "balances.json",
  },

  app: {
    restartDelay:
      Number(process.env.RESTART_DELAY || 5000),
  },
};