const assert = require('node:assert/strict');
const test = require('node:test');

const {
  addEntry,
  canRedeem,
  completeGoal,
  completeHabitReplacement,
  createDailyPage,
  createDefaultData,
  incrementAffirmation,
  redeemReward,
  setActiveGoal,
} = require('../src/core');

test('default data has one active short goal, one active long goal, and one habit', () => {
  const data = createDefaultData();

  assert.equal(data.goals.activeShort, null);
  assert.equal(data.goals.activeLong, null);
  assert.deepEqual(data.goals.backlog, []);
  assert.equal(data.habit.current, null);
  assert.equal(data.affirmation.targetCount, 100000);
  assert.equal(data.piggyBank.balance, 0);
});

test('active goals cannot be replaced until completed', () => {
  const data = createDefaultData();

  setActiveGoal(data, 'short', { title: '完成论文初稿' });
  assert.throws(
    () => setActiveGoal(data, 'short', { title: '学习法语' }),
    /当前短期目标需要先完成/
  );

  completeGoal(data, 'short');
  setActiveGoal(data, 'short', { title: '学习法语' });

  assert.equal(data.goals.activeShort.title, '学习法语');
  assert.equal(data.piggyBank.balance, 50);
});

test('habit replacement adds one euro only when marked completed', () => {
  const data = createDefaultData();
  data.habit.current = {
    id: 'habit-video',
    title: '戒短视频',
    alternatives: ['散步十分钟', '读两页书'],
  };

  completeHabitReplacement(data, {
    trigger: '想逃避任务',
    alternative: '散步十分钟',
    completed: false,
  });
  completeHabitReplacement(data, {
    trigger: '睡前想刷',
    alternative: '读两页书',
    completed: true,
  });

  assert.equal(data.habit.records.length, 2);
  assert.equal(data.piggyBank.balance, 1);
  assert.equal(data.piggyBank.transactions[0].amount, 1);
});

test('rewards can be redeemed only from thirty euros upward', () => {
  const data = createDefaultData();

  assert.equal(canRedeem(data), false);
  data.piggyBank.balance = 30;
  assert.equal(canRedeem(data), true);

  redeemReward(data, { amount: 18, title: '买一本书', note: '阶段性奖励' });

  assert.equal(data.piggyBank.balance, 12);
  assert.equal(data.piggyBank.redemptions[0].title, '买一本书');
});

test('affirmation click increments toward one hundred thousand', () => {
  const data = createDefaultData();
  data.affirmation.text = '我越来越稳定、清明、有力量';

  incrementAffirmation(data);
  incrementAffirmation(data);

  assert.equal(data.affirmation.count, 2);
  assert.equal(data.affirmation.targetCount, 100000);
});

test('daily page includes recent entries from every reflective area', () => {
  const data = createDefaultData();

  addEntry(data, 'quickNotes', { content: '今天想到：慢就是稳。' });
  addEntry(data, 'successEntries', { event: '完成一个番茄钟', goalId: null, lesson: '先开始' });
  addEntry(data, 'gratitudeEntries', { category: '瞬间', content: '阳光很好。' });
  addEntry(data, 'mistakeEntries', { category: '出口失手', content: '带情绪说话。', correction: '先暂停。' });
  addEntry(data, 'methodologies', {
    category: '自我修炼',
    title: '情绪来时',
    nodes: ['觉察', '暂停', '表达事实'],
  });

  const page = createDailyPage(data);

  assert.equal(page.quickNotes.length, 1);
  assert.equal(page.successEntries.length, 1);
  assert.equal(page.gratitudeEntries.length, 1);
  assert.equal(page.mistakeEntries.length, 1);
  assert.equal(page.methodologies.length, 1);
});
