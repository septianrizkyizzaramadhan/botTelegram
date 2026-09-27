const MONSTERS = [
  {
    id: "slime",
    name: "Slime",
    minLevel: 1,
    maxLevel: 3,
    xp: [20, 35],
    coin: [15, 30],
    drop: "slime_core",
    dropChance: 0.35
  },
  {
    id: "goblin",
    name: "Goblin",
    minLevel: 2,
    maxLevel: 5,
    xp: [30, 50],
    coin: [25, 45],
    drop: "goblin_ear",
    dropChance: 0.3
  },
  {
    id: "wolf",
    name: "Wolf",
    minLevel: 4,
    maxLevel: 8,
    xp: [45, 70],
    coin: [40, 65],
    drop: "wolf_fang",
    dropChance: 0.25
  },
  {
    id: "orc",
    name: "Orc",
    minLevel: 7,
    maxLevel: 12,
    xp: [70, 100],
    coin: [65, 100],
    drop: "orc_tooth",
    dropChance: 0.2
  },
  {
    id: "dragon",
    name: "Dragon",
    minLevel: 12,
    maxLevel: 20,
    xp: [120, 180],
    coin: [120, 200],
    drop: "dragon_scale",
    dropChance: 0.15
  },
  {
    id: "demon",
    name: "Demon",
    minLevel: 20,
    maxLevel: 30,
    xp: [200, 280],
    coin: [180, 260],
    drop: "demon_horn",
    dropChance: 0.12
  }
];

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

const SHOP_ITEMS = {
  iron_sword: { name: "Iron Sword", type: "weapon", price: 500, attack: 10 },
  steel_armor: { name: "Steel Armor", type: "armor", price: 900, defense: 12 },
  small_potion: { name: "Small Potion", type: "consumable", price: 150, heal: 30 },
  xp_potion: { name: "XP Potion", type: "consumable", price: 300, xp: 100 },
  bag_upgrade: { name: "Bag Upgrade", type: "bag", price: 1000, slots: 5 }
};

module.exports = {
  MONSTERS,
  BOSSES,
  getBossForLevel,
  SHOP_ITEMS
};