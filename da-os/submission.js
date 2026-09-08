const PROJECT_KEY = 'daos-v0.1-state';
const EVIDENCE_KEY = 'daos-v0.7-evidence';
const PREFLIGHT_KEY = 'daos-v0.5-preflight';
const MEMORY_KEY = 'daos-v0.4-feedback-memory';
const SUBMISSION_KEY = 'daos-v0.8-submission';

const $ = id => document.getElementById(id);
const els = {
  projectName: $('projectName'), projectContext: $('projectContext'), overallStatus: $('overallStatus'), overallExplanation: $('overallExplanation'),
  blockCount: $('blockCount'), warnCount: $('warnCount'), passCount: $('passCount'), coveragePct: $('coveragePct'), coverageLine: $('coverageLine'),
  staleWarning: $('staleWarning'), manualProgress: $('manualProgress'), manualChecklist: $('manualChecklist'), resultList: $('resultList'),
  blockerList: $('blockerList'), warningList: $('warningList'), runGateBtn: $('runGateBtn'), exportGateBtn: $('exportGateBtn'), toast: $('toast')
};

const MANUAL_CHECKS = [
  { id:'brief', title:'I re-read the original brief/rubric against the final outputs.', detail:'Every explicit question, deliverable, limit and required tool/format has a visible answer or artifact.', applies: () => true },
  { id:'numbers', title:'I traced every headline number back to its source calculation.', detail:'Key percentages, totals, averages and KPIs reconcile to the underlying Excel/SQL/Python/source calculation.', applies: project => hasAnalyticalWork(project) },
  { id:'visuals', title:'I checked every submitted visual in its final state.', detail:'Titles, units, sorting, labels, filters, legends and default interactions support the intended comparison.', applies: project => requiresVisuals(project) },
  { id:'narrative', title:'My narrative and recommendations match the actual evidence.', detail:'I did not overclaim causality/significance, and every recommendation is supported by a finding that appears in the analysis.', applies: project => requiresNarrative(project) },
  { id:'files', title:'I opened every final submission file and checked the required format/name.', detail:'Files are not corrupted, wrong-version, missing, or saved under an accidental draft/final-final filename.', applies: () => true },
  { id:'limitations', title:'I disclosed material assumptions, caveats or limitations.', detail:'Where interpretation depends on sample size, missing data, model/test assumptions, time coverage or business definitions, I made that limitation visible.', applies: project => requiresLimitations(project) }
];

let project = loadJson(PROJECT_KEY) || emptyProject();
let evidenceState = loadJson(EVIDENCE_KEY) || { projectSignature:'', evidence:[] };
let preflight = loadJson(PREFLIGHT_KEY);
let memory = loadJson(MEMORY_KEY) || { rules:[] };
let state = loadSubmissionState();
let criteria = buildCriteria(project);
let report = null;
let resultFilter = 'all';

