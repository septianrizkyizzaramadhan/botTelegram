const { MONSTERS, getBossForLevel, RARITY_CONFIG } = require("./data");

const {
  getProfile,
  updateProfile,
  addXP
} = require("./profile");

const { addKill } = require("./quest");

// ================= CONFIG =================

const GRIND_COOLDOWN = 5000;
const ENERGY_COST = 1;
const CRIT_CHANCE = 0.10;   // 10% chance
const CRIT_MULTIPLIER = 2;  // 2x reward

// Rarity multiplier (bonus tambahan dari base reward)
const RARITY_MULTIPLIERS = {
  common: 1.0,
  uncommon: 1.2,
  rare: 1.5,
  epic: 2.0,
  legendary: 3.0,
  mythic: 5.0
};

// ================= HELPER =================

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Cari monster yang cocok dengan level player
function getMonstersForLevel(level) {
  return MONSTERS.filter(
    m => level >= m.minLevel && level <= (m.maxLevel || 999)
  );
}

// Weighted random berdasarkan spawnChance
function getRandomMonster(level) {
  const pool = getMonstersForLevel(level);

  // Fallback kalau tidak ada yang cocok
  if (pool.length === 0) {
    const fallback = MONSTERS
      .filter(m => m.minLevel <= level)
      .sort((a, b) => b.minLevel - a.minLevel);
    const m = fallback[0] || MONSTERS[0];
    return {
      monster: m,
      rarity: RARITY_CONFIG[m.rarity] || RARITY_CONFIG.common
    };
  }

  // Hitung total spawn chance
  const totalChance = pool.reduce((sum, m) => sum + (m.spawnChance || 1), 0);

  // Roll
  let roll = Math.random() * totalChance;
  let selected = pool[0];

  for (const m of pool) {
    roll -= (m.spawnChance || 1);
    if (roll <= 0) {
      selected = m;
      break;
    }
  }

  return {
    monster: selected,
    rarity: RARITY_CONFIG[selected.rarity] || RARITY_CONFIG.common
  };
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
  const boss = getBossForLevel(profile.level);

  let monster;
  let isBoss = false;
  let energyCost = ENERGY_COST;
  let rarity;

  if (boss) {
    monster = boss;
    isBoss = true;
    energyCost = boss.energyCost || 3;
    rarity = { label: "Boss", emoji: "👑" };
  } else {
    const result = getRandomMonster(profile.level);
    monster = result.monster;
    rarity = result.rarity;
  }

  // Cek energy cukup
  if (profile.energy < energyCost) {
    return {
      success: false,
      type: "energy",
      message: `Energy tidak cukup (butuh ${energyCost}).`
    };
  }

  // ================= REWARD =================
  let xp = randomNumber(monster.xp[0], monster.xp[1]);
  let coin = randomNumber(monster.coin[0], monster.coin[1]);

  // Rarity multiplier
  const rarityMult = RARITY_MULTIPLIERS[monster.rarity] || 1.0;
  xp = Math.round(xp * rarityMult);
  coin = Math.round(coin * rarityMult);

  // Critical hit
  let isCrit = false;
  if (Math.random() < CRIT_CHANCE) {
    isCrit = true;
    xp *= CRIT_MULTIPLIER;
    coin *= CRIT_MULTIPLIER;
  }

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
    isCrit,
    monster: {
      id: monster.id,
      name: monster.name,
      rarity: monster.rarity || "boss"
    },
    rarity,
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

  const boss = getBossForLevel(profile.level);

  return {
    energy: profile.energy,
    maxEnergy: profile.maxEnergy,
    cooldownRemaining,
    bossAvailable: !!boss,
    boss: boss
      ? { id: boss.id, name: boss.name, energyCost: boss.energyCost }
      : null,
    canGrind:
      profile.energy >= ENERGY_COST && cooldownRemaining === 0
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
  ENERGY_COST,
  CRIT_CHANCE,
  RARITY_MULTIPLIERS
};