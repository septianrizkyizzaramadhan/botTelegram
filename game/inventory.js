const {
  getProfile,
  updateProfile
} = require("./profile");

function getInventory(userId) {
  const profile = getProfile(userId);

  return {
    inventory: profile.inventory,
    equipment: profile.equipment,
    bagSlots: profile.bagSlots
  };
}

function getInventoryCount(userId) {
  const profile = getProfile(userId);

  return Object.values(profile.inventory)
    .reduce((total, amount) => total + amount, 0);
}

function addItem(userId, itemId, amount = 1) {
  const profile = getProfile(userId);

  if (!profile.inventory[itemId]) {
    profile.inventory[itemId] = 0;
  }

  profile.inventory[itemId] += amount;

  updateProfile(userId, profile);

  return profile;
}

function removeItem(userId, itemId, amount = 1) {
  const profile = getProfile(userId);

  if (!profile.inventory[itemId]) {
    return false;
  }

  if (profile.inventory[itemId] < amount) {
    return false;
  }

  profile.inventory[itemId] -= amount;

  if (profile.inventory[itemId] <= 0) {
    delete profile.inventory[itemId];
  }

  updateProfile(userId, profile);

  return true;
}

function equipWeapon(userId, weaponId) {
  const profile = getProfile(userId);

  profile.equipment.weapon = weaponId;

  updateProfile(userId, profile);

  return profile;
}

function equipArmor(userId, armorId) {
  const profile = getProfile(userId);

  profile.equipment.armor = armorId;

  updateProfile(userId, profile);

  return profile;
}

function upgradeBag(userId, slots) {
  const profile = getProfile(userId);

  profile.bagSlots += slots;

  updateProfile(userId, profile);

  return profile;
}

module.exports = {
  getInventory,
  getInventoryCount,
  addItem,
  removeItem,
  equipWeapon,
  equipArmor,
  upgradeBag
};