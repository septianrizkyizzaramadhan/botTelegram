const { SHOP_ITEMS, getItemTier } = require("./data");
const { getProfile, updateProfile } = require("./profile");

function getShopItems() {
  return SHOP_ITEMS;
}

function getShopItemsByType() {
  const result = { weapon: [], armor: [], consumable: [], bag: [] };
  for (const [id, item] of Object.entries(SHOP_ITEMS)) {
    if (result[item.type]) {
      result[item.type].push({ id, ...item });
    }
  }
  return result;
}

function buyItem(userId, itemId) {
  const profile = getProfile(userId);
  const item = SHOP_ITEMS[itemId];

  if (!item) {
    return { success: false, message: "Item tidak ditemukan." };
  }

  // Cek duplikat equipment
  if (item.type === "weapon" && profile.equipment.weapon === itemId) {
    return { success: false, message: "Kamu sudah punya weapon ini!" };
  }
  if (item.type === "armor" && profile.equipment.armor === itemId) {
    return { success: false, message: "Kamu sudah punya armor ini!" };
  }

  if (profile.coin < item.price) {
    return { success: false, message: "Coin kamu tidak cukup." };
  }

  profile.coin -= item.price;

  if (item.type === "weapon") {
    profile.equipment.weapon = itemId;
    profile.stats.attack = 5 + item.attack;
  } else if (item.type === "armor") {
    profile.equipment.armor = itemId;
    profile.stats.defense = 3 + item.defense;
  } else if (item.type === "consumable") {
    if (!profile.inventory[itemId]) profile.inventory[itemId] = 0;
    profile.inventory[itemId]++;
  } else if (item.type === "bag") {
    profile.bagSlots += item.slots;
  }

  updateProfile(userId, profile);

  return { success: true, item, profile };
}

function useItem(userId, itemId) {
  const profile = getProfile(userId);

  if (!profile.inventory[itemId]) {
    return { success: false, message: "Item tidak ada di inventory." };
  }

  const item = SHOP_ITEMS[itemId];

  if (!item || item.type !== "consumable") {
    return { success: false, message: "Item ini tidak bisa digunakan." };
  }

  if (item.heal) {
    profile.energy = Math.min(profile.maxEnergy, profile.energy + item.heal);
  }

  if (item.xp) {
    profile.xp += item.xp;
  }

  profile.inventory[itemId]--;

  if (profile.inventory[itemId] <= 0) {
    delete profile.inventory[itemId];
  }

  updateProfile(userId, profile);

  return { success: true, profile };
}

module.exports = {
  getShopItems,
  getShopItemsByType,
  buyItem,
  useItem
};