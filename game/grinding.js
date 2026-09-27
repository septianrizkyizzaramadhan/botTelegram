const { MONSTERS, getBossForLevel } = require("./data");

const {
  getProfile,
  updateProfile,
  addXP
} = require("./profile");

const { addKill } = require("./quest");

// ================= CONFIG =================

const GRIND_COOLDOWN = 5000;
const ENERGY_COST = 1;

// ================= HELPER =================

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Cari monster yang cocok dengan level player
// (minLevel <= level <= maxLevel)
function getMonstersForLevel(level) {
  return MONSTERS.filter(
    m => level >= m.minLevel && level <= (m.maxLevel || 999)
  );
}

function getRandomMonster(level) {
  const pool = getMonstersForLevel(level);

  // Fallback: kalau tidak ada yang cocok, ambil yang minLevel <= level terdekat
  if (pool.length === 0) {
    const fallback = MONSTERS
      .filter(m => m.minLevel <= level)
      .sort((a, b) => b.minLevel - a.minLevel);
    return fallback[0] || MONSTERS[0];
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// ================= GRIND =================

function grind(userId) {
  const profile = getProfile(userId);
  const now = Date.now();

  // ================= COOLDOWN =================
  const cooldownRemaining = GRIND_COOLDOWN - (now - profile.lastGrind);

  if (cooldownRemaining > 0) {
    return {
      success: false,
      type: "cooldown",
      remaining: cooldownRemaining
    };
  }

  // ================= ENERGY =================
  if (profile.energy < ENERGY_COST) {
    return {
      success: false,
      type: "energy",
      message: "Energy kamu tidak cukup."
    };
  }

  // ================= TENTUKAN LAWAN =================
  // Boss muncul kalau level kelipatan 10 → 100% boss fight
  const boss = getBossForLevel(profile.level);

  let monster;
  let isBoss = false;
  let energyCost = ENERGY_COST;

  if (boss) {
    monster = boss;
    isBoss = true;
    energyCost = boss.energyCost || 3;
  } else {
    monster = getRandomMonster(profile.level);
  }

  // Cek energy cukup untuk boss
  if (profile.energy < energyCost) {
    return {
      success: false,
      type: "energy",
      message: `Energy tidak cukup untuk lawan Boss (butuh ${energyCost}).`
    };
  }

  // ================= REWARD =================
  const xp = randomNumber(monster.xp[0], monster.xp[1]);
  const coin = randomNumber(monster.coin[0], monster.coin[1]);

  // ================= UPDATE PROFILE =================
  profile.energy -= energyCost;
  profile.coin += coin;
  profile.lastGrind = now;

  // ================= LOOT =================
  let droppedItem = null;

  if (Math.random() < monster.dropChance) {
    droppedItem = monster.drop;
    if (!profile.inventory[droppedItem]) {
      profile.inventory[droppedItem] = 0;
    }
    profile.inventory[droppedItem]++;
  }

  updateProfile(userId, profile);

  // ================= XP =================
  const xpResult = addXP(userId, xp);

  // ================= DAILY QUEST =================
  const quest = addKill(userId);

  // ================= FINAL PROFILE =================
  const finalProfile = getProfile(userId);

  // ================= RESULT =================
  return {
    success: true,
    isBoss,
    monster: {
      id: monster.id,
      name: monster.name
    },
    xp,
    coin,
    droppedItem,
    energyCost,
    levelUps: xpResult.levelUps,
    quest: {
      kills: quest.kills
    },
    profile: finalProfile
  };
}

// ================= GRIND STATUS =================

function getGrindingStatus(userId) {
  const profile = getProfile(userId);
  const now = Date.now();

  const cooldownRemaining = Math.max(
    0,
    GRIND_COOLDOWN - (now - profile.lastGrind)
  );

  // Info boss
  const boss = getBossForLevel(profile.level);

  return {
    energy: profile.energy,
    maxEnergy: profile.maxEnergy,
    cooldownRemaining,
    bossAvailable: !!boss,
    boss: boss ? { id: boss.id, name: boss.name, energyCost: boss.energyCost } : null,
    canGrind:
      profile.energy >= ENERGY_COST &&
      cooldownRemaining === 0
  };
}

// ================= ENERGY =================

function restoreEnergy(userId) {
  const profile = getProfile(userId);
  profile.energy = profile.maxEnergy;
  updateProfile(userId, profile);
  return profile;
}

// ================= EXPORT =================

module.exports = {
  grind,
  getGrindingStatus,
  restoreEnergy,
  getRandomMonster,
  getMonstersForLevel,
  GRIND_COOLDOWN,
  ENERGY_COST
};