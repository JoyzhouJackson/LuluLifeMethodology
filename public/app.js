const state = {
  data: null,
  audioContext: null,
  activeSheet: null,
  goalEditingType: 'short',
  reviewDate: new Date(),
  calendarOpen: false,
  canvas: {
    nodes: [],
    arrows: [],
    selectedId: null,
    activeTool: null,
    arrowDraft: null,
  },
};

const SHEETS = {
  quick: ['🌙 快速记录', '随心记'],
  success: ['🌟 目标服务', '成功日记'],
  gratitude: ['🤍 小确幸', '感恩日记'],
  mistake: ['🪞 温柔修正', '错事错话本'],
  habit: ['🍃 一次替代就是胜利', '戒坏习惯'],
  goals: ['🎯 目标牵引', '当前目标'],
  piggy: ['💰 奖励系统', '存钱罐'],
  affirmation: ['🪵 十万遍肯定语', '木鱼计数'],
  method: ['🧭 把经验变成路径', '方法论流程图'],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const STORAGE_KEY = 'lulu-life-methodology-data-v1';
const API_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const isStaticMode = !API_HOSTS.has(window.location.hostname);

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
    ...(data || {}),
    goals: { ...defaults.goals, ...((data && data.goals) || {}) },
    habit: { ...defaults.habit, ...((data && data.habit) || {}) },
    piggyBank: { ...defaults.piggyBank, ...((data && data.piggyBank) || {}) },
    affirmation: { ...defaults.affirmation, ...((data && data.affirmation) || {}) },
  };
}

function readStaticData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createDefaultData();
  try {
    return ensureData(JSON.parse(saved));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return createDefaultData();
  }
}

function writeStaticData(data) {
  const saved = ensureData(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

async function api(path, options = {}) {
  if (isStaticMode && path === '/api/data') {
    if ((options.method || 'GET').toUpperCase() === 'PUT') {
      return writeStaticData(JSON.parse(options.body || '{}'));
    }
    return readStaticData();
  }

  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || '请求失败');
  }
  return response.json();
}

async function loadData() {
  state.data = await api('/api/data');
  renderAll();
}

