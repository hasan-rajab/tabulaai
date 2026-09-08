const PROJECT_KEY = 'daos-v0.1-state';
const MEMORY_KEY = 'daos-v0.4-feedback-memory';

const DEFAULT_STATE = {
  rules: [],
  acknowledgements: 0
};

const STOPWORDS = new Set([
  'the','and','that','this','with','from','into','your','you','for','was','were','have','has','had','but','not','when','then','than','they','their','there','what','which','will','would','should','could','must','about','after','before','because','make','made','more','most','some','only','also','each','every','using','used','use','our','out','all','any','too','very','just','why','how','did','does','doing','done','been','being','are','is','am','to','of','in','on','at','as','a','an','or','if','it','its','be','by'
]);

const SAMPLES = {
  recommendation: {
    source: 'Instructor',
    toolScope: 'Presentation',
    category: 'Communication',
    severity: 'warning',
    correction: 'The chart description was accurate, but it stopped at the observation and did not tell the audience what action to take.',
    lesson: 'Every major finding should lead to a specific recommendation that states what the business should do and cites the evidence supporting it.',
    triggers: 'recommendation, finding, insight, presentation, slide, conclusion'
  },
  sorting: {
    source: 'Self',
    toolScope: 'Power BI',
    category: 'Visualisation',
    severity: 'tip',
    correction: 'A ranking chart was left alphabetically sorted, which made the strongest and weakest categories difficult to compare.',
    lesson: 'When the analytical question asks for best, worst, highest, or lowest, sort the visual by the metric rather than alphabetically unless alphabetical order is itself meaningful.',
    triggers: 'rank, ranking, best, worst, highest, lowest, category, sort, chart'
  },
  metric: {
    source: 'Instructor',
    toolScope: 'Any',
    category: 'Metric definition',
    severity: 'blocker',
    correction: 'The success-rate calculation used the wrong denominator, so the percentage did not represent successful campaigns divided by all eligible campaigns.',
    lesson: 'Before calculating any rate, write the numerator, denominator, grain, and eligible population explicitly. Validate the result with a small manual example.',
    triggers: 'rate, percentage, success, conversion, numerator, denominator, metric'
  }
};

const $ = (id) => document.getElementById(id);
const els = {
  projectName: $('projectName'),
  projectContext: $('projectContext'),
  currentTask: $('currentTask'),
  currentTaskContext: $('currentTaskContext'),
  ruleCount: $('ruleCount'),
  matchCount: $('matchCount'),
  ackCount: $('ackCount'),
  source: $('source'),
  toolScope: $('toolScope'),
  category: $('category'),
  severity: $('severity'),
  correction: $('correction'),
  lesson: $('lesson'),
  triggers: $('triggers'),
  suggestBtn: $('suggestBtn'),
  saveRuleBtn: $('saveRuleBtn'),
  saveStatus: $('saveStatus'),
  checkNowBtn: $('checkNowBtn'),
  matchList: $('matchList'),
  filterScope: $('filterScope'),
  searchRules: $('searchRules'),
  rulesList: $('rulesList'),
  toast: $('toast')
};

let project = loadProject();
let state = loadState();

function loadProject() {
  try {
    return JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null');
  } catch {
    return null;
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      acknowledgements: Number(parsed.acknowledgements || 0)
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(message = 'Saved locally') {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(state));
  els.saveStatus.textContent = message;
  clearTimeout(saveState.timer);
  saveState.timer = setTimeout(() => { els.saveStatus.textContent = 'Saved locally'; }, 1200);
}

function currentNextTask() {
  return project?.tasks?.find(task => !task.done) || null;
}

function currentContextText() {
  const task = currentNextTask();
  const pieces = [
    project?.project?.name,
    project?.project?.brief,
    task?.title,
    task?.why,
    task?.action,
    task?.category,
    ...(project?.project?.tools || [])
  ].filter(Boolean);
  return pieces.join(' ').toLowerCase();
}

function hydrateProjectContext() {
  const task = currentNextTask();
  if (project?.project?.name) {
    els.projectName.textContent = project.project.name;
    els.projectContext.textContent = task
      ? `DA.OS is matching your memory against the current NEXT task and project brief.`
      : 'Project loaded. No unfinished NEXT task is currently available.';
  }
  if (task) {
    els.currentTask.textContent = task.title;
    els.currentTaskContext.textContent = `${task.category} · ${task.why}`;
  }
}

function suggestTriggers() {
  const task = currentNextTask();
  const text = [
    els.correction.value,
    els.lesson.value,
    task?.title,
    task?.category
  ].filter(Boolean).join(' ');

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !STOPWORDS.has(word));

  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .slice(0, 10);

  els.triggers.value = ranked.join(', ');
  showToast(ranked.length ? 'Suggested trigger words.' : 'Add more detail to the correction or lesson first.');
}

