const PROJECT_KEY = 'daos-v0.1-state';
const EVIDENCE_KEY = 'daos-v0.7-evidence';

const $ = (id) => document.getElementById(id);
const els = {
  projectName: $('projectName'),
  projectContext: $('projectContext'),
  syncWarning: $('syncWarning'),
  coveragePct: $('coveragePct'),
  coverageLine: $('coverageLine'),
  weightedCoverage: $('weightedCoverage'),
  criteriaCount: $('criteriaCount'),
  missingCount: $('missingCount'),
  evidenceLinkedCount: $('evidenceLinkedCount'),
  verifiedCount: $('verifiedCount'),
  criterionFilter: $('criterionFilter'),
  criterionSearch: $('criterionSearch'),
  criteriaList: $('criteriaList'),
  gapsList: $('gapsList'),
  evidenceType: $('evidenceType'),
  evidenceTitle: $('evidenceTitle'),
  evidenceReference: $('evidenceReference'),
  evidenceFile: $('evidenceFile'),
  evidenceNotes: $('evidenceNotes'),
  criterionPicker: $('criterionPicker'),
  verifiedNow: $('verifiedNow'),
  addEvidenceBtn: $('addEvidenceBtn'),
  clearEvidenceBtn: $('clearEvidenceBtn'),
  evidenceFilter: $('evidenceFilter'),
  evidenceSearch: $('evidenceSearch'),
  evidenceList: $('evidenceList'),
  taskProofList: $('taskProofList'),
  saveStatus: $('saveStatus'),
  syncBtn: $('syncBtn'),
  exportBtn: $('exportBtn'),
  toast: $('toast')
};

let project = loadJson(PROJECT_KEY) || emptyProject();
let criteria = buildCriteria(project);
let state = loadEvidenceState();

function emptyProject() {
  return { project: { name: '', deadline: '', tools: [], brief: '', files: [] }, requirements: [], tasks: [] };
}

function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return null; }
}

function loadEvidenceState() {
  const saved = loadJson(EVIDENCE_KEY);
  return saved && Array.isArray(saved.evidence)
    ? { version: '0.7.0', projectSignature: saved.projectSignature || '', evidence: saved.evidence }
    : { version: '0.7.0', projectSignature: '', evidence: [] };
}