function emptyProject() { return { project:{ name:'', deadline:'', tools:[], brief:'', files:[] }, requirements:[], tasks:[] }; }
function loadJson(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function loadSubmissionState() {
  const saved = loadJson(SUBMISSION_KEY);
  return saved && saved.manualChecks ? saved : { version:'0.8.0', manualChecks:{}, lastRunAt:null };
}
function saveState() { localStorage.setItem(SUBMISSION_KEY, JSON.stringify(state)); }
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9%]+/g,' ').trim(); }
function stableHash(value) {
  const text = normalize(value); let hash = 2166136261;
  for (let i=0;i<text.length;i+=1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash,16777619); }
  return (hash >>> 0).toString(36);
}
function parseWeight(value) {
  const match = String(value || '').match(/(\d{1,3}(?:\.\d+)?)\s*%/); if (!match) return null;
  const n = Number(match[1]); return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
function buildCriteria(projectState) {
  const adapter = projectState.assignmentAdapter || {}; const candidates = [];
  (adapter.rubric || []).forEach(item => candidates.push({ text:item.text, source:'rubric', category:item.category || 'Rubric', weight:item.weight || null, weightPct:parseWeight(item.weight || item.text) }));
  (adapter.deliverables || []).forEach(item => candidates.push({ text:item.text, source:'deliverable', category:item.kind || 'Deliverable', weight:null, weightPct:null }));
  (adapter.constraints || []).forEach(item => candidates.push({ text:item.text, source:'constraint', category:item.kind || 'Constraint', weight:null, weightPct:null }));
  if (!candidates.length) (projectState.requirements || []).forEach(text => candidates.push({ text, source:'deliverable', category:'Requirement', weight:null, weightPct:null }));
  const merged = new Map();
  for (const candidate of candidates) {
    if (!candidate.text || !normalize(candidate.text)) continue;
    const key = normalize(candidate.text);
    if (!merged.has(key)) merged.set(key,{ id:`criterion-${stableHash(candidate.text)}`, text:candidate.text.trim(), sources:[candidate.source], primarySource:candidate.source, category:candidate.category, weight:candidate.weight, weightPct:candidate.weightPct });
    else {
      const current = merged.get(key); if (!current.sources.includes(candidate.source)) current.sources.push(candidate.source);
      if (candidate.source === 'rubric') { current.primarySource='rubric'; current.category=candidate.category; current.weight=candidate.weight || current.weight; current.weightPct=candidate.weightPct ?? current.weightPct; }
    }
  }
  return [...merged.values()];
}
function projectSignature(projectState, criterionList) {
  return stableHash([projectState.project?.name || '', projectState.project?.brief || '', ...criterionList.map(item => `${item.text}|${item.weight || ''}|${item.sources.join(',')}`)].join('\n'));
}
function criterionStatus(criterion) {
  const linked = (evidenceState.evidence || []).filter(item => (item.criterionIds || []).includes(criterion.id));
  if (linked.some(item => item.verified)) return 'verified';
  if (linked.length) return 'linked';
  return 'missing';
}
function projectText(projectState=project) {
  return [projectState.project?.name, projectState.project?.brief, ...(projectState.requirements || []), ...(projectState.tasks || []).map(t => `${t.title} ${t.why || ''} ${t.action || ''} ${t.category || ''}`)].filter(Boolean).join(' ').toLowerCase();
}
function hasAnalyticalWork(projectState) { return /analy|metric|calculate|sql|python|excel|statistic|dashboard|data|kpi|rate|average|sum|revenue|churn|success/.test(projectText(projectState)); }
function requiresVisuals(projectState) { return /dashboard|power\s*bi|tableau|chart|visual|presentation|slides?|deck/.test(projectText(projectState)); }
function requiresNarrative(projectState) { return /recommend|insight|presentation|slides?|report|business case|conclusion|stakeholder|interpret/.test(projectText(projectState)); }
function requiresLimitations(projectState) { return /statistic|hypothesis|regression|correlation|recommend|limitation|assumption|model|sample/.test(projectText(projectState)); }
function requiresData(projectState) { return /dataset|\bdata\b|csv|xlsx|workbook|database|table|pandas|excel|power\s*bi|tableau/.test(projectText(projectState)) || (projectState.tasks || []).some(t => t.category === 'Data'); }
function relevantManualChecks() { return MANUAL_CHECKS.filter(check => check.applies(project)); }

function hydrate() {
  project = loadJson(PROJECT_KEY) || emptyProject(); evidenceState = loadJson(EVIDENCE_KEY) || { projectSignature:'', evidence:[] };
  preflight = loadJson(PREFLIGHT_KEY); memory = loadJson(MEMORY_KEY) || { rules:[] }; criteria = buildCriteria(project);
  els.projectName.textContent = project.project?.name || 'No project loaded';
  if (project.project?.name) {
    const unfinished = (project.tasks || []).filter(t => !t.done).length;
    els.projectContext.textContent = `${criteria.length} explicit criterion/criteria · ${(project.tasks || []).length} project tasks · ${unfinished} unfinished.`;
  }
  renderManualChecks();
}

function renderManualChecks() {
  const relevant = relevantManualChecks();
  els.manualProgress.textContent = `${relevant.filter(check => state.manualChecks[check.id]).length}/${relevant.length}`;
  els.manualChecklist.innerHTML = MANUAL_CHECKS.map(check => {
    const applies = check.applies(project); const checked = Boolean(state.manualChecks[check.id]);
    return `<label class="manual-check ${applies ? '' : 'optional'}">
      <input type="checkbox" data-manual-id="${check.id}" ${checked ? 'checked' : ''} ${applies ? '' : 'disabled'} />
      <span><strong>${escapeHtml(check.title)}</strong><p>${escapeHtml(check.detail)}</p><small>${applies ? 'Required for this assignment' : 'Not detected as relevant'}</small></span>
    </label>`;
  }).join('');
  els.manualChecklist.querySelectorAll('[data-manual-id]').forEach(input => input.addEventListener('change', () => {
    state.manualChecks[input.dataset.manualId] = input.checked; saveState(); renderManualChecks(); runGate(false);
  }));
}

function addResult(results, status, area, title, detail, action='') { results.push({ status, area, title, detail, action }); }

function runGate(showMessage=true) {
  hydrate();
  const results = [];
  const hasProject = Boolean(project.project?.name || project.project?.brief);
  const currentSignature = projectSignature(project, criteria);
  const staleEvidence = Boolean(evidenceState.projectSignature && evidenceState.projectSignature !== currentSignature);
  const statuses = criteria.map(c => ({ criterion:c, status:criterionStatus(c) }));
  const missingCriteria = statuses.filter(x => x.status === 'missing');
  const linkedCriteria = statuses.filter(x => x.status === 'linked');
  const verifiedCriteria = statuses.filter(x => x.status === 'verified');
  const unfinished = (project.tasks || []).filter(t => !t.done);
  const unfinishedQa = unfinished.filter(t => String(t.category || '').toUpperCase() === 'QA');
  const unfinishedOther = unfinished.filter(t => String(t.category || '').toUpperCase() !== 'QA');

  if (!hasProject) addResult(results,'block','Setup','No assignment/project is loaded.','Submission Gate has nothing reliable to evaluate.','Use Assignment Adapter or Workspace first.');
  else addResult(results,'pass','Setup','Project context is loaded.',project.project?.name || 'Current DA.OS project is available.');

  if (!criteria.length) addResult(results,'block','Requirements','No explicit criteria are available.','There is no requirement/rubric baseline to check against.','Run Universal Assignment Adapter or add project requirements.');
  else if (missingCriteria.length) addResult(results,'block','Requirements',`${missingCriteria.length} criterion/criteria have no linked evidence.`,`Missing proof includes: ${missingCriteria.slice(0,3).map(x => x.criterion.text).join(' · ')}${missingCriteria.length > 3 ? ' …' : ''}`,'Open Rubric + Evidence and attach proof to every mandatory criterion.');
  else addResult(results,'pass','Requirements','Every explicit criterion has at least one evidence item.',`${criteria.length} criterion/criteria have evidence coverage.`);

  if (staleEvidence) addResult(results,'block','Evidence','The evidence map is stale.','The assignment/rubric changed after V0.7 last synced, so current coverage may be misleading.','Open Rubric + Evidence and press Sync from assignment.');
  else if (criteria.length && evidenceState.projectSignature) addResult(results,'pass','Evidence','Evidence map matches the current assignment.','No assignment-signature drift detected.');
  else if (criteria.length) addResult(results,'warn','Evidence','Evidence map has not been explicitly synced yet.','Coverage can be calculated from current links, but V0.7 has no saved assignment signature.','Open Rubric + Evidence and sync once before final submission.');

  if (linkedCriteria.length) addResult(results,'warn','Evidence',`${linkedCriteria.length} criterion/criteria have evidence but are not verified.`,`Evidence exists, but no explicit verification has been recorded for: ${linkedCriteria.slice(0,3).map(x => x.criterion.text).join(' · ')}${linkedCriteria.length > 3 ? ' …' : ''}`,'Open Rubric + Evidence and verify each item after checking the actual artifact.');
  else if (verifiedCriteria.length && verifiedCriteria.length === criteria.length) addResult(results,'pass','Evidence','All covered criteria are explicitly verified.',`${verifiedCriteria.length} of ${criteria.length} criteria verified.`);

  if (unfinishedQa.length) addResult(results,'block','Workflow',`${unfinishedQa.length} final QA task(s) are unfinished.`,unfinishedQa.slice(0,3).map(t => t.title).join(' · '),'Complete the final QA tasks in NEXT before submitting.');
  else if ((project.tasks || []).some(t => String(t.category || '').toUpperCase() === 'QA')) addResult(results,'pass','Workflow','Final QA tasks are marked complete.','The DA.OS QA-stage tasks are complete.');
  if (unfinishedOther.length) addResult(results,'warn','Workflow',`${unfinishedOther.length} non-QA task(s) remain unfinished.`,unfinishedOther.slice(0,4).map(t => t.title).join(' · '),'Confirm they are truly not applicable or complete them before submission.');
  else if ((project.tasks || []).length) addResult(results,'pass','Workflow','All project tasks are marked complete.',`${project.tasks.length} task(s) complete.`);

  if (requiresData(project)) {
    if (!preflight) addResult(results,'warn','Data','No Dataset Preflight profile is available.','DA.OS cannot confirm that data types, duplicates, missingness or obvious outliers were reviewed.','Run Dataset Preflight or be certain you performed an equivalent manual data-quality review.');
    else {
      const sameProject = !preflight.projectName || !project.project?.name || preflight.projectName === project.project.name;
      if (!sameProject) addResult(results,'warn','Data','Saved Dataset Preflight may belong to another project.',`Profile project: ${preflight.projectName || 'unknown'} · current project: ${project.project?.name || 'unknown'}.`,'Re-run Dataset Preflight on the current assignment data.');
      const high = (preflight.issues || []).filter(issue => issue.severity === 'high');
      const medium = (preflight.issues || []).filter(issue => issue.severity === 'medium');
      if (high.length) addResult(results,'warn','Data',`${high.length} high-severity preflight issue(s) remain in the last profile.`,high.slice(0,3).map(i => i.title).join(' · '),'Confirm each issue was fixed, accepted, or explained in the analysis.');
      else addResult(results,'pass','Data','No high-severity issue appears in the saved Dataset Preflight.',`${medium.length} medium-severity issue(s) in the saved profile.`);
      if (preflight.truncated) addResult(results,'warn','Data','Dataset Preflight was truncated for profiling.',`Only ${Number(preflight.profiledRows || 0).toLocaleString()} of ${Number(preflight.rows || 0).toLocaleString()} rows were profiled.`,'Consider whether a full-data validation is needed for the final numbers.');
    }
  }

  const context = projectText(project);
  const matchedBlockerRules = (memory.rules || []).filter(rule => rule.active && rule.severity === 'blocker' && (rule.triggers || []).some(trigger => context.includes(String(trigger).toLowerCase())));
  if (matchedBlockerRules.length) addResult(results,'warn','Feedback',`${matchedBlockerRules.length} active blocker-level feedback rule(s) match this project.`,matchedBlockerRules.slice(0,3).map(r => r.lesson).join(' · '),'Review these rules in Feedback Memory and confirm the final work addresses them.');
  else addResult(results,'pass','Feedback','No active blocker-level feedback rule matched the project context.','Feedback Memory did not surface a blocker signal for the current assignment text/tasks.');

  for (const check of relevantManualChecks()) {
    if (state.manualChecks[check.id]) addResult(results,'pass','Manual QA',check.title,'Learner explicitly confirmed this final check.');
    else addResult(results,'block','Manual QA',check.title,check.detail,'Complete this check and tick the confirmation before relying on a PASS.');
  }

  const weighted = criteria.filter(c => c.weightPct !== null);
  const totalWeight = weighted.reduce((sum,c) => sum + c.weightPct,0);
  const verifiedWeight = weighted.filter(c => criterionStatus(c) === 'verified').reduce((sum,c) => sum + c.weightPct,0);
  const verifiedPct = criteria.length ? Math.round((verifiedCriteria.length / criteria.length) * 100) : 0;
  const weightedPct = totalWeight ? Math.round((verifiedWeight / totalWeight) * 100) : null;
  const blocks = results.filter(r => r.status === 'block'); const warns = results.filter(r => r.status === 'warn'); const passes = results.filter(r => r.status === 'pass');
  const overall = blocks.length ? 'block' : warns.length ? 'warn' : 'pass';

  report = { version:'0.8.0', generatedAt:new Date().toISOString(), projectName:project.project?.name || '', overall, counts:{ block:blocks.length, warn:warns.length, pass:passes.length }, coverage:{ criteria:criteria.length, verified:verifiedCriteria.length, linked:linkedCriteria.length, missing:missingCriteria.length, verifiedPct, detectedRubricWeight:totalWeight || null, verifiedRubricWeight:totalWeight ? verifiedWeight : null, verifiedRubricWeightPct:weightedPct }, staleEvidence, results, manualChecks:{...state.manualChecks} };
  state.lastRunAt = report.generatedAt; saveState(); renderReport();
  if (showMessage) showToast(overall === 'pass' ? 'Gate passed with no current warnings.' : overall === 'warn' ? 'Gate completed with warnings to review.' : 'Gate blocked. Resolve the listed blockers before submitting.');
}

function renderReport() {
  if (!report) return;
  els.blockCount.textContent = report.counts.block; els.warnCount.textContent = report.counts.warn; els.passCount.textContent = report.counts.pass;
  els.coveragePct.textContent = `${report.coverage.verifiedPct}%`; els.coverageLine.textContent = `${report.coverage.verified}/${report.coverage.criteria} verified criteria`;
  els.overallStatus.className = `overall-status ${report.overall}`;
  const label = report.overall.toUpperCase(); els.overallStatus.querySelector('strong').textContent = label;
  els.overallExplanation.textContent = report.overall === 'block' ? 'Resolve every blocker before relying on the project as submission-ready.' : report.overall === 'warn' ? 'No hard blocker remains, but one or more issues still require judgment.' : 'No current blocker or warning was detected. This is not a grade guarantee.';
  els.staleWarning.classList.toggle('hidden', !report.staleEvidence);
  if (report.staleEvidence) els.staleWarning.textContent = 'BLOCK: The V0.7 evidence map does not match the current assignment. Sync evidence before relying on coverage.';
  renderResults(); renderPriorityLists();
}

function renderResults() {
  let rows = report ? report.results : [];
  if (resultFilter !== 'all') rows = rows.filter(r => r.status === resultFilter);
  if (!rows.length) { els.resultList.className='gate-result-list empty-state'; els.resultList.textContent='No checks match this filter.'; return; }
  els.resultList.className='gate-result-list';
  els.resultList.innerHTML = rows.map(r => `<div class="gate-result ${r.status}"><div class="gate-status">${escapeHtml(r.status)} · ${escapeHtml(r.area)}</div><div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.detail)}</p>${r.action ? `<p class="gate-action">Next: ${escapeHtml(r.action)}</p>` : ''}</div></div>`).join('');
}
function renderPriorityLists() {
  const blocks = report.results.filter(r => r.status === 'block'); const warns = report.results.filter(r => r.status === 'warn');
  els.blockerList.className = blocks.length ? 'priority-list' : 'priority-list empty-state';
  els.blockerList.innerHTML = blocks.length ? blocks.map(r => `<div class="priority-item block"><strong>${escapeHtml(r.title)}</strong><p>${escapeHtml(r.action || r.detail)}</p></div>`).join('') : 'No blockers detected.';
  els.warningList.className = warns.length ? 'priority-list' : 'priority-list empty-state';
  els.warningList.innerHTML = warns.length ? warns.map(r => `<div class="priority-item warn"><strong>${escapeHtml(r.title)}</strong><p>${escapeHtml(r.action || r.detail)}</p></div>`).join('') : 'No warnings detected.';
}

function exportReport() {
  if (!report) runGate(false);
  const blob = new Blob([JSON.stringify(report,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`${slugify(project.project?.name || 'da-os-project')}-submission-gate.json`; a.click(); URL.revokeObjectURL(url); showToast('Submission Gate report exported.');
}
function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function showToast(message) { els.toast.textContent=message; els.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>els.toast.classList.remove('show'),2300); }

els.runGateBtn.addEventListener('click', () => runGate(true));
els.exportGateBtn.addEventListener('click', exportReport);
document.querySelectorAll('[data-result-filter]').forEach(button => button.addEventListener('click', () => {
  resultFilter = button.dataset.resultFilter; document.querySelectorAll('[data-result-filter]').forEach(b => b.classList.toggle('active', b === button)); renderResults();
}));
window.addEventListener('storage', () => { hydrate(); runGate(false); });
hydrate();
runGate(false);