function parseTriggers(value) {
  return [...new Set(value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(item => item.length >= 2)
  )].slice(0, 16);
}

function saveRule() {
  const correction = els.correction.value.trim();
  const lesson = els.lesson.value.trim();
  if (correction.length < 15) {
    showToast('Describe what was corrected in at least one clear sentence.');
    els.correction.focus();
    return;
  }
  if (lesson.length < 15) {
    showToast('Write the permanent lesson in at least one clear sentence.');
    els.lesson.focus();
    return;
  }

  let triggers = parseTriggers(els.triggers.value);
  if (!triggers.length) {
    suggestTriggers();
    triggers = parseTriggers(els.triggers.value);
  }

  const task = currentNextTask();
  const rule = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    active: true,
    source: els.source.value,
    toolScope: els.toolScope.value,
    category: els.category.value,
    severity: els.severity.value,
    correction,
    lesson,
    triggers,
    originProject: project?.project?.name || '',
    originTask: task?.title || '',
    timesMatched: 0,
    timesAcknowledged: 0,
    lastAcknowledgedAt: null
  };

  state.rules.unshift(rule);
  saveState('Personal rule saved');
  clearCaptureForm();
  renderAll();
  showToast('Feedback saved as a reusable personal rule.');
}

function clearCaptureForm() {
  els.correction.value = '';
  els.lesson.value = '';
  els.triggers.value = '';
}

function scoreRule(rule, context) {
  if (!rule.active) return { score: 0, hits: [] };
  const hits = [];
  for (const trigger of rule.triggers || []) {
    if (trigger && context.includes(trigger.toLowerCase())) hits.push(trigger);
  }

  let score = hits.length;
  const task = currentNextTask();
  const selectedTools = project?.project?.tools || [];
  if (rule.toolScope !== 'Any' && selectedTools.includes(rule.toolScope)) score += 1;
  if (task?.category && rule.category.toLowerCase().includes(task.category.toLowerCase())) score += 1;

  return { score, hits };
}

function getMatches() {
  const context = currentContextText();
  if (!context) return [];
  return state.rules
    .map(rule => ({ rule, ...scoreRule(rule, context) }))
    .filter(item => item.score > 0)
    .sort((a, b) => severityRank(b.rule.severity) - severityRank(a.rule.severity) || b.score - a.score);
}

function severityRank(value) {
  return value === 'blocker' ? 3 : value === 'warning' ? 2 : 1;
}

function renderMatches() {
  const matches = getMatches();
  els.matchCount.textContent = matches.length;
  if (!matches.length) {
    els.matchList.className = 'match-list empty-state';
    els.matchList.textContent = state.rules.length
      ? 'No saved personal rule matches the current NEXT task. That is good—keep working.'
      : 'No matching personal rules yet. Save instructor feedback or a mistake to start building memory.';
    return;
  }

  els.matchList.className = 'match-list';
  els.matchList.innerHTML = matches.map(({ rule, hits, score }) => `
    <div class="match-card ${escapeHtml(rule.severity)}">
      <div class="match-meta">
        <span class="memory-badge ${escapeHtml(rule.severity)}">${escapeHtml(rule.severity)}</span>
        <span class="memory-badge">${escapeHtml(rule.category)}</span>
        <span class="memory-badge">${escapeHtml(rule.toolScope)}</span>
      </div>
      <h3>${escapeHtml(rule.lesson)}</h3>
      <p>Original correction: ${escapeHtml(rule.correction)}</p>
      <p class="match-reason">Matched ${score} signal${score === 1 ? '' : 's'}${hits.length ? ` · trigger words: ${escapeHtml(hits.join(', '))}` : ''}</p>
      <div class="match-actions">
        <button class="small-button ack" data-ack="${rule.id}">I checked this</button>
      </div>
    </div>
  `).join('');

  els.matchList.querySelectorAll('[data-ack]').forEach(button => {
    button.addEventListener('click', () => acknowledgeRule(button.dataset.ack));
  });
}

function acknowledgeRule(id) {
  const rule = state.rules.find(item => item.id === id);
  if (!rule) return;
  rule.timesAcknowledged = (rule.timesAcknowledged || 0) + 1;
  rule.lastAcknowledgedAt = new Date().toISOString();
  state.acknowledgements += 1;
  saveState('Check acknowledged');
  renderStats();
  renderRules();
  showToast('Checked. DA.OS recorded that you reviewed this rule.');
}