async function saveData() {
  state.data = await api('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.data),
  });
  renderAll();
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function addEntry(collection, entry) {
  state.data[collection].unshift({
    id: makeId(collection),
    createdAt: now(),
    updatedAt: now(),
    ...entry,
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showStatus(text) {
  $('#saveStatus').textContent = text;
  setTimeout(() => {
    $('#saveStatus').textContent = '本地离线保存';
  }, 1600);
}

function openSheet(name) {
  const labels = SHEETS[name];
  if (!labels) return;
  if (name === 'method' && !state.canvas.editingFromCard) {
    resetMethodEditor();
  }
  if (name === 'goals') {
    syncGoalForm(state.goalEditingType || 'short');
  }
  state.canvas.editingFromCard = false;
  state.activeSheet = name;
  $('#sheetEyebrow').textContent = labels[0];
  $('#sheetTitle').textContent = labels[1];
  $$('.sheet-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === name));
  $('#sheetBackdrop').hidden = false;
  $('#bottomSheet').hidden = false;
  document.body.style.overflow = 'hidden';
  const firstField = $(`.sheet-panel[data-panel="${name}"] textarea, .sheet-panel[data-panel="${name}"] input, .sheet-panel[data-panel="${name}"] select`);
  setTimeout(() => firstField?.focus(), 120);
}

function openGoalEditor(type) {
  state.goalEditingType = type;
  openSheet('goals');
  syncGoalForm(type);
}

function closeSheet() {
  state.activeSheet = null;
  $('#sheetBackdrop').hidden = true;
  $('#bottomSheet').hidden = true;
  document.body.style.overflow = '';
}

function activeGoals() {
  return [state.data.goals.activeShort, state.data.goals.activeLong].filter(Boolean);
}

function renderGoals() {
  const shortTitle = state.data.goals.activeShort?.title || '未设置';
  const longTitle = state.data.goals.activeLong?.title || '未设置';
  const shortReward = Number(state.data.goals.activeShort?.rewardAmount || 0);
  const longReward = Number(state.data.goals.activeLong?.rewardAmount || 0);
  $('#activeShort').textContent = shortTitle;
  $('#activeLong').textContent = longTitle;
  $('#sheetActiveShort').textContent = shortTitle;
  $('#sheetActiveLong').textContent = longTitle;
  $('#sheetShortReward').textContent = shortReward ? `完成奖励 ${shortReward} 欧` : '未设置奖励';
  $('#sheetLongReward').textContent = longReward ? `完成奖励 ${longReward} 欧` : '未设置奖励';

  $('#successGoal').innerHTML = ['科研', '搞钱', '身体', '语言', '修炼']
    .map((category) => `<option value="${category}">${category}</option>`)
    .join('');

  $('#backlogGoals').innerHTML = state.data.goals.backlog.length
    ? state.data.goals.backlog
        .map(
          (goal) => `
            <div class="small-item">
              <div class="row">
                <span>${escapeHtml(goal.title)}</span>
                <small>${new Date(goal.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                <span>
                  <button class="secondary" data-promote="${goal.id}" data-type="short">短期</button>
                  <button class="secondary" data-promote="${goal.id}" data-type="long">长期</button>
                </span>
              </div>
            </div>
          `
        )
        .join('')
    : '<p class="empty">还没有下一个目标。</p>';
}

function syncGoalForm(type) {
  const slot = type === 'long' ? 'activeLong' : 'activeShort';
  const active = state.data?.goals?.[slot];
  const isLong = type === 'long';
  $('#goalType').innerHTML = isLong
    ? '<option value="long">设为当前长期目标</option><option value="nextLong">设为下一个长期目标</option>'
    : '<option value="short">设为当前短期目标</option><option value="nextShort">设为下一个短期目标</option>';
  $('#goalType').value = type;
  $('#goalTitle').value = active?.title || '';
  $$('[data-goal-card]').forEach((card) => {
    card.hidden = card.dataset.goalCard !== type;
  });
}

function renderCoins(selector, count, compact = false) {
  const maxLeft = compact ? 98 : 220;
  const baseLeft = compact ? 18 : 28;
  const baseTop = compact ? 64 : 130;
  const topRange = compact ? 42 : 78;
  $(selector).innerHTML = Array.from({ length: count }, (_, index) => {
    const left = baseLeft + ((index * 31) % maxLeft);
    const top = baseTop - ((index * 19) % topRange);
    return `<span class="coin" style="left:${left}px; top:${top}px"></span>`;
  }).join('');
}

function renderPiggyBank() {
  const balance = Number(state.data.piggyBank.balance || 0);
  const fill = `${Math.min(100, (balance / 200) * 100)}%`;
  const coinCount = Math.max(0, Math.floor(balance));

  $('#bankBalance').textContent = `${balance} 欧`;
  if ($('#homePiggyFill')) $('#homePiggyFill').style.height = fill;
  if ($('#sheetPiggyFill')) $('#sheetPiggyFill').style.height = fill;
  if ($('#homeCoinLayer')) renderCoins('#homeCoinLayer', coinCount, true);
  if ($('#sheetCoinLayer')) renderCoins('#sheetCoinLayer', coinCount, false);
}

function renderAffirmation() {
  const affirmation = state.data.affirmation;
  $('#homeAffirmationText').textContent = affirmation.text || '写下一句此刻最重要的肯定语';
  $('#affirmationText').value = affirmation.text || '';
  $('#affirmationCount').textContent = `${affirmation.count} / ${affirmation.targetCount}`;
  $('#affirmationSheetCount').textContent = `${affirmation.count} / ${affirmation.targetCount}`;
  $('#affirmationProgress').style.width = `${Math.min(100, (affirmation.count / affirmation.targetCount) * 100)}%`;
}

function renderHabit() {
  const habit = state.data.habit.current;
  const alternatives = habit?.alternatives || [];
  $('#habitTitle').value = habit?.title || '';
  $('#habitAlternatives').value = alternatives.join('\n');
  $('#habitAlternative').innerHTML = alternatives.length
    ? alternatives.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')
    : '<option value="" selected disabled>还没有可选的替代方案</option>';
  $('#habitAlternative').disabled = alternatives.length === 0;
  $('#habitRecordButton').disabled = alternatives.length === 0;
  $('#habitAlternativeHint').textContent = alternatives.length
    ? '想做坏习惯的时候，从这里选一个替代方案去做。'
    : '先在上方保存替代方案，之后这里会出现可选择的方案。';
}

function recentItems() {
  const items = [
    ...state.data.quickNotes.map((item) => ({ label: '🌙 随心记', text: item.content, createdAt: item.createdAt })),
    ...state.data.successEntries.map((item) => ({ label: '🌟 成功', text: item.event, createdAt: item.createdAt })),
    ...state.data.gratitudeEntries.map((item) => ({ label: '🤍 感恩', text: item.content, createdAt: item.createdAt })),
    ...state.data.mistakeEntries.map((item) => ({ label: '🪞 复盘', text: item.content, createdAt: item.createdAt })),
  ];
  return items
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
}

function renderRecent() {
  const items = recentItems();
  $('#recentList').innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="recent-item">
              <span>${escapeHtml(item.label)}</span>
              <p>${escapeHtml(item.text)}</p>
            </article>
          `
        )
        .join('')
    : '<p class="empty">还没有记录。先点一个入口，把今天的一点真实留下来。</p>';
}

function templateName(value) {
  return {
    flow: '线性流程',
    loop: '循环修正',
    choice: '判断分叉',
  }[value] || '线性流程';
}

function defaultCanvasFromLegacy(method) {
  const legacyNodes = method.canvas?.nodes || method.nodes || [];
  if (method.canvas) {
    return {
      nodes: method.canvas.nodes || [],
      arrows: method.canvas.arrows || [],
    };
  }

  const nodes = legacyNodes.map((text, index) => ({
      id: makeId('canvas-node'),
      type: text.startsWith('◇') ? 'diamond' : text.startsWith('↺') ? 'note' : 'rect',
      text,
      x: 52 + (index % 3) * 190,
      y: 48 + Math.floor(index / 3) * 118,
      w: text.startsWith('◇') ? 112 : 146,
      h: text.startsWith('◇') ? 112 : 64,
    }));

  return {
    nodes,
    arrows: nodes.slice(1).map((node, index) => ({
      id: makeId('canvas-arrow'),
      type: 'straight',
      from: nodes[index].id,
      to: node.id,
    })),
  };
}

function cloneCanvas(canvas) {
  return {
    nodes: (canvas?.nodes || []).map((node) => ({ ...node })),
    arrows: (canvas?.arrows || []).map((arrow) => ({ ...arrow })),
  };
}

function nodeById(nodes, id) {
  return nodes.find((node) => node.id === id);
}

function nodeCenter(node) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function anchorPoint(from, to) {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: from.x + (dx > 0 ? from.w : 0),
      y: from.y + from.h / 2,
    };
  }
  return {
    x: from.x + from.w / 2,
    y: from.y + (dy > 0 ? from.h : 0),
  };
}

function arrowPath(arrow, nodes) {
  const from = nodeById(nodes, arrow.from);
  const to = nodeById(nodes, arrow.to);
  if (!from || !to) return '';
  const start = anchorPoint(from, to);
  const end = anchorPoint(to, from);
  if (arrow.type === 'elbow') {
    const midX = start.x + (end.x - start.x) / 2;
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function renderCanvasMarkup(canvas, options = {}) {
  const nodes = canvas?.nodes || [];
  const arrows = canvas?.arrows || [];
  return `
    <svg class="canvas-arrow-layer" viewBox="0 0 720 420" preserveAspectRatio="none">
      <defs>
        <marker id="${options.markerId || 'arrowHead'}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="rgba(123, 102, 127, 0.72)"></path>
        </marker>
      </defs>
      ${arrows.map((arrow) => {
        const path = arrowPath(arrow, nodes);
        if (!path) return '';
        const selected = options.selectedId === arrow.id ? ' selected' : '';
        const hit = options.interactive ? `<path class="canvas-arrow-hit" data-arrow-id="${arrow.id}" d="${path}"></path>` : '';
        return `${hit}<path class="canvas-arrow${selected}" d="${path}" marker-end="url(#${options.markerId || 'arrowHead'})"></path>`;
      }).join('')}
    </svg>
    ${nodes.map((node) => {
      const selected = options.selectedId === node.id ? ' selected' : '';
      return `
        <div class="canvas-node ${node.type}${selected}" data-node-id="${node.id}" style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px">
          <span class="node-text">${escapeHtml(node.text || (node.type === 'note' ? '备注' : '双击编辑'))}</span>
        </div>
      `;
    }).join('')}
  `;
}

function canvasBounds(canvas) {
  const nodes = canvas?.nodes || [];
  if (!nodes.length) return { width: 720, height: 260, x: 0, y: 0 };
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.w));
  const bottom = Math.max(...nodes.map((node) => node.y + node.h));
  return {
    x: Math.max(0, left - 28),
    y: Math.max(0, top - 28),
    width: Math.max(260, right - left + 56),
    height: Math.max(160, bottom - top + 56),
  };
}

function methodLinesFromMethod(method) {
  if (!method) return [];
  if (method.flowText) {
    return method.flowText.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return (method.nodes || method.canvas?.nodes || [])
    .map((item) => (typeof item === 'string' ? item : item.text))
    .map((line) => String(line || '').trim())
    .filter(Boolean);
}

function methodFlowMarkup(lines) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean);
  return `
    <div class="method-flow-text">
      <span class="flow-type">text</span>
      ${cleanLines.length
        ? cleanLines.map((line, index) => `
            <div class="flow-line">${escapeHtml(line)}</div>
            ${index < cleanLines.length - 1 ? '<div class="flow-arrow">↓</div>' : ''}
          `).join('')
        : '<p class="empty">每行写一步，保存后会生成清晰的流程卡片。</p>'}
    </div>
  `;
}

function canvasFromLines(lines) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean);
  const nodes = cleanLines.map((line, index) => ({
    id: makeId('canvas-node'),
    type: 'rect',
    text: line,
    x: 78,
    y: 42 + index * 86,
    w: 560,
    h: 56,
  }));
  return {
    nodes,
    arrows: nodes.slice(1).map((node, index) => ({
      id: makeId('canvas-arrow'),
      type: 'straight',
      from: nodes[index].id,
      to: node.id,
    })),
  };
}

function renderMethodFlowPreview() {
  const target = $('#methodFlowPreview');
  if (!target) return;
  const lines = ($('#methodLines')?.value || '').split('\n');
  target.innerHTML = methodFlowMarkup(lines);
}

function methodPreviewMarkup(method) {
  const lines = methodLinesFromMethod(method);
  return `
    <button class="method-flow-card" data-edit-method="${method.id}" type="button" aria-label="编辑方法论">
      ${methodFlowMarkup(lines)}
    </button>
  `;
}

function renderMethods() {
  const sort = $('#methodSort')?.value || 'newest';
  const category = $('#methodCategoryFilter')?.value || 'all';
  const methods = state.data.methodologies
    .filter((method) => category === 'all' || method.category === category)
    .sort((a, b) => {
      const delta = new Date(b.createdAt) - new Date(a.createdAt);
      return sort === 'oldest' ? -delta : delta;
    });

  $('#methodList').innerHTML = methods.length
    ? methods
        .map(
          (method) => `
            <article class="method-card">
              <span>🧭 ${escapeHtml(method.category)}</span>
              <h3>${escapeHtml(method.title)}</h3>
              ${methodPreviewMarkup(method)}
              <div class="sheet-actions">
                <span class="muted">${new Date(method.createdAt).toLocaleDateString('zh-CN')}</span>
                <span>
                  <button class="secondary" data-edit-method="${method.id}">编辑</button>
                  <button class="secondary" data-delete-method="${method.id}">删除</button>
                </span>
              </div>
            </article>
          `
        )
        .join('')
    : '<p class="empty">还没有匹配的方法论。换一个筛选，或新增一个可实践路径。</p>';
  fitMethodPreviews();
}

function fitMethodPreviews() {
  $$('.method-preview').forEach((preview) => {
    const canvas = preview.querySelector('.method-preview-canvas');
    if (!canvas) return;
    if (preview.clientWidth <= 0 || preview.clientHeight <= 0) return;
    const availableWidth = preview.clientWidth - 24;
    const availableHeight = preview.clientHeight - 24;
    const rawWidth = Number.parseFloat(canvas.style.width) || 720;
    const rawHeight = Number.parseFloat(canvas.style.height) || 420;
    const scale = Math.min(1, availableWidth / rawWidth, availableHeight / rawHeight);
    canvas.style.setProperty('--preview-scale', String(scale));
    canvas.style.marginLeft = `${Math.max(12, (preview.clientWidth - rawWidth * scale) / 2)}px`;
    canvas.style.marginTop = `${Math.max(12, (preview.clientHeight - rawHeight * scale) / 2)}px`;
  });
}

function createDailyPage(data, date = new Date()) {
  return {
    date: date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }),
    quickNotes: data.quickNotes.slice(0, 3),
    successEntries: data.successEntries.slice(0, 3),
    gratitudeEntries: data.gratitudeEntries.slice(0, 3),
    mistakeEntries: data.mistakeEntries.slice(0, 3),
    methodologies: data.methodologies.slice(0, 2),
  };
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateStripMarkup() {
  const selectedDate = state.reviewDate || new Date();
  return Array.from({ length: 9 }, (_, index) => {
    const date = new Date(selectedDate);
    date.setDate(selectedDate.getDate() + index - 4);
    const active = date.toDateString() === selectedDate.toDateString();
    const week = date.toLocaleDateString('zh-CN', { weekday: 'short' });
    return `
      <button class="date-chip${active ? ' active' : ''}" type="button" data-date="${dateKey(date)}">
        <span>${week}</span>
        <strong>${date.getDate()}</strong>
      </button>
    `;
  }).join('');
}

function bookSection(title, items) {
  const preview = items[0] || '这里还在等待你的记录。';
  const detail = items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="empty">这里还在等待你的记录。</p>';
  return `
    <details class="daily-summary-card">
      <summary>
        <div class="summary-row">
          <h3>${title}</h3>
          <span class="count-pill">${items.length} 条</span>
        </div>
        <p class="summary-preview">${escapeHtml(preview)}</p>
      </summary>
      <div class="summary-detail">${detail}</div>
    </details>
  `;
}

function renderCalendarControls() {
  const selectedDate = state.reviewDate || new Date();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, index) => currentYear - 5 + index);
  $('#calendarYear').innerHTML = years
    .map((year) => `<option value="${year}"${year === selectedDate.getFullYear() ? ' selected' : ''}>${year} 年</option>`)
    .join('');
  $('#calendarMonth').innerHTML = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return `<option value="${index}"${index === selectedDate.getMonth() ? ' selected' : ''}>${month} 月</option>`;
  }).join('');
  $('#calendarControls').hidden = !state.calendarOpen;
  $('#refreshDaily').classList.toggle('active', state.calendarOpen);
}

function renderDailyPage() {
  const selectedDate = state.reviewDate || new Date();
  const page = createDailyPage(state.data, selectedDate);
  $('#dailyDate').textContent = '我的日记';
  $('#dailyPage').innerHTML = `
    <section class="date-strip" aria-label="选择日期">
      ${dateStripMarkup()}
    </section>
    <section class="today-book-section">
      <div class="inline-section-head">
        <h3>今日书页</h3>
        <span>${page.date}</span>
      </div>
      <div class="daily-summary">
        ${[
          bookSection('🌙 随心记', page.quickNotes.map((entry) => entry.content)),
          bookSection('🌟 成功日记', page.successEntries.map((entry) => `${entry.event}${entry.lesson ? `：${entry.lesson}` : ''}`)),
          bookSection('🤍 感恩日记', page.gratitudeEntries.map((entry) => `${entry.category}：${entry.content}`)),
          bookSection('🪞 错事错话本', page.mistakeEntries.map((entry) => `${entry.category}：${entry.content}${entry.correction ? `；下次：${entry.correction}` : ''}`)),
          bookSection('🧭 方法论', page.methodologies.map((entry) => `${entry.title}：${(entry.nodes || []).join(' → ')}`)),
        ].join('')}
      </div>
    </section>
  `;
  $('#dailyPage').classList.remove('daily-summary');
  renderCalendarControls();
}

function renderAll() {
  renderGoals();
  renderPiggyBank();
  renderAffirmation();
  renderHabit();
  renderMethods();
  renderDailyPage();
}

function resetMethodEditor(method = null) {
  const canvas = method ? defaultCanvasFromLegacy(method) : { nodes: [], arrows: [] };
  state.canvas.nodes = cloneCanvas(canvas).nodes;
  state.canvas.arrows = cloneCanvas(canvas).arrows;
  state.canvas.selectedId = null;
  state.canvas.activeTool = null;
  state.canvas.arrowDraft = null;
  $('#methodEditingId').value = method?.id || '';
  $('#methodTitle').value = method?.title || '';
  $('#methodCategory').value = method?.category || '自我修炼';
  if ($('#methodLines')) $('#methodLines').value = methodLinesFromMethod(method).join('\n');
  if ($('#canvasTextEditor')) $('#canvasTextEditor').value = '';
  renderMethodFlowPreview();
  renderMethodEditor();
}

function selectedCanvasNode() {
  return nodeById(state.canvas.nodes, state.canvas.selectedId);
}

function renderMethodEditor() {
  const canvas = $('#methodCanvas');
  if (!canvas) return;
  canvas.innerHTML = renderCanvasMarkup(state.canvas, {
    markerId: 'editorArrowHead',
    selectedId: state.canvas.selectedId,
    interactive: true,
  }) + (!state.canvas.nodes.length ? '<div class="canvas-empty">先点上方工具添加方框、菱形、箭头或备注。</div>' : '');
  $$('.canvas-tools [data-canvas-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.canvasTool === state.canvas.activeTool);
  });
  const selected = selectedCanvasNode();
  if ($('#canvasTextEditor')) $('#canvasTextEditor').value = selected?.text || '';
}

function addCanvasNode(type) {
  const existing = state.canvas.nodes.length;
  const isDiamond = type === 'diamond';
  const isNote = type === 'note';
  const node = {
    id: makeId('canvas-node'),
    type,
    text: isDiamond ? '比较 / 判断' : isNote ? '备注' : '步骤',
    x: 54 + (existing % 3) * 178,
    y: 54 + Math.floor(existing / 3) * 112,
    w: isDiamond ? 112 : isNote ? 150 : 142,
    h: isDiamond ? 112 : isNote ? 80 : 64,
  };
  state.canvas.nodes.push(node);
  state.canvas.selectedId = node.id;
  state.canvas.activeTool = null;
  renderMethodEditor();
}

function connectCanvasNode(nodeId) {
  const tool = state.canvas.activeTool;
  if (tool !== 'arrow' && tool !== 'elbow') return false;
  if (!state.canvas.arrowDraft) {
    state.canvas.arrowDraft = nodeId;
    state.canvas.selectedId = nodeId;
    renderMethodEditor();
    return true;
  }
  if (state.canvas.arrowDraft !== nodeId) {
    state.canvas.arrows.push({
      id: makeId('canvas-arrow'),
      type: tool === 'elbow' ? 'elbow' : 'straight',
      from: state.canvas.arrowDraft,
      to: nodeId,
    });
  }
  state.canvas.arrowDraft = null;
  state.canvas.activeTool = null;
  state.canvas.selectedId = null;
  renderMethodEditor();
  return true;
}

function deleteCanvasSelection() {
  const id = state.canvas.selectedId;
  if (!id) return;
  state.canvas.nodes = state.canvas.nodes.filter((node) => node.id !== id);
  state.canvas.arrows = state.canvas.arrows.filter((arrow) => arrow.id !== id && arrow.from !== id && arrow.to !== id);
  state.canvas.selectedId = null;
  renderMethodEditor();
}

function editMethod(methodId) {
  const method = state.data.methodologies.find((item) => item.id === methodId);
  if (!method) return;
  state.canvas.editingFromCard = true;
  resetMethodEditor(method);
  openSheet('method');
}

function addPiggyTransaction(amount, reason, sourceId) {
  state.data.piggyBank.balance += amount;
  state.data.piggyBank.transactions.unshift({
    id: makeId('coin'),
    amount,
    reason,
    sourceId,
    createdAt: now(),
  });
}

function setGoalReward(type) {
  const slot = type === 'short' ? 'activeShort' : 'activeLong';
  const active = state.data.goals[slot];
  if (!active) {
    alert('先设置这个目标，再设置奖励。');
    return;
  }
  const current = active.rewardAmount || '';
  const value = prompt('设置完成这个目标后给自己的奖励金额（欧）', current);
  if (value === null) return;
  const amount = Math.max(0, Math.floor(Number(value)));
  if (!Number.isFinite(amount)) {
    alert('请输入有效金额。');
    return;
  }
  active.rewardAmount = amount;
  active.updatedAt = now();
  saveData();
}

function completeGoal(type) {
  const slot = type === 'short' ? 'activeShort' : 'activeLong';
  const active = state.data.goals[slot];
  if (!active) {
    alert('还没有设置这个目标。');
    return;
  }
  state.data.goals.completed.unshift({ ...active, status: 'completed', completedAt: now() });
  state.data.goals[slot] = null;
  const rewardAmount = Number(active.rewardAmount || 0);
  if (rewardAmount > 0) {
    addPiggyTransaction(rewardAmount, type === 'short' ? '短期目标完成奖励' : '长期目标完成奖励', active.id);
  }
  saveData();
}

async function uploadPhoto(input) {
  const file = input.files?.[0];
  if (!file) return null;
  if (isStaticMode) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('照片读取失败'));
      reader.readAsDataURL(file);
    });
  }
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'X-File-Name': encodeURIComponent(file.name) },
    body: await file.arrayBuffer(),
  });
  if (!response.ok) throw new Error('照片上传失败');
  const saved = await response.json();
  return saved.url;
}

function playMuyuSound() {
  state.audioContext ||= new AudioContext();
  const context = state.audioContext;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(185, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(96, context.currentTime + 0.09);
  gain.gain.setValueAtTime(0.25, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.17);
}

async function hitMuyu(button) {
  state.data.affirmation.count += 1;
  state.data.affirmation.updatedAt = now();
  button.classList.remove('hit');
  void button.offsetWidth;
  button.classList.add('hit');
  playMuyuSound();
  await saveData();
}

function bindNavigation() {
  document.body.dataset.view = 'home';
  document.addEventListener('click', (event) => {
    const goalButton = event.target.closest('[data-goal-edit]');
    if (goalButton) {
      openGoalEditor(goalButton.dataset.goalEdit);
      return;
    }

    const navButton = event.target.closest('.nav-item');
    if (!navButton) return;
    $$('.nav-item').forEach((item) => item.classList.remove('active'));
    $$('.view').forEach((view) => view.classList.remove('active'));
    navButton.classList.add('active');
    $(`#${navButton.dataset.view}View`)?.classList.add('active');
    document.body.dataset.view = navButton.dataset.view;
    closeSheet();
    if (navButton.dataset.view === 'method') {
      requestAnimationFrame(fitMethodPreviews);
    }
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-sheet]');
    if (!button) return;
    openSheet(button.dataset.sheet);
  });

  document.addEventListener('click', (event) => {
    const dateButton = event.target.closest('[data-date]');
    if (!dateButton) return;
    state.reviewDate = new Date(`${dateButton.dataset.date}T12:00:00`);
    renderDailyPage();
  });

  $('#closeSheet').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', closeSheet);
  $('#methodSort')?.addEventListener('change', renderMethods);
  $('#methodCategoryFilter')?.addEventListener('change', renderMethods);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.activeSheet) closeSheet();
  });
}

