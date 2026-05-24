const crypto = require('node:crypto');

const SHORT_GOAL_REWARD = 50;
const LONG_GOAL_REWARD = 200;
const HABIT_REPLACEMENT_REWARD = 1;
const REDEMPTION_MINIMUM = 30;

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function createDefaultData() {
  return {
    version: 1,
    quickNotes: [],
    goals: {
      activeShort: null,
      activeLong: null,
      backlog: [],
      completed: [],
    },
    successEntries: [],
    gratitudeEntries: [],
    mistakeEntries: [],
    habit: {
      current: null,
      records: [],
    },
    piggyBank: {
      balance: 0,
      transactions: [],
      redemptions: [],
    },
    methodologies: [],
    affirmation: {
      text: '我越来越稳定、清明、有力量',
      count: 0,
      targetCount: 100000,
      history: [],
      updatedAt: now(),
    },
  };
}

function ensureData(data) {
  const defaults = createDefaultData();
  return {
    ...defaults,
    ...data,
    goals: { ...defaults.goals, ...(data && data.goals) },
    habit: { ...defaults.habit, ...(data && data.habit) },
    piggyBank: { ...defaults.piggyBank, ...(data && data.piggyBank) },
    affirmation: { ...defaults.affirmation, ...(data && data.affirmation) },
  };
}

function addEntry(data, collection, entry) {
  if (!Array.isArray(data[collection])) {
    throw new Error(`未知记录类型: ${collection}`);
  }

  const saved = {
    id: entry.id || id(collection),
    createdAt: entry.createdAt || now(),
    updatedAt: now(),
    ...entry,
  };
  data[collection].unshift(saved);
  return saved;
}

function goalSlot(type) {
  if (type === 'short') return 'activeShort';
  if (type === 'long') return 'activeLong';
  throw new Error('目标类型必须是 short 或 long');
}

function goalLabel(type) {
  return type === 'short' ? '短期' : '长期';
}

function setActiveGoal(data, type, goal) {
  const slot = goalSlot(type);
  if (data.goals[slot]) {
    throw new Error(`当前${goalLabel(type)}目标需要先完成`);
  }

  data.goals[slot] = {
    id: goal.id || id(`${type}-goal`),
    type,
    title: goal.title || '',
    note: goal.note || '',
    createdAt: now(),
    status: 'active',
  };
  return data.goals[slot];
}

function addBacklogGoal(data, goal) {
  const saved = {
    id: goal.id || id('backlog-goal'),
    type: goal.type || 'other',
    title: goal.title || '',
    note: goal.note || '',
    createdAt: now(),
    status: 'backlog',
  };
  data.goals.backlog.unshift(saved);
  return saved;
}

function promoteBacklogGoal(data, type, goalId) {
  const slot = goalSlot(type);
  if (data.goals[slot]) {
    throw new Error(`当前${goalLabel(type)}目标需要先完成`);
  }

  const index = data.goals.backlog.findIndex((goal) => goal.id === goalId);
  if (index === -1) {
    throw new Error('没有找到待实现目标');
  }

  const [goal] = data.goals.backlog.splice(index, 1);
  data.goals[slot] = {
    ...goal,
    type,
    status: 'active',
    activatedAt: now(),
  };
  return data.goals[slot];
}

function addPiggyTransaction(data, amount, reason, sourceId) {
  data.piggyBank.balance += amount;
  const saved = {
    id: id('coin'),
    amount,
    reason,
    sourceId: sourceId || null,
    createdAt: now(),
  };
  data.piggyBank.transactions.unshift(saved);
  return saved;
}

function completeGoal(data, type) {
  const slot = goalSlot(type);
  const active = data.goals[slot];
  if (!active) {
    throw new Error(`没有当前${goalLabel(type)}目标`);
  }

  const completed = {
    ...active,
    status: 'completed',
    completedAt: now(),
  };
  data.goals.completed.unshift(completed);
  data.goals[slot] = null;
  addPiggyTransaction(
    data,
    type === 'short' ? SHORT_GOAL_REWARD : LONG_GOAL_REWARD,
    `${goalLabel(type)}目标完成`,
    completed.id
  );
  return completed;
}

function completeHabitReplacement(data, record) {
  const saved = {
    id: id('habit-record'),
    trigger: record.trigger || '',
    alternative: record.alternative || '',
    completed: Boolean(record.completed),
    reflection: record.reflection || '',
    createdAt: now(),
  };

  data.habit.records.unshift(saved);
  if (saved.completed) {
    addPiggyTransaction(data, HABIT_REPLACEMENT_REWARD, '坏习惯替代成功', saved.id);
  }
  return saved;
}

function canRedeem(data) {
  return data.piggyBank.balance >= REDEMPTION_MINIMUM;
}

function redeemReward(data, reward) {
  const amount = Number(reward.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('兑换金额必须大于 0');
  }
  if (amount > data.piggyBank.balance) {
    throw new Error('存钱罐余额不足');
  }

  const saved = {
    id: id('reward'),
    amount,
    title: reward.title || '',
    note: reward.note || '',
    photo: reward.photo || null,
    createdAt: now(),
  };
  data.piggyBank.balance -= amount;
  data.piggyBank.redemptions.unshift(saved);
  return saved;
}

function incrementAffirmation(data) {
  data.affirmation.count += 1;
  data.affirmation.updatedAt = now();
  return data.affirmation.count;
}

function updateAffirmation(data, text) {
  if (data.affirmation.text && data.affirmation.text !== text) {
    data.affirmation.history.unshift({
      text: data.affirmation.text,
      count: data.affirmation.count,
      archivedAt: now(),
    });
  }
  data.affirmation.text = text;
  data.affirmation.count = 0;
  data.affirmation.updatedAt = now();
  return data.affirmation;
}

function sample(list, count) {
  return list.slice(0, count);
}

function createDailyPage(data) {
  return {
    date: new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }),
    quickNotes: sample(data.quickNotes, 3),
    successEntries: sample(data.successEntries, 3),
    gratitudeEntries: sample(data.gratitudeEntries, 3),
    mistakeEntries: sample(data.mistakeEntries, 3),
    methodologies: sample(data.methodologies, 2),
    affirmation: data.affirmation,
    goals: data.goals,
  };
}

module.exports = {
  addBacklogGoal,
  addEntry,
  canRedeem,
  completeGoal,
  completeHabitReplacement,
  createDailyPage,
  createDefaultData,
  ensureData,
  incrementAffirmation,
  promoteBacklogGoal,
  redeemReward,
  setActiveGoal,
  updateAffirmation,
};
