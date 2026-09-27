const {
  getProfile,
  updateProfile,
  addXP
} = require("./profile");

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// ================= QUEST CONFIG =================
// Quest bertingkat: makin banyak kill, makin besar reward
const QUEST_MILESTONES = [
  { kills: 10,  coin: 300,  xp: 100 },
  { kills: 25,  coin: 800,  xp: 300 },
  { kills: 50,  coin: 1500, xp: 600 },
  { kills: 100, coin: 3500, xp: 1500 },
  { kills: 200, coin: 8000, xp: 3500 }
];

function resetDailyQuest(profile) {
  const today = getToday();

  if (!profile.quest || profile.quest.date !== today) {
    profile.quest = {
      date: today,
      kills: 0,
      claimed: [] // index milestone yang sudah di-claim
    };
  }

  if (!profile.quest.claimed) profile.quest.claimed = [];

  return profile;
}

function getQuest(userId) {
  let profile = getProfile(userId);
  profile = resetDailyQuest(profile);
  updateProfile(userId, profile);

  const kills = profile.quest.kills;
  const claimed = profile.quest.claimed || [];

  // Cari milestone berikutnya
  const nextMilestone = QUEST_MILESTONES.findIndex(
    (m, i) => kills < m.kills && !claimed.includes(i)
  );

  return {
    kills,
    milestones: QUEST_MILESTONES.map((m, i) => ({
      ...m,
      index: i,
      reached: kills >= m.kills,
      claimed: claimed.includes(i)
    })),
    nextMilestone:
      nextMilestone >= 0 ? QUEST_MILESTONES[nextMilestone] : null,
    allDone: claimed.length === QUEST_MILESTONES.length
  };
}

function addKill(userId) {
  let profile = getProfile(userId);
  profile = resetDailyQuest(profile);

  profile.quest.kills++;
  updateProfile(userId, profile);

  return profile.quest;
}

function claimQuestReward(userId, milestoneIndex) {
  let profile = getProfile(userId);
  profile = resetDailyQuest(profile);

  const milestone = QUEST_MILESTONES[milestoneIndex];

  if (!milestone) {
    return { success: false, message: "Milestone tidak valid." };
  }

  if (profile.quest.kills < milestone.kills) {
    return {
      success: false,
      message: `Butuh ${milestone.kills} kill. Sekarang: ${profile.quest.kills}`
    };
  }

  if (profile.quest.claimed.includes(milestoneIndex)) {
    return { success: false, message: "Reward ini sudah diambil." };
  }

  profile.quest.claimed.push(milestoneIndex);
  profile.coin += milestone.coin;
  updateProfile(userId, profile);

  const xpResult = addXP(userId, milestone.xp);

  return {
    success: true,
    coin: milestone.coin,
    xp: milestone.xp,
    levelUps: xpResult.levelUps,
    profile: xpResult.profile
  };
}

module.exports = {
  getQuest,
  addKill,
  claimQuestReward,
  QUEST_MILESTONES
};