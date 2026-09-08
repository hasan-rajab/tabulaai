const STORAGE_KEY = 'daos-v0.1-state';

const DEFAULT_STATE = {
  project: {
    name: '',
    deadline: '',
    tools: [],
    brief: '',
    files: []
  },
  requirements: [],
  tasks: []
};

let state = loadState();

const $ = (id) => document.getElementById(id);
const els = {
  projectHeading: $('projectHeading'),
  projectName: $('projectName'),
  deadline: $('deadline'),
  assignmentBrief: $('assignmentBrief'),
  toolChoices: $('toolChoices'),
  deconstructBtn: $('deconstructBtn'),
  rebuildBtn: $('rebuildBtn'),
  requirementsList: $('requirementsList'),
  requirementCount: $('requirementCount'),
  taskList: $('taskList'),
  taskCount: $('taskCount'),
  sidebarProgress: $('sidebarProgress'),
  sidebarProgressText: $('sidebarProgressText'),
  heroCompleted: $('heroCompleted'),
  miniNextTitle: $('miniNextTitle'),
  miniNextReason: $('miniNextReason'),
  nextNumber: $('nextNumber'),
  nextTitle: $('nextTitle'),
  nextWhy: $('nextWhy'),
  nextAction: $('nextAction'),
  nextCategory: $('nextCategory'),
  nextProgress: $('nextProgress'),
  completeNextBtn: $('completeNextBtn'),
  queueList: $('queueList'),
  fileInput: $('fileInput'),
  dropzone: $('dropzone'),
  fileList: $('fileList'),
  exportBtn: $('exportBtn'),
  resetBtn: $('resetBtn'),
  sampleBtn: $('sampleBtn'),
  saveStatus: $('saveStatus'),
  toast: $('toast')
};

const KEYWORD_TASKS = [
  {
    test: /dataset|data\s+above|spreadsheet|csv|excel\s+file/i,
    title: 'Inspect the dataset before analysis',
    why: 'You need to understand the fields, missing values, date formats and obvious quality problems before calculating anything.',
    action: 'Open the dataset, identify the target/outcome column, inspect column types, and note missing or suspicious values.',
    category: 'Data'
  },
  {
    test: /clean|missing|duplicate|quality|prepare/i,
    title: 'Clean the fields required for the assignment',
    why: 'Cleaning only the fields you actually need keeps the project focused and prevents avoidable calculation errors.',
    action: 'Fix data types, missing values, duplicates and inconsistent labels only where they affect the required analysis.',
    category: 'Data'
  },
  {
    test: /success|successful|funded|conversion|outcome|target/i,
    title: 'Define the success metric clearly',
    why: 'Every later comparison depends on a consistent outcome definition.',
    action: 'Create or confirm one success/outcome field and verify how it should be calculated.',
    category: 'Metric'
  },
  {
    test: /duration|length\s+of\s+time|campaign\s+length/i,
    title: 'Analyse duration versus success',
    why: 'This directly answers the question about the best campaign length.',
    action: 'Group campaigns into useful duration ranges, calculate success rate for each range, and compare the results.',
    category: 'Analysis'
  },
  {
    test: /pledge\s+goal|ideal\s+goal|goal\s+amount|funding\s+goal/i,
    title: 'Analyse pledge goal versus success',
    why: 'Raw goal values are usually too granular; bands make the relationship interpretable.',
    action: 'Create pledge-goal bands, calculate success rate by band, and sort the bands from strongest to weakest.',
    category: 'Analysis'
  },
  {
    test: /type\s+of\s+project|projects?\s+would|category|categories|project\s+type/i,
    title: 'Compare success by project category',
    why: 'Category-level analysis identifies which project types are most likely to be funded.',
    action: 'Calculate campaign count and success rate by category, then rank categories while checking sample sizes.',
    category: 'Analysis'
  },
  {
    test: /month|day|time\s+to\s+launch|launch\s+time|launch\s+date/i,
    title: 'Analyse launch timing',
    why: 'Launch date fields can answer month, weekday and time-of-day questions once they are converted correctly.',
    action: 'Extract month, weekday and hour from launch timestamps and compare success rates across each dimension.',
    category: 'Analysis'
  },
  {
    test: /recommend|recommendation|successful\s+campaign|what\s+should/i,
    title: 'Turn findings into recommendations',
    why: 'A bootcamp project should move from observations to decisions someone could actually act on.',
    action: 'For each strong finding, write one evidence-backed recommendation and one caveat or limitation.',
    category: 'Synthesis'
  },
  {
    test: /presentation|slides?|powerpoint|deck/i,
    title: 'Build the final presentation',
    why: 'The deliverable needs a concise narrative, not every chart you created during exploration.',
    action: 'Select only the findings that answer the assignment, then build the required number of slides around the recommendations.',
    category: 'Delivery'
  },
  {
    test: /tableau|power\s*bi|dashboard|visual/i,
    title: 'Create the required visual evidence',
    why: 'The visual should make the analytical comparison obvious and support the recommendation.',
    action: 'Choose the simplest chart for each comparison, label units clearly, and sort categories by the metric being discussed.',
    category: 'Visualisation'
  },
  {
    test: /sql|query|database/i,
    title: 'Build and validate the SQL analysis',
    why: 'The query must match the requested grain, filters and metric definition before the result can be trusted.',
    action: 'Write the smallest query that answers one requirement, validate counts/totals, then expand only if needed.',
    category: 'SQL'
  },
  {
    test: /python|pandas|notebook/i,
    title: 'Build the Python analysis incrementally',
    why: 'Small, testable steps make debugging easier and help you understand what each transformation does.',
    action: 'Load the data, inspect it, perform one transformation at a time, and check the output after each step.',
    category: 'Python'
  }
];