function bindForms() {
  $('#quickForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = $('#quickInput').value.trim();
    if (!content) return;
    addEntry('quickNotes', { content });
    $('#quickInput').value = '';
    await saveData();
    showStatus('已保存');
    closeSheet();
  });

  $('#goalForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = $('#goalTitle').value.trim();
    const type = $('#goalType').value;
    if (!title) return;

    if (type === 'nextShort' || type === 'nextLong') {
      state.data.goals.backlog.unshift({
        id: makeId('backlog-goal'),
        type: type === 'nextShort' ? 'short' : 'long',
        title,
        createdAt: now(),
        status: 'backlog',
      });
    } else {
      const slot = type === 'short' ? 'activeShort' : 'activeLong';
      if (state.data.goals[slot]) {
        state.data.goals[slot] = {
          ...state.data.goals[slot],
          title,
          updatedAt: now(),
        };
      } else {
        state.data.goals[slot] = {
          id: makeId(`${type}-goal`),
          type,
          title,
          createdAt: now(),
          status: 'active',
        };
      }
    }
    await saveData();
    syncGoalForm(type === 'long' || type === 'nextLong' ? 'long' : 'short');
  });

  $('#backlogGoals').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-promote]');
    if (!button) return;
    const type = button.dataset.type;
    const slot = type === 'short' ? 'activeShort' : 'activeLong';
    if (state.data.goals[slot]) {
      alert(`当前${type === 'short' ? '短期' : '长期'}目标需要先完成。`);
      return;
    }
    const index = state.data.goals.backlog.findIndex((goal) => goal.id === button.dataset.promote);
    const [goal] = state.data.goals.backlog.splice(index, 1);
    state.data.goals[slot] = { ...goal, type, status: 'active', activatedAt: now() };
    await saveData();
  });

  $$('[data-complete-goal]').forEach((button) => {
    button.addEventListener('click', () => completeGoal(button.dataset.completeGoal));
  });

  $$('[data-goal-reward]').forEach((button) => {
    button.addEventListener('click', () => setGoalReward(button.dataset.goalReward));
  });

  $('#successForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const eventText = $('#successEvent').value.trim();
    if (!eventText) return;
    addEntry('successEntries', {
      event: eventText,
      category: $('#successGoal').value || '修炼',
      lesson: $('#successLesson').value.trim(),
    });
    event.target.reset();
    await saveData();
    closeSheet();
  });

  $('#gratitudeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = $('#gratitudeContent').value.trim();
    if (!content) return;
    addEntry('gratitudeEntries', {
      category: $('#gratitudeCategory').value,
      content,
    });
    event.target.reset();
    await saveData();
    closeSheet();
  });

  $('#mistakeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = $('#mistakeContent').value.trim();
    if (!content) return;
    addEntry('mistakeEntries', {
      category: $('#mistakeCategory').value,
      content,
      correction: $('#mistakeCorrection').value.trim(),
    });
    event.target.reset();
    await saveData();
    closeSheet();
  });

  $('#saveHabit').addEventListener('click', async () => {
    const title = $('#habitTitle').value.trim();
    if (!title) return;
    state.data.habit.current = {
      id: state.data.habit.current?.id || makeId('habit'),
      title,
      alternatives: $('#habitAlternatives').value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      updatedAt: now(),
    };
    await saveData();
  });

  $('#habitForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const trigger = $('#habitTrigger').value.trim();
    if (!trigger) return;
    const completed = $('#habitCompleted').checked;
    if (!$('#habitAlternative').value) {
      alert('请先保存至少一个替代方案。');
      return;
    }
    const record = {
      id: makeId('habit-record'),
      trigger,
      alternative: $('#habitAlternative').value,
      completed,
      createdAt: now(),
    };
    state.data.habit.records.unshift(record);
    if (completed) addPiggyTransaction(1, '坏习惯替代成功', record.id);
    $('#habitTrigger').value = '';
    await saveData();
    closeSheet();
  });

  $('#redeemForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const amount = Number($('#rewardAmount').value);
    const title = $('#rewardTitle').value.trim();
    if (!title || !amount) return;
    if (state.data.piggyBank.balance < 30) {
      alert('存钱罐满 30 欧后再兑换奖励。');
      return;
    }
    if (amount > state.data.piggyBank.balance) {
      alert('余额不足。');
      return;
    }
    const photo = await uploadPhoto($('#rewardPhoto'));
    state.data.piggyBank.balance -= amount;
    state.data.piggyBank.redemptions.unshift({
      id: makeId('reward'),
      amount,
      title,
      photo,
      createdAt: now(),
    });
    event.target.reset();
    await saveData();
    closeSheet();
  });

  $('#homeMuyuButton').addEventListener('click', () => hitMuyu($('#homeMuyuButton')));
  $('#muyuButton').addEventListener('click', () => hitMuyu($('#muyuButton')));

  $('#saveAffirmation').addEventListener('click', async () => {
    const text = $('#affirmationText').value.trim();
    if (!text || text === state.data.affirmation.text) return;
    state.data.affirmation.history.unshift({
      text: state.data.affirmation.text,
      count: state.data.affirmation.count,
      archivedAt: now(),
    });
    state.data.affirmation.text = text;
    state.data.affirmation.count = 0;
    state.data.affirmation.updatedAt = now();
    await saveData();
    closeSheet();
  });

  $('#methodForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = $('#methodTitle').value.trim();
    const lines = $('#methodLines').value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!title || !lines.length) return;
    const canvas = canvasFromLines(lines);
    const payload = {
      title,
      category: $('#methodCategory').value,
      template: 'text-flow',
      flowText: lines.join('\n'),
      canvas,
      nodes: lines,
    };
    const editingId = $('#methodEditingId').value;
    if (editingId) {
      const index = state.data.methodologies.findIndex((method) => method.id === editingId);
      if (index !== -1) {
        state.data.methodologies[index] = {
          ...state.data.methodologies[index],
          ...payload,
          updatedAt: now(),
        };
      }
    } else {
      addEntry('methodologies', payload);
    }
    event.target.reset();
    resetMethodEditor();
    await saveData();
    closeSheet();
  });

  $('#methodList').addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit-method]');
    if (editButton) {
      editMethod(editButton.dataset.editMethod);
      return;
    }
    const button = event.target.closest('[data-delete-method]');
    if (!button) return;
    state.data.methodologies = state.data.methodologies.filter((method) => method.id !== button.dataset.deleteMethod);
    await saveData();
  });

  $('#methodList').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const editTarget = event.target.closest('[data-edit-method]');
    if (!editTarget) return;
    event.preventDefault();
    editMethod(editTarget.dataset.editMethod);
  });

  $$('.canvas-tools [data-canvas-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      const tool = button.dataset.canvasTool;
      if (tool === 'rect' || tool === 'diamond' || tool === 'note') {
        addCanvasNode(tool);
        return;
      }
      state.canvas.activeTool = state.canvas.activeTool === tool ? null : tool;
      state.canvas.arrowDraft = null;
      renderMethodEditor();
    });
  });

  $('#deleteCanvasSelection')?.addEventListener('click', deleteCanvasSelection);

  $('#methodLines')?.addEventListener('input', renderMethodFlowPreview);

  $('#canvasTextEditor')?.addEventListener('input', () => {
    const selected = selectedCanvasNode();
    if (!selected) return;
    selected.text = $('#canvasTextEditor').value;
    renderMethodEditor();
  });

  $('#methodCanvas')?.addEventListener('pointerdown', (event) => {
    const arrowHit = event.target.closest('.canvas-arrow-hit');
    if (arrowHit) {
      state.canvas.selectedId = arrowHit.dataset.arrowId;
      renderMethodEditor();
      return;
    }
    const element = event.target.closest('.canvas-node');
    if (!element) {
      state.canvas.selectedId = null;
      renderMethodEditor();
      return;
    }
    const node = nodeById(state.canvas.nodes, element.dataset.nodeId);
    if (!node) return;
    if (connectCanvasNode(node.id)) return;
    state.canvas.selectedId = node.id;
    renderMethodEditor();
    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = node.x;
    const originalY = node.y;
    const move = (moveEvent) => {
      node.x = Math.max(0, originalX + moveEvent.clientX - startX);
      node.y = Math.max(0, originalY + moveEvent.clientY - startY);
      renderMethodEditor();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });

  $('#refreshDaily').addEventListener('click', () => {
    state.calendarOpen = !state.calendarOpen;
    renderCalendarControls();
  });

  $('#calendarYear').addEventListener('change', () => {
    state.reviewDate.setFullYear(Number($('#calendarYear').value));
    renderDailyPage();
  });

  $('#calendarMonth').addEventListener('change', () => {
    state.reviewDate.setMonth(Number($('#calendarMonth').value));
    renderDailyPage();
  });
}

bindNavigation();
bindForms();
window.addEventListener('resize', fitMethodPreviews);
loadData().catch((error) => {
  document.body.innerHTML = `<main class="reader-panel"><h1>启动失败</h1><p>${escapeHtml(error.message)}</p></main>`;
});
