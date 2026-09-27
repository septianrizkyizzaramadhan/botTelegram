const MONSTERS = [
  // ============ COMMON (spawn sering) ============
  {
    id: "slime",
    name: "Slime",
    minLevel: 1,
    maxLevel: 5,
    rarity: "common",
    spawnChance: 30,           // 30% chance
    xp: [15, 30],
    coin: [10, 25],
    drop: "slime_core",
    dropChance: 0.35
  },
  {
    id: "goblin",
    name: "Goblin",
    minLevel: 2,
    maxLevel: 7,
    rarity: "common",
    spawnChance: 25,
    xp: [20, 40],
    coin: [15, 35],
    drop: "goblin_ear",
    dropChance: 0.30
  },
  {
    id: "rat",
    name: "Giant Rat",
    minLevel: 1,
    maxLevel: 4,
    rarity: "common",
    spawnChance: 20,
    xp: [10, 20],
    coin: [8, 18],
    drop: "rat_tail",
    dropChance: 0.40
  },

  // ============ UNCOMMON ============
  {
    id: "wolf",
    name: "Wolf",
    minLevel: 4,
    maxLevel: 10,
    rarity: "uncommon",
    spawnChance: 12,
    xp: [45, 75],
    coin: [40, 70],
    drop: "wolf_fang",
    dropChance: 0.25
  },
  {
    id: "bandit",
    name: "Bandit",
    minLevel: 5,
    maxLevel: 12,
    rarity: "uncommon",
    spawnChance: 10,
    xp: [50, 85],
    coin: [55, 90],
    drop: "bandit_mask",
    dropChance: 0.22
  },

  // ============ RARE ============
  {
    id: "orc",
    name: "Orc",
    minLevel: 7,
    maxLevel: 15,
    rarity: "rare",
    spawnChance: 6,
    xp: [90, 140],
    coin: [100, 160],
    drop: "orc_tooth",
    dropChance: 0.20
  },
  {
    id: "troll",
    name: "Troll",
    minLevel: 10,
    maxLevel: 20,
    rarity: "rare",
    spawnChance: 4,
    xp: [120, 180],
    coin: [140, 220],
    drop: "troll_hide",
    dropChance: 0.18
  },

  // ============ EPIC ============
  {
    id: "dragon",
    name: "Dragon",
    minLevel: 12,
    maxLevel: 25,
    rarity: "epic",
    spawnChance: 2,
    xp: [300, 450],
    coin: [350, 550],
    drop: "dragon_scale",
    dropChance: 0.15
  },
  {
    id: "demon",
    name: "Demon",
    minLevel: 18,
    maxLevel: 30,
    rarity: "epic",
    spawnChance: 1.5,
    xp: [400, 600],
    coin: [500, 750],
    drop: "demon_horn",
    dropChance: 0.12
  },

  // ============ LEGENDARY (Ultra Rare) ============
  {
    id: "phoenix",
    name: "🔥 Phoenix",
    minLevel: 20,
    maxLevel: 50,
    rarity: "legendary",
    spawnChance: 0.8,
    xp: [1500, 2500],
    coin: [2000, 3500],
    drop: "phoenix_feather",
    dropChance: 0.5
  },
  {
    id: "ancient_titan",
    name: "⭐ Ancient Titan",
    minLevel: 25,
    maxLevel: 50,
    rarity: "legendary",
    spawnChance: 0.5,
    xp: [3000, 5000],
    coin: [4000, 7000],
    drop: "titan_core",
    dropChance: 0.5
  },
  {
    id: "void_dragon",
    name: "💀 Void Dragon",
    minLevel: 30,
    maxLevel: 99,
    rarity: "mythic",
    spawnChance: 0.2,
    xp: [8000, 15000],
    coin: [10000, 20000],
    drop: "void_essence",
    dropChance: 0.7
  }
];

// ============ RARITY CONFIG ============
const RARITY_CONFIG = {
  common:    { label: "Common",    emoji: "⚪", color: "white"  },
  uncommon:  { label: "Uncommon",  emoji: "🟢", color: "green"  },
  rare:      { label: "Rare",      emoji: "🔵", color: "blue"   },
  epic:      { label: "Epic",      emoji: "🟣", color: "purple" },
  legendary: { label: "Legendary", emoji: "🟠", color: "orange" },
  mythic:    { label: "Mythic",    emoji: "🔴", color: "red"    }
};
// ================= BOSS (Tiap kelipatan 10) =================
const BOSSES = {
  10: {
    id: "boss_goblin_king",
    name: "👑 Goblin King",
    minLevel: 10,
    xp: [400, 600],
    coin: [400, 600],
    drop: "goblin_crown",
    dropChance: 0.9,
    energyCost: 3
  },
  20: {
    id: "boss_orc_warlord",
    name: "👑 Orc Warlord",
    minLevel: 20,
    xp: [900, 1200],
    coin: [900, 1200],
    drop: "warlord_axe",
    dropChance: 0.9,
    energyCost: 3
  },
  30: {
    id: "boss_dragon_lord",
    name: "👑 Dragon Lord",
    minLevel: 30,
    xp: [1800, 2400],
    coin: [1800, 2400],
    drop: "dragon_heart",
    dropChance: 0.9,
    energyCost: 4
  },
  40: {
    id: "boss_demon_overlord",
    name: "👑 Demon Overlord",
    minLevel: 40,
    xp: [3200, 4200],
    coin: [3200, 4200],
    drop: "demon_soul",
    dropChance: 0.9,
    energyCost: 4
  },
  50: {
    id: "boss_ancient_titan",
    name: "👑 Ancient Titan",
    minLevel: 50,
    xp: [5000, 7000],
    coin: [5000, 7000],
    drop: "titan_core",
    dropChance: 0.95,
    energyCost: 5
  }
};