const FINAL_TASKS = [
  {
    title: 'Validate the final numbers',
    why: 'A polished chart is still wrong if the underlying totals, percentages or filters do not reconcile.',
    action: 'Spot-check the key calculations against the source data and confirm every headline number matches its chart/table.',
    category: 'QA'
  },
  {
    title: 'Run a submission check',
    why: 'The final pass catches missing requirements, weak recommendations and formatting mistakes before you submit.',
    action: 'Re-read the original brief and confirm every requirement is visibly answered in the final deliverable.',
    category: 'QA'
  }
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(message = 'Saved locally') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = message;
  clearTimeout(saveState.timer);
  saveState.timer = setTimeout(() => { els.saveStatus.textContent = 'Saved locally'; }, 1200);
}

function syncFormToState() {
  state.project.name = els.projectName.value.trim();
  state.project.deadline = els.deadline.value;
  state.project.brief = els.assignmentBrief.value.trim();
  state.project.tools = [...els.toolChoices.querySelectorAll('input:checked')].map(i => i.value);
  saveState();
  renderHeader();
}

function hydrateForm() {
  els.projectName.value = state.project.name || '';
  els.deadline.value = state.project.deadline || '';
  els.assignmentBrief.value = state.project.brief || '';
  [...els.toolChoices.querySelectorAll('input')].forEach(input => {
    input.checked = state.project.tools.includes(input.value);
  });
}

function splitRequirements(brief) {
  if (!brief.trim()) return [];
  const lines = brief
    .split(/\n+/)
    .map(s => s.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean);

  const chunks = lines.flatMap(line =>
    line.length > 180
      ? line.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
      : [line]
  );

  const requirementSignals = /must|should|need|required|be sure|consider|include|create|build|analyse|analyze|find|determine|compare|recommend|using|maximum|max\.|deliver|submit|presentation|dashboard|report|slide/i;
  const selected = chunks.filter(c => requirementSignals.test(c));
  const base = selected.length ? selected : chunks;
  return [...new Set(base)].slice(0, 16);
}

function buildTasks(brief) {
  const tasks = [];
  const seen = new Set();

  for (const template of KEYWORD_TASKS) {
    if (template.test.test(brief) && !seen.has(template.title)) {
      seen.add(template.title);
      tasks.push({ id: crypto.randomUUID(), ...template, done: false });
    }
  }

  if (tasks.length === 0 && brief.trim()) {
    tasks.push({
      id: crypto.randomUUID(),
      title: 'Translate the brief into analytical questions',
      why: 'A clear question tells you which fields, calculations and visuals you actually need.',
      action: 'Write the 2–5 questions the final deliverable must answer, using the assignment wording.',
      category: 'Scope',
      done: false
    });
  }

  for (const finalTask of FINAL_TASKS) {
    if (!seen.has(finalTask.title)) {
      tasks.push({ id: crypto.randomUUID(), ...finalTask, done: false });
    }
  }

  return tasks;
}

function deconstruct() {
  syncFormToState();
  const brief = state.project.brief;
  if (!brief) {
    showToast('Paste the assignment brief first.');
    switchView('workspace');
    els.assignmentBrief.focus();
    return;
  }

  const previousDone = new Map(state.tasks.map(t => [t.title, t.done]));
  state.requirements = splitRequirements(brief);
  state.tasks = buildTasks(brief).map(task => ({ ...task, done: previousDone.get(task.title) || false }));
  saveState('Plan rebuilt');
  renderAll();
  switchView('deconstructor');
  showToast(`Created ${state.tasks.length} project tasks.`);
}

