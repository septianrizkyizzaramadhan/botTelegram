const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "dataGame.json");

function loadData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, "{}");
    }

    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (error) {
    console.error("Gagal membaca data game:", error);
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function createDefaultProfile() {
  return {
    level: 1,
    xp: 0,
    coin: 100,

    energy: 20,
    maxEnergy: 20,

    stats: {
      attack: 5,
      defense: 3
    },

    inventory: {
      slime_core: 0,
      goblin_ear: 0,
      wolf_fang: 0,
      orc_tooth: 0,
      dragon_scale: 0,
      small_potion: 0,
      xp_potion: 0
    },

    equipment: {
      weapon: "wooden_sword",
      armor: "cloth_armor"
    },

    bagSlots: 20,

    quest: {
      kills: 0,
      rewardClaimed: false
    },

    lastGrind: 0
  };
}

function getProfile(userId) {
  const data = loadData();

  if (!data[userId]) {
    data[userId] = createDefaultProfile();
    saveData(data);
  }

  return data[userId];
}

function updateProfile(userId, profile) {
  const data = loadData();

  data[userId] = profile;

  saveData(data);
}

function getRequiredXP(level) {
  return level * 100;
}

function addXP(userId, amount) {
  const profile = getProfile(userId);

  profile.xp += amount;

  let levelUps = 0;

  while (profile.xp >= getRequiredXP(profile.level)) {
    profile.xp -= getRequiredXP(profile.level);

    profile.level++;
    levelUps++;

    profile.stats.attack += 2;
    profile.stats.defense += 1;

    profile.maxEnergy += 2;
    profile.energy = profile.maxEnergy;
  }

  updateProfile(userId, profile);

  return {
    profile,
    levelUps
  };
}

module.exports = {
  loadData,
  saveData,
  createDefaultProfile,
  getProfile,
  updateProfile,
  getRequiredXP,
  addXP
};