function renderRules() {
  const filter = els.filterScope.value;
  const search = els.searchRules.value.trim().toLowerCase();
  let rules = [...state.rules];

  if (filter === 'active') rules = rules.filter(rule => rule.active);
  if (['blocker', 'warning', 'tip'].includes(filter)) rules = rules.filter(rule => rule.severity === filter);
  if (search) {
    rules = rules.filter(rule => [rule.lesson, rule.correction, rule.category, rule.toolScope, ...(rule.triggers || [])]
      .join(' ').toLowerCase().includes(search));
  }

  if (!rules.length) {
    els.rulesList.className = 'rules-list empty-state';
    els.rulesList.textContent = state.rules.length ? 'No saved rules match this filter.' : 'No feedback rules saved yet.';
    return;
  }

  els.rulesList.className = 'rules-list';
  els.rulesList.innerHTML = rules.map(rule => `
    <div class="rule-card ${escapeHtml(rule.severity)}">
      <div class="rule-meta">
        <span class="memory-badge ${escapeHtml(rule.severity)}">${escapeHtml(rule.severity)}</span>
        <span class="memory-badge">${escapeHtml(rule.category)}</span>
        <span class="memory-badge">${escapeHtml(rule.toolScope)}</span>
        <span class="memory-badge ${rule.active ? '' : 'inactive'}">${rule.active ? 'active' : 'paused'}</span>
      </div>
      <h3>${escapeHtml(rule.lesson)}</h3>
      <p>${escapeHtml(rule.correction)}</p>
      ${rule.triggers?.length ? `<div class="rule-triggers">${rule.triggers.map(trigger => `<span class="trigger-chip">${escapeHtml(trigger)}</span>`).join('')}</div>` : ''}
      <p class="rule-origin">Source: ${escapeHtml(rule.source)}${rule.originProject ? ` · ${escapeHtml(rule.originProject)}` : ''}${rule.originTask ? ` · ${escapeHtml(rule.originTask)}` : ''} · acknowledged ${Number(rule.timesAcknowledged || 0)} time(s)</p>
      <div class="rule-actions">
        <button class="small-button" data-toggle="${rule.id}">${rule.active ? 'Pause rule' : 'Reactivate'}</button>
        <button class="small-button danger" data-delete="${rule.id}">Delete</button>
      </div>
    </div>
  `).join('');

  els.rulesList.querySelectorAll('[data-toggle]').forEach(button => {
    button.addEventListener('click', () => toggleRule(button.dataset.toggle));
  });
  els.rulesList.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => deleteRule(button.dataset.delete));
  });
}

function toggleRule(id) {
  const rule = state.rules.find(item => item.id === id);
  if (!rule) return;
  rule.active = !rule.active;
  saveState(rule.active ? 'Rule reactivated' : 'Rule paused');
  renderAll();
}

function deleteRule(id) {
  const rule = state.rules.find(item => item.id === id);
  if (!rule) return;
  const ok = window.confirm('Delete this personal rule from DA.OS memory?');
  if (!ok) return;
  state.rules = state.rules.filter(item => item.id !== id);
  saveState('Rule deleted');
  renderAll();
}

function renderStats() {
  els.ruleCount.textContent = state.rules.filter(rule => rule.active).length;
  els.ackCount.textContent = state.acknowledgements || 0;
}

function loadSample(name) {
  const sample = SAMPLES[name];
  if (!sample) return;
  els.source.value = sample.source;
  els.toolScope.value = sample.toolScope;
  els.category.value = sample.category;
  els.severity.value = sample.severity;
  els.correction.value = sample.correction;
  els.lesson.value = sample.lesson;
  els.triggers.value = sample.triggers;
  els.correction.focus();
  showToast('Sample feedback loaded. Edit it or save it as a rule.');
}

function renderAll() {
  project = loadProject();
  hydrateProjectContext();
  renderStats();
  renderMatches();
  renderRules();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

els.suggestBtn.addEventListener('click', suggestTriggers);
els.saveRuleBtn.addEventListener('click', saveRule);
els.checkNowBtn.addEventListener('click', () => {
  project = loadProject();
  renderAll();
  showToast('Current task checked against your feedback memory.');
});
els.filterScope.addEventListener('change', renderRules);
els.searchRules.addEventListener('input', renderRules);
document.querySelectorAll('[data-sample]').forEach(button => {
  button.addEventListener('click', () => loadSample(button.dataset.sample));
});

renderAll();