function saveState(message = 'Saved locally') {
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = message;
  clearTimeout(saveState.timer);
  saveState.timer = setTimeout(() => { els.saveStatus.textContent = 'Saved locally'; }, 1300);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

function stableHash(value) {
  const text = normalize(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseWeight(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function buildCriteria(projectState) {
  const adapter = projectState.assignmentAdapter || {};
  const candidates = [];

  (adapter.rubric || []).forEach(item => candidates.push({
    text: item.text,
    source: 'rubric',
    category: item.category || 'Rubric',
    weight: item.weight || null,
    weightPct: parseWeight(item.weight || item.text)
  }));

  (adapter.deliverables || []).forEach(item => candidates.push({
    text: item.text,
    source: 'deliverable',
    category: item.kind || 'Deliverable',
    weight: null,
    weightPct: null
  }));

  (adapter.constraints || []).forEach(item => candidates.push({
    text: item.text,
    source: 'constraint',
    category: item.kind || 'Constraint',
    weight: null,
    weightPct: null
  }));

  if (!candidates.length) {
    (projectState.requirements || []).forEach(text => candidates.push({
      text,
      source: 'deliverable',
      category: 'Requirement',
      weight: null,
      weightPct: null
    }));
  }

  const merged = new Map();
  for (const candidate of candidates) {
    if (!candidate.text || !normalize(candidate.text)) continue;
    const key = normalize(candidate.text);
    if (!merged.has(key)) {
      merged.set(key, {
        id: `criterion-${stableHash(candidate.text)}`,
        text: candidate.text.trim(),
        sources: [candidate.source],
        primarySource: candidate.source,
        category: candidate.category,
        weight: candidate.weight,
        weightPct: candidate.weightPct
      });
    } else {
      const current = merged.get(key);
      if (!current.sources.includes(candidate.source)) current.sources.push(candidate.source);
      if (candidate.source === 'rubric') {
        current.primarySource = 'rubric';
        current.category = candidate.category;
        current.weight = candidate.weight || current.weight;
        current.weightPct = candidate.weightPct ?? current.weightPct;
      }
    }
  }

  return [...merged.values()];
}

function projectSignature(projectState, criterionList) {
  return stableHash([
    projectState.project?.name || '',
    projectState.project?.brief || '',
    ...criterionList.map(item => `${item.text}|${item.weight || ''}|${item.sources.join(',')}`)
  ].join('\n'));
}

function criterionStatus(criterion) {
  const linked = state.evidence.filter(item => (item.criterionIds || []).includes(criterion.id));
  if (linked.some(item => item.verified)) return 'verified';
  if (linked.length) return 'linked';
  return 'missing';
}

function linkedEvidence(criterionId) {
  return state.evidence.filter(item => (item.criterionIds || []).includes(criterionId));
}

function syncFromAssignment() {
  project = loadJson(PROJECT_KEY) || emptyProject();
  criteria = buildCriteria(project);
  const validIds = new Set(criteria.map(item => item.id));
  let removedLinks = 0;
  state.evidence = state.evidence.map(item => {
    const before = (item.criterionIds || []).length;
    const criterionIds = (item.criterionIds || []).filter(id => validIds.has(id));
    removedLinks += before - criterionIds.length;
    return { ...item, criterionIds };
  });
  state.projectSignature = projectSignature(project, criteria);
  saveState('Assignment synced');
  renderAll();
  showToast(removedLinks ? `Synced. ${removedLinks} stale link(s) removed.` : 'Synced to the current assignment.');
}

function hydrateProjectHeader() {
  const currentSignature = projectSignature(project, criteria);
  els.projectName.textContent = project.project?.name || 'No project loaded';
  const adapter = project.assignmentAdapter;
  if (project.project?.name) {
    const rubricCount = adapter?.rubric?.length || 0;
    els.projectContext.textContent = adapter
      ? `${criteria.length} explicit criteria from the Universal Assignment Adapter${rubricCount ? ` · ${rubricCount} rubric line(s)` : ''}.`
      : `${criteria.length} requirement(s) from the current DA.OS project. Use Assignment Adapter for stronger rubric/constraint extraction.`;
  }

  const stale = state.projectSignature && state.projectSignature !== currentSignature;
  els.syncWarning.classList.toggle('hidden', !stale);
  if (stale) {
    els.syncWarning.textContent = 'The assignment changed after this evidence map was last synced. Press “Sync from assignment” before relying on coverage numbers.';
  }
}

function coverageMetrics() {
  const statuses = criteria.map(criterion => ({ criterion, status: criterionStatus(criterion) }));
  const verified = statuses.filter(item => item.status === 'verified').length;
  const linked = statuses.filter(item => item.status === 'linked').length;
  const missing = statuses.filter(item => item.status === 'missing').length;
  const pct = criteria.length ? Math.round((verified / criteria.length) * 100) : 0;

  const weighted = criteria.filter(item => item.weightPct !== null);
  const totalWeight = weighted.reduce((sum, item) => sum + item.weightPct, 0);
  const verifiedWeight = weighted
    .filter(item => criterionStatus(item) === 'verified')
    .reduce((sum, item) => sum + item.weightPct, 0);

  return { statuses, verified, linked, missing, pct, weighted, totalWeight, verifiedWeight };
}

function renderSummary() {
  const metrics = coverageMetrics();
  els.criteriaCount.textContent = criteria.length;
  els.missingCount.textContent = metrics.missing;
  els.evidenceLinkedCount.textContent = metrics.linked;
  els.verifiedCount.textContent = metrics.verified;
  els.coveragePct.textContent = `${metrics.pct}%`;
  els.coverageLine.textContent = `${metrics.verified} of ${criteria.length} criteria verified`;

  if (metrics.totalWeight > 0) {
    const weightedPct = Math.round((metrics.verifiedWeight / metrics.totalWeight) * 100);
    els.weightedCoverage.textContent = `${weightedPct}% of detected rubric weight has verified evidence — coverage only, not a grade estimate.`;
  } else {
    els.weightedCoverage.textContent = 'No percentage-weighted rubric detected. Coverage is based on explicit criteria count, not a grade estimate.';
  }
}

function renderCriteria() {
  const filter = els.criterionFilter.value;
  const search = normalize(els.criterionSearch.value);
  let rows = criteria.map(criterion => ({ criterion, status: criterionStatus(criterion) }));

  if (['missing','linked','verified'].includes(filter)) rows = rows.filter(item => item.status === filter);
  if (['rubric','deliverable','constraint'].includes(filter)) rows = rows.filter(item => item.criterion.sources.includes(filter));
  if (search) rows = rows.filter(item => normalize(`${item.criterion.text} ${item.criterion.category} ${item.criterion.sources.join(' ')}`).includes(search));

  if (!rows.length) {
    els.criteriaList.className = 'criteria-list empty-state';
    els.criteriaList.textContent = criteria.length ? 'No criteria match this filter.' : 'No criteria are available. Use Assignment Adapter or add project requirements first.';
    return;
  }

  els.criteriaList.className = 'criteria-list';
  els.criteriaList.innerHTML = rows.map(({ criterion, status }) => {
    const evidence = linkedEvidence(criterion.id);
    return `
      <div class="criterion-row">
        <div class="criterion-status">
          <span class="status-pill ${status}">${status === 'linked' ? 'evidence added' : status}</span>
          <span class="kind-pill ${criterion.primarySource}">${escapeHtml(criterion.primarySource)}</span>
          ${criterion.weight ? `<span class="weight-pill">${escapeHtml(criterion.weight)}</span>` : ''}
        </div>
        <div class="criterion-body">
          <h3>${escapeHtml(criterion.text)}</h3>
          <p>${escapeHtml(criterion.category)}${criterion.sources.length > 1 ? ` · also appears as ${escapeHtml(criterion.sources.filter(s => s !== criterion.primarySource).join(', '))}` : ''}</p>
          ${evidence.length ? `<div class="criterion-linked">${evidence.map(item => `<button data-focus-evidence="${item.id}">${escapeHtml(item.title)}${item.verified ? ' ✓' : ''}</button>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  els.criteriaList.querySelectorAll('[data-focus-evidence]').forEach(button => {
    button.addEventListener('click', () => focusEvidence(button.dataset.focusEvidence));
  });
}

function renderGaps() {
  const gaps = criteria.filter(item => criterionStatus(item) === 'missing');
  if (!gaps.length) {
    els.gapsList.className = 'gaps-list empty-state';
    els.gapsList.textContent = criteria.length ? 'Every criterion has at least one evidence item. Verify each one before submission.' : 'No criteria loaded.';
    return;
  }
  els.gapsList.className = 'gaps-list';
  els.gapsList.innerHTML = gaps.slice(0, 10).map(item => `
    <div class="gap-item">
      <strong>${escapeHtml(item.text)}</strong>
      <span>${escapeHtml(item.primarySource)}${item.weight ? ` · ${escapeHtml(item.weight)}` : ''}</span>
    </div>`).join('');
}

function renderCriterionPicker() {
  if (!criteria.length) {
    els.criterionPicker.className = 'criterion-picker-list empty-state';
    els.criterionPicker.textContent = 'No criteria available. Sync or adapt an assignment first.';
    return;
  }
  els.criterionPicker.className = 'criterion-picker-list';
  els.criterionPicker.innerHTML = criteria.map(item => `
    <label class="criterion-check">
      <input type="checkbox" value="${item.id}" />
      <span>${escapeHtml(item.text)}<small>${escapeHtml(item.primarySource)}${item.weight ? ` · ${escapeHtml(item.weight)}` : ''}</small></span>
    </label>`).join('');
}

function collectFileMeta(file) {
  if (!file) return null;
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'file',
    lastModified: file.lastModified || null
  };
}

function addEvidence() {
  const title = els.evidenceTitle.value.trim();
  const reference = els.evidenceReference.value.trim();
  const notes = els.evidenceNotes.value.trim();
  const selectedCriteria = [...els.criterionPicker.querySelectorAll('input:checked')].map(input => input.value);
  const fileMeta = collectFileMeta(els.evidenceFile.files[0]);

  if (title.length < 3) {
    showToast('Give the evidence a clear title.');
    els.evidenceTitle.focus();
    return;
  }
  if (!selectedCriteria.length) {
    showToast('Link the evidence to at least one criterion.');
    return;
  }
  if (!reference && !fileMeta && notes.length < 8) {
    showToast('Add a file, reference/location, or a short note explaining what this proves.');
    return;
  }

  state.evidence.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    type: els.evidenceType.value,
    title,
    reference,
    notes,
    file: fileMeta,
    criterionIds: selectedCriteria,
    verified: els.verifiedNow.checked,
    verifiedAt: els.verifiedNow.checked ? new Date().toISOString() : null
  });
  state.projectSignature = projectSignature(project, criteria);
  saveState('Evidence saved');
  clearEvidenceForm();
  renderAll();
  showToast(els.verifiedNow.checked ? 'Verified evidence saved.' : 'Evidence saved. Verify it after checking the actual output.');
}

function clearEvidenceForm() {
  els.evidenceType.value = 'File / artifact';
  els.evidenceTitle.value = '';
  els.evidenceReference.value = '';
  els.evidenceNotes.value = '';
  els.evidenceFile.value = '';
  els.verifiedNow.checked = false;
  els.criterionPicker.querySelectorAll('input').forEach(input => { input.checked = false; });
}

function renderEvidenceRegister() {
  const filter = els.evidenceFilter.value;
  const search = normalize(els.evidenceSearch.value);
  let items = [...state.evidence];
  if (filter === 'verified') items = items.filter(item => item.verified);
  if (filter === 'unverified') items = items.filter(item => !item.verified);
  if (search) {
    items = items.filter(item => normalize(`${item.title} ${item.type} ${item.reference} ${item.notes} ${item.file?.name || ''}`).includes(search));
  }

  if (!items.length) {
    els.evidenceList.className = 'evidence-register empty-state';
    els.evidenceList.textContent = state.evidence.length ? 'No evidence matches this filter.' : 'No evidence saved yet.';
    return;
  }

  els.evidenceList.className = 'evidence-register';
  els.evidenceList.innerHTML = items.map(item => {
    const links = (item.criterionIds || []).map(id => criteria.find(c => c.id === id)).filter(Boolean);
    return `
      <div class="evidence-record" id="evidence-${item.id}">
        <div class="evidence-record-head">
          <div>
            <div class="evidence-meta">
              <span class="mini-status ${item.verified ? 'verified' : 'linked'}">${item.verified ? 'verified' : 'needs verification'}</span>
              <span class="mini-status">${escapeHtml(item.type)}</span>
            </div>
            <h3>${escapeHtml(item.title)}</h3>
            ${item.reference ? `<p><strong>Reference:</strong> ${escapeHtml(item.reference)}</p>` : ''}
            ${item.file ? `<p><strong>File metadata:</strong> ${escapeHtml(item.file.name)} · ${formatBytes(item.file.size)}</p>` : ''}
            ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ''}
          </div>
          <div class="evidence-actions">
            <button class="small-button verify" data-verify="${item.id}">${item.verified ? 'Mark unverified' : 'Mark verified'}</button>
            <button class="small-button danger" data-delete="${item.id}">Delete</button>
          </div>
        </div>
        <div class="evidence-links">
          <strong>Linked criteria</strong>
          <div class="evidence-links-list">
            ${links.length ? links.map(link => `<span class="kind-pill ${link.primarySource}">${escapeHtml(truncate(link.text, 72))}</span>`).join('') : '<span class="mini-status">No current criterion links</span>'}
          </div>
        </div>
      </div>`;
  }).join('');

  els.evidenceList.querySelectorAll('[data-verify]').forEach(button => button.addEventListener('click', () => toggleVerified(button.dataset.verify)));
  els.evidenceList.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteEvidence(button.dataset.delete)));
}

function toggleVerified(id) {
  const item = state.evidence.find(entry => entry.id === id);
  if (!item) return;
  item.verified = !item.verified;
  item.verifiedAt = item.verified ? new Date().toISOString() : null;
  saveState(item.verified ? 'Evidence verified' : 'Verification removed');
  renderAll();
  showToast(item.verified ? 'Evidence marked verified.' : 'Evidence returned to needs-verification.');
}

function deleteEvidence(id) {
  const item = state.evidence.find(entry => entry.id === id);
  if (!item) return;
  if (!window.confirm(`Delete evidence “${item.title}”?`)) return;
  state.evidence = state.evidence.filter(entry => entry.id !== id);
  saveState('Evidence deleted');
  renderAll();
}

function focusEvidence(id) {
  els.evidenceFilter.value = 'all';
  els.evidenceSearch.value = '';
  renderEvidenceRegister();
  const target = document.getElementById(`evidence-${id}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.animate([{ outline: '3px solid #111827' }, { outline: '0 solid transparent' }], { duration: 1200 });
  }
}

function renderTaskProofPlan() {
  const tasks = project.tasks || [];
  const proofTasks = tasks.filter(task => task.evidence || task.validation);
  if (!proofTasks.length) {
    els.taskProofList.className = 'task-proof-list empty-state';
    els.taskProofList.textContent = 'No task-level evidence plan is available. Use Universal Assignment Adapter to generate one.';
    return;
  }
  els.taskProofList.className = 'task-proof-list';
  els.taskProofList.innerHTML = proofTasks.map((task, index) => `
    <div class="task-proof-item">
      <div class="task-proof-index">${String(index + 1).padStart(2, '0')}</div>
      <div>
        <h3>${escapeHtml(task.title)} ${task.done ? '✓' : ''}</h3>
        <div class="task-proof-grid">
          <div class="task-proof-box"><span>EVIDENCE EXPECTED</span><p>${escapeHtml(task.evidence || 'Not specified')}</p></div>
          <div class="task-proof-box"><span>VALIDATION</span><p>${escapeHtml(task.validation || 'Not specified')}</p></div>
        </div>
      </div>
    </div>`).join('');
}

function exportEvidenceMap() {
  const metrics = coverageMetrics();
  const payload = {
    version: '0.7.0',
    exportedAt: new Date().toISOString(),
    project: {
      name: project.project?.name || '',
      deadline: project.project?.deadline || '',
      tools: project.project?.tools || []
    },
    note: 'Coverage is evidence coverage, not a predicted grade.',
    summary: {
      criteria: criteria.length,
      missing: metrics.missing,
      evidenceAddedNotVerified: metrics.linked,
      verified: metrics.verified,
      verifiedCoveragePct: metrics.pct,
      detectedRubricWeightTotal: metrics.totalWeight,
      verifiedRubricWeight: metrics.verifiedWeight
    },
    criteria: criteria.map(item => ({ ...item, status: criterionStatus(item), linkedEvidenceIds: linkedEvidence(item.id).map(e => e.id) })),
    evidence: state.evidence,
    taskProofPlan: (project.tasks || []).map(task => ({ title: task.title, category: task.category, done: task.done, evidence: task.evidence || null, validation: task.validation || null }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(project.project?.name || 'da-os-project')}-evidence-map.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Evidence map exported.');
}

function renderAll() {
  hydrateProjectHeader();
  renderSummary();
  renderCriteria();
  renderGaps();
  renderCriterionPicker();
  renderEvidenceRegister();
  renderTaskProofPlan();
}

function truncate(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B','KB','MB','GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2300);
}

els.syncBtn.addEventListener('click', syncFromAssignment);
els.exportBtn.addEventListener('click', exportEvidenceMap);
els.addEvidenceBtn.addEventListener('click', addEvidence);
els.clearEvidenceBtn.addEventListener('click', clearEvidenceForm);
els.criterionFilter.addEventListener('change', renderCriteria);
els.criterionSearch.addEventListener('input', renderCriteria);
els.evidenceFilter.addEventListener('change', renderEvidenceRegister);
els.evidenceSearch.addEventListener('input', renderEvidenceRegister);

const currentSignature = projectSignature(project, criteria);
if (!state.projectSignature) {
  state.projectSignature = currentSignature;
  saveState();
}
renderAll();