function renderHeader() {
  els.projectHeading.textContent = state.project.name || 'Start your first project';
}

function renderRequirements() {
  els.requirementCount.textContent = state.requirements.length;
  if (!state.requirements.length) {
    els.requirementsList.className = 'stack-list empty-state';
    els.requirementsList.textContent = 'Paste an assignment brief and run the deconstructor.';
    return;
  }
  els.requirementsList.className = 'stack-list';
  els.requirementsList.innerHTML = state.requirements.map((req, idx) => `
    <div class="requirement-item">
      <strong>Requirement ${idx + 1}</strong>
      ${escapeHtml(req)}
    </div>
  `).join('');
}

function renderTasks() {
  els.taskCount.textContent = state.tasks.length;
  if (!state.tasks.length) {
    els.taskList.className = 'task-list empty-state';
    els.taskList.textContent = 'No tasks yet.';
    return;
  }

  els.taskList.className = 'task-list';
  els.taskList.innerHTML = state.tasks.map(task => `
    <label class="task-item ${task.done ? 'done' : ''}">
      <input type="checkbox" data-task-id="${task.id}" ${task.done ? 'checked' : ''} />
      <div>
        <h4>${escapeHtml(task.title)}</h4>
        <p>${escapeHtml(task.why)}</p>
        <span class="task-tag">${escapeHtml(task.category)}</span>
      </div>
    </label>
  `).join('');

  els.taskList.querySelectorAll('input[data-task-id]').forEach(input => {
    input.addEventListener('change', () => toggleTask(input.dataset.taskId, input.checked));
  });
}

function getProgress() {
  if (!state.tasks.length) return 0;
  return Math.round((state.tasks.filter(t => t.done).length / state.tasks.length) * 100);
}

function renderProgress() {
  const pct = getProgress();
  els.sidebarProgress.style.width = `${pct}%`;
  els.sidebarProgressText.textContent = `${pct}%`;
  els.nextProgress.textContent = `${pct}%`;
  els.heroCompleted.textContent = state.tasks.filter(t => t.done).length;
}

function nextTask() {
  return state.tasks.find(t => !t.done) || null;
}

function renderNext() {
  const task = nextTask();
  const pct = getProgress();

  if (!state.project.brief) {
    els.miniNextTitle.textContent = 'Create a project';
    els.miniNextReason.textContent = 'Add your assignment brief so DA.OS can build your workflow.';
    els.nextNumber.textContent = '01';
    els.nextTitle.textContent = 'Create your project workspace';
    els.nextWhy.textContent = 'DA.OS needs the assignment brief before it can create an execution plan.';
    els.nextAction.textContent = 'Go to Workspace and paste the assignment instructions.';
    els.nextCategory.textContent = 'Setup';
    els.completeNextBtn.disabled = true;
    renderQueue([]);
    return;
  }

  if (!state.tasks.length) {
    els.miniNextTitle.textContent = 'Deconstruct the assignment';
    els.miniNextReason.textContent = 'Turn your brief into a concrete checklist before starting analysis.';
    els.nextNumber.textContent = '01';
    els.nextTitle.textContent = 'Deconstruct your assignment';
    els.nextWhy.textContent = 'A clear execution plan keeps the assignment requirements visible while you work.';
    els.nextAction.textContent = 'Run the Assignment Deconstructor to create your requirements and task checklist.';
    els.nextCategory.textContent = 'Scope';
    els.completeNextBtn.disabled = true;
    renderQueue([]);
    return;
  }

  if (!task) {
    els.miniNextTitle.textContent = 'Project complete';
    els.miniNextReason.textContent = 'Every task in the plan is marked complete. Run one final brief-to-deliverable check before submission.';
    els.nextNumber.textContent = '✓';
    els.nextTitle.textContent = 'You completed the project plan';
    els.nextWhy.textContent = 'Your checklist is complete. Export the project record or review the original brief once more before submitting.';
    els.nextAction.textContent = 'Export your DA.OS project record and verify your final deliverable against the original brief.';
    els.nextCategory.textContent = 'Complete';
    els.completeNextBtn.disabled = true;
    renderQueue([]);
    return;
  }

  const index = state.tasks.findIndex(t => t.id === task.id);
  els.miniNextTitle.textContent = task.title;
  els.miniNextReason.textContent = task.why;
  els.nextNumber.textContent = String(index + 1).padStart(2, '0');
  els.nextTitle.textContent = task.title;
  els.nextWhy.textContent = task.why;
  els.nextAction.textContent = task.action;
  els.nextCategory.textContent = task.category;
  els.nextProgress.textContent = `${pct}%`;
  els.completeNextBtn.disabled = false;
  els.completeNextBtn.dataset.taskId = task.id;
  renderQueue(state.tasks.filter(t => !t.done && t.id !== task.id).slice(0, 5));
}