function getBossForLevel(level) {
  // Boss muncul kalau level kelipatan 10
  if (level % 10 !== 0) return null;
  return BOSSES[level] || null;
}

// ================= SHOP ITEMS =================
const SHOP_ITEMS = {
  // ============ WEAPONS ============
  wooden_sword:   { name: "Wooden Sword",   type: "weapon", price: 100,    attack: 3,    tier: "common",    desc: "Senjata kayu sederhana" },
  iron_sword:     { name: "Iron Sword",     type: "weapon", price: 800,    attack: 10,   tier: "common",    desc: "Pedang besi standar" },
  steel_sword:    { name: "Steel Sword",    type: "weapon", price: 2_500,  attack: 20,   tier: "rare",      desc: "Pedang baja tajam" },
  katana:         { name: "Katana",         type: "weapon", price: 8_000,  attack: 35,   tier: "rare",      desc: "Katana Jepang" },
  flame_blade:    { name: "Flame Blade",    type: "weapon", price: 25_000, attack: 55,   tier: "epic",      desc: "Pedang api menyala" },
  shadow_dagger:  { name: "Shadow Dagger",  type: "weapon", price: 75_000, attack: 80,   tier: "epic",      desc: "Belati bayangan" },
  dragon_slayer:  { name: "Dragon Slayer",  type: "weapon", price: 250_000, attack: 130, tier: "legendary", desc: "Pedang pembunuh naga" },
  excalibur:      { name: "Excalibur",      type: "weapon", price: 1_000_000, attack: 250, tier: "mythic",  desc: "Pedang legendaris" },

  // ============ ARMORS ============
  cloth_armor:    { name: "Cloth Armor",    type: "armor",  price: 100,    defense: 2,    tier: "common",    desc: "Pakaian kain" },
  leather_armor:  { name: "Leather Armor",  type: "armor",  price: 700,    defense: 8,    tier: "common",    desc: "Armor kulit" },
  steel_armor:    { name: "Steel Armor",    type: "armor",  price: 2_200,  defense: 18,   tier: "rare",      desc: "Armor baja" },
  chainmail:      { name: "Chainmail",      type: "armor",  price: 7_000,  defense: 30,   tier: "rare",      desc: "Armor rantai" },
  plate_armor:    { name: "Plate Armor",    type: "armor",  price: 22_000, defense: 50,   tier: "epic",      desc: "Armor plat tebal" },
  dragon_scale_armor: { name: "Dragon Scale Armor", type: "armor", price: 80_000, defense: 80, tier: "epic", desc: "Armor sisik naga" },
  titan_armor:    { name: "Titan Armor",    type: "armor",  price: 300_000, defense: 130, tier: "legendary", desc: "Armor raksasa" },
  god_armor:      { name: "God Armor",      type: "armor",  price: 1_200_000, defense: 250, tier: "mythic",  desc: "Armor dewa" },

  // ============ CONSUMABLES ============
  small_potion:   { name: "Small Potion",   type: "consumable", price: 150,   heal: 30,   tier: "common",    desc: "Pulihkan 30 energy" },
  medium_potion:  { name: "Medium Potion",  type: "consumable", price: 400,   heal: 80,   tier: "common",    desc: "Pulihkan 80 energy" },
  large_potion:   { name: "Large Potion",   type: "consumable", price: 1_200, heal: 200,  tier: "rare",      desc: "Pulihkan 200 energy" },
  full_potion:    { name: "Full Potion",    type: "consumable", price: 5_000, heal: 999,  tier: "epic",      desc: "Pulihkan energy penuh" },

  xp_potion:      { name: "XP Potion",      type: "consumable", price: 300,   xp: 100,    tier: "common",    desc: "+100 XP" },
  xp_potion_lg:   { name: "Large XP Potion", type: "consumable", price: 1_500, xp: 500,   tier: "rare",      desc: "+500 XP" },
  xp_potion_xl:   { name: "Mega XP Potion", type: "consumable", price: 10_000, xp: 3_000, tier: "epic",      desc: "+3.000 XP" },

  // ============ BAG ============
  bag_upgrade:    { name: "Bag Upgrade",    type: "bag", price: 1_000,   slots: 5,    tier: "common",    desc: "+5 slot tas" },
  bag_upgrade_lg: { name: "Large Bag Upgrade", type: "bag", price: 5_000, slots: 20,  tier: "rare",      desc: "+20 slot tas" },
  bag_upgrade_xl: { name: "Mega Bag Upgrade",  type: "bag", price: 25_000, slots: 50, tier: "epic",      desc: "+50 slot tas" }
};

// ============ TIER CONFIG (buat tampilan) ============
const TIERS = {
  common:    { label: "Common",    icon: "⚪", color: "gray"   },
  rare:      { label: "Rare",      icon: "🔵", color: "blue"   },
  epic:      { label: "Epic",      icon: "🟣", color: "purple" },
  legendary: { label: "Legendary", icon: "🟠", color: "orange" },
  mythic:    { label: "Mythic",    icon: "🔴", color: "red"    }
};

function getItemTier(item) {
  return TIERS[item.tier] || TIERS.common;
}

module.exports = {
  MONSTERS,
  BOSSES,
  getBossForLevel,
  SHOP_ITEMS,
  TIERS,
  getItemTier,
  RARITY_CONFIG
};