function renderQueue(tasks) {
  if (!tasks.length) {
    els.queueList.className = 'queue-list empty-state';
    els.queueList.textContent = 'No additional queued tasks.';
    return;
  }
  els.queueList.className = 'queue-list';
  els.queueList.innerHTML = tasks.map((task, idx) => `
    <div class="queue-item">
      <span>${String(idx + 2).padStart(2, '0')} · ${escapeHtml(task.category)}</span>
      <strong>${escapeHtml(task.title)}</strong>
    </div>
  `).join('');
}

function toggleTask(id, done) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = done;
  saveState();
  renderTasks();
  renderProgress();
  renderNext();
}

function handleFiles(fileList) {
  const existing = new Set(state.project.files.map(f => `${f.name}-${f.size}`));
  for (const file of [...fileList]) {
    const key = `${file.name}-${file.size}`;
    if (existing.has(key)) continue;
    state.project.files.push({ name: file.name, size: file.size, type: file.type || 'file' });
    existing.add(key);
  }
  saveState('Files added');
  renderFiles();
}

function renderFiles() {
  if (!state.project.files.length) {
    els.fileList.className = 'file-list empty-state';
    els.fileList.textContent = 'No files added yet.';
    return;
  }
  els.fileList.className = 'file-list';
  els.fileList.innerHTML = state.project.files.map(file => `
    <div class="file-row">
      <span>${escapeHtml(file.name)}</span>
      <span>${formatBytes(file.size)}</span>
    </div>
  `).join('');
}

function renderAll() {
  renderHeader();
  renderRequirements();
  renderTasks();
  renderProgress();
  renderNext();
  renderFiles();
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active-view', v.id === viewId));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadSample() {
  state = structuredClone(DEFAULT_STATE);
  state.project = {
    name: 'Kickstarter Campaign Success Analysis',
    deadline: '',
    tools: ['Excel', 'Power BI'],
    brief: `Create a presentation using the Kickstarter data that makes clear recommendations on how people can create a successful Kickstarter campaign. Be sure to consider: What's the best length of time to run a campaign? What's the ideal pledge goal? What type of projects would be most successful at getting funded? Is there an ideal month/day/time to launch a campaign? Use the provided data and additional tables as needed. Maximum 5 slides.`,
    files: []
  };
  hydrateForm();
  deconstruct();
  showToast('Kickstarter sample loaded.');
}

function exportProject() {
  syncFormToState();
  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: '0.1.0',
    ...state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(state.project.name || 'da-os-project')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Project record exported.');
}

function resetProject() {
  const ok = window.confirm('Reset this project? This clears the locally saved DA.OS state in this browser.');
  if (!ok) return;
  state = structuredClone(DEFAULT_STATE);
  saveState('Project reset');
  hydrateForm();
  renderAll();
  showToast('Project reset.');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

for (const btn of document.querySelectorAll('.nav-item')) {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
}
for (const btn of document.querySelectorAll('[data-go]')) {
  btn.addEventListener('click', () => switchView(btn.dataset.go));
}

[els.projectName, els.deadline, els.assignmentBrief].forEach(input => {
  input.addEventListener('input', syncFormToState);
  input.addEventListener('change', syncFormToState);
});
els.toolChoices.addEventListener('change', syncFormToState);

els.deconstructBtn.addEventListener('click', deconstruct);
els.rebuildBtn.addEventListener('click', deconstruct);
els.completeNextBtn.addEventListener('click', () => {
  const id = els.completeNextBtn.dataset.taskId;
  if (!id) return;
  toggleTask(id, true);
  showToast('Done. NEXT updated.');
});

els.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
['dragenter', 'dragover'].forEach(eventName => {
  els.dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    els.dropzone.classList.add('dragging');
  });
});
['dragleave', 'drop'].forEach(eventName => {
  els.dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('dragging');
  });
});
els.dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

els.exportBtn.addEventListener('click', exportProject);
els.resetBtn.addEventListener('click', resetProject);
els.sampleBtn.addEventListener('click', loadSample);

hydrateForm();
renderAll();
