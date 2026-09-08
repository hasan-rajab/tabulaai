const PROJECT_KEY = 'daos-v0.1-state';

const $ = (id) => document.getElementById(id);
const els = {
  assignmentName: $('assignmentName'),
  assignmentBrief: $('assignmentBrief'),
  rubricText: $('rubricText'),
  assignmentDropzone: $('assignmentDropzone'),
  assignmentFile: $('assignmentFile'),
  fileStatus: $('fileStatus'),
  analyseBtn: $('analyseBtn'),
  usePlanBtn: $('usePlanBtn'),
  usePlanBottomBtn: $('usePlanBottomBtn'),
  sampleBtn: $('sampleBtn'),
  resetBtn: $('resetBtn'),
  confidenceBadge: $('confidenceBadge'),
  typeChips: $('typeChips'),
  toolChips: $('toolChips'),
  workMode: $('workMode'),
  firstDecision: $('firstDecision'),
  ambiguityBox: $('ambiguityBox'),
  deliverableCount: $('deliverableCount'),
  deliverableList: $('deliverableList'),
  constraintCount: $('constraintCount'),
  constraintList: $('constraintList'),
  rubricCount: $('rubricCount'),
  rubricList: $('rubricList'),
  taskCount: $('taskCount'),
  taskGraph: $('taskGraph'),
  evidenceList: $('evidenceList'),
  validationList: $('validationList'),
  toast: $('toast')
};

const TYPE_RULES = [
  { name: 'Data cleaning', patterns: [/clean/i, /missing/i, /duplicate/i, /data quality/i, /prepare the data/i, /transform/i, /wrangl/i] },
  { name: 'Exploratory analysis', patterns: [/exploratory/i, /eda\b/i, /explore the data/i, /identify trends/i, /patterns/i, /insights/i, /descriptive statistics/i] },
  { name: 'Excel analysis', patterns: [/excel/i, /pivot table/i, /pivotchart/i, /vlookup/i, /xlookup/i, /spreadsheet/i, /formula/i] },
  { name: 'SQL exercise', patterns: [/\bsql\b/i, /query/i, /database/i, /join/i, /group by/i, /window function/i, /cte\b/i] },
  { name: 'Python / pandas', patterns: [/python/i, /pandas/i, /jupyter/i, /notebook/i, /matplotlib/i, /numpy/i] },
  { name: 'Statistics', patterns: [/hypothesis/i, /statistical/i, /significance/i, /confidence interval/i, /regression/i, /correlation/i, /anova/i, /t[- ]?test/i, /chi[- ]?square/i, /normality/i] },
  { name: 'Dashboard', patterns: [/dashboard/i, /interactive/i, /filter/i, /slicer/i, /kpi/i, /business intelligence/i, /bi report/i] },
  { name: 'Power BI', patterns: [/power\s*bi/i, /dax\b/i, /power query/i, /pbix/i] },
  { name: 'Tableau', patterns: [/tableau/i, /calculated field/i, /story point/i] },
  { name: 'Presentation', patterns: [/presentation/i, /slides?/i, /powerpoint/i, /deck/i, /present your findings/i] },
  { name: 'Business case', patterns: [/business case/i, /recommend/i, /stakeholder/i, /decision/i, /actionable/i, /strategy/i, /business recommendation/i] },
  { name: 'Capstone / end-to-end', patterns: [/capstone/i, /end[- ]to[- ]end/i, /final project/i, /independent project/i, /portfolio project/i] }
];

const TOOL_RULES = [
  { name: 'Excel', patterns: [/excel/i, /spreadsheet/i, /pivot table/i, /xlookup/i, /vlookup/i] },
  { name: 'SQL', patterns: [/\bsql\b/i, /query/i, /database/i, /join/i, /cte\b/i] },
  { name: 'Python', patterns: [/python/i, /pandas/i, /jupyter/i, /notebook/i] },
  { name: 'Power BI', patterns: [/power\s*bi/i, /dax\b/i, /pbix/i, /power query/i] },
  { name: 'Tableau', patterns: [/tableau/i] },
  { name: 'Statistics', patterns: [/statistics?/i, /hypothesis/i, /regression/i, /correlation/i, /significance/i] }
];

const DELIVERY_SIGNALS = /create|build|produce|submit|deliver|prepare|write|analyse|analyze|calculate|determine|identify|find|compare|evaluate|recommend|present|visuali[sz]e|design|develop|answer|report|dashboard|presentation|slides?|notebook|query|queries|workbook|chart|table|model/i;
const CONSTRAINT_SIGNALS = /must|required|should|maximum|max\.?|minimum|min\.?|at least|no more than|up to|only|using|use\s+(?:excel|sql|python|tableau|power\s*bi)|do not|cannot|without|format|file type|pages?|slides?|minutes?|deadline|due|individual|group|team|include|exclude/i;

const SAMPLE = {
  name: 'Customer Churn Decision Project',
  brief: `Using the provided customer dataset, analyse the drivers of customer churn. Clean and prepare the data, use SQL for at least two analytical queries, and use Python/pandas for deeper exploration. Build an interactive Power BI dashboard showing churn rate, customer segments and the strongest churn drivers. Create a maximum 5-slide presentation with three evidence-backed recommendations for the retention team. Include limitations and explain how you validated your results.`,
  rubric: `Data preparation and quality — 20%\nAnalysis and metric correctness — 25%\nPower BI dashboard and visual communication — 20%\nBusiness recommendations — 20%\nPresentation quality and limitations — 15%`
};

let analysis = null;
let loadedFileMeta = null;

function normalizeText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textUnits(text) {
  const lines = normalizeText(text)
    .split(/\n+/)
    .map(line => line.replace(/^\s*[-•*–—]+\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
  return lines.flatMap(line => line.length > 220
    ? line.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean)
    : [line]);
}

function countMatches(text, patterns) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function detectTypes(text) {
  const scored = TYPE_RULES
    .map(rule => ({ name: rule.name, score: countMatches(text, rule.patterns) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [{ name: 'General analytics assignment', score: 1 }];
  const max = scored[0].score;
  return scored.filter(item => item.score >= Math.max(1, max - 2)).slice(0, 6);
}

function detectTools(text) {
  return TOOL_RULES
    .map(rule => ({ name: rule.name, score: countMatches(text, rule.patterns) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function extractDeliverables(brief, rubric) {
  const units = [...textUnits(brief), ...textUnits(rubric)];
  const selected = units.filter(unit => DELIVERY_SIGNALS.test(unit));
  const unique = uniqueText(selected.length ? selected : units).slice(0, 18);

  return unique.map(text => ({
    text,
    source: rubric && rubric.includes(text) ? 'Rubric' : 'Brief',
    kind: inferDeliverableKind(text)
  }));
}

function inferDeliverableKind(text) {
  if (/dashboard|power\s*bi|tableau/i.test(text)) return 'Dashboard';
  if (/presentation|slides?|deck|powerpoint/i.test(text)) return 'Presentation';
  if (/sql|query|queries/i.test(text)) return 'SQL';
  if (/python|notebook|pandas/i.test(text)) return 'Python';
  if (/report|write|document/i.test(text)) return 'Report';
  if (/recommend/i.test(text)) return 'Recommendation';
  if (/clean|prepare|dataset/i.test(text)) return 'Data';
  return 'Analysis';
}

function extractConstraints(brief, rubric) {
  const units = [...textUnits(brief), ...textUnits(rubric)];
  const selected = units.filter(unit => CONSTRAINT_SIGNALS.test(unit));
  const explicitNumbers = units.filter(unit => /\b(max(?:imum)?|min(?:imum)?|at least|no more than|up to|exactly)\b.*\d+|\b\d+\s*(slides?|pages?|minutes?|recommendations?|queries?|charts?|dashboards?)\b/i.test(unit));
  return uniqueText([...explicitNumbers, ...selected]).slice(0, 16).map(text => ({ text, kind: inferConstraintKind(text) }));
}

function inferConstraintKind(text) {
  if (/slide|page|minute|maximum|max\.?|minimum|min\.?|at least|no more than|up to|exactly/i.test(text)) return 'Quantity / limit';
  if (/excel|sql|python|tableau|power\s*bi|using|must use/i.test(text)) return 'Tool';
  if (/deadline|due/i.test(text)) return 'Deadline';
  if (/individual|group|team/i.test(text)) return 'Work mode';
  if (/format|file|pdf|pptx|xlsx|ipynb/i.test(text)) return 'Format';
  return 'Requirement';
}

function parseRubric(rubric, brief) {
  const source = normalizeText(rubric) || textUnits(brief).filter(line => /\b\d{1,3}\s*%|points?|marks?|rubric|grading|criteria/i.test(line)).join('\n');
  if (!source) return [];

  return uniqueText(textUnits(source)).slice(0, 14).map(text => {
    const pctMatch = text.match(/\b(\d{1,3})\s*%/);
    const pointsMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:points?|pts|marks?)\b/i);
    return {
      text,
      weight: pctMatch ? `${pctMatch[1]}%` : pointsMatch ? `${pointsMatch[1]} pts` : null,
      category: inferRubricCategory(text)
    };
  });
}

function inferRubricCategory(text) {
  if (/clean|quality|prepare/i.test(text)) return 'Data';
  if (/analysis|metric|statistic|correct/i.test(text)) return 'Analysis';
  if (/visual|dashboard|tableau|power\s*bi|chart/i.test(text)) return 'Visualisation';
  if (/recommend|business|insight/i.test(text)) return 'Recommendations';
  if (/present|communication|story|slide/i.test(text)) return 'Communication';
  if (/code|sql|python/i.test(text)) return 'Technical';
  return 'General';
}

function inferWorkMode(text) {
  if (/\b(group|team|pair|pairs|collaborat)/i.test(text)) return 'Collaborative / team';
  if (/\bindividual|independent/i.test(text)) return 'Individual';
  return 'Not explicitly stated';
}

function buildAmbiguities(text, types, deliverables, rubric) {
  const gaps = [];
  if (!deliverables.length) gaps.push('The final deliverable is not explicit. Confirm what file/output must be submitted.');
  if (/analyse|analyze|rate|metric|outcome|success|churn|conversion/i.test(text) && !/defined as|means|calculated as|formula|numerator|denominator/i.test(text)) {
    gaps.push('A metric/outcome is requested but its exact definition may not be explicit. Define it before calculating.');
  }
  if (/dashboard|report|presentation/i.test(text) && !/audience|stakeholder|for the|management|team|client|customer/i.test(text)) {
    gaps.push('The audience is unclear. Confirm who should make a decision from the final output.');
  }
  if (/dataset|data|csv|excel|database/i.test(text) && !/provided|attached|given|source|table|file/i.test(text)) {
    gaps.push('The data source is unclear. Confirm which dataset/table/file is authoritative.');
  }
  if (!rubric.length) gaps.push('No explicit grading rubric was detected. Treat every deliverable and stated constraint as mandatory until a rubric is provided.');
  if (types[0]?.name === 'General analytics assignment') gaps.push('The assignment type is weakly specified. Review the generated plan and remove steps that do not apply.');
  return gaps.slice(0, 5);
}

function firstDecisionFor(types, text) {
  const names = new Set(types.map(item => item.name));
  if (names.has('Statistics')) return 'Define the exact question/hypothesis, outcome variable and comparison before choosing a statistical test.';
  if (names.has('SQL exercise')) return 'Confirm the schema and the grain of every table before writing joins or aggregations.';
  if (names.has('Dashboard') || names.has('Power BI') || names.has('Tableau')) return 'Define the audience, decision and KPIs before designing visuals.';
  if (names.has('Presentation')) return 'Identify the questions the presentation must answer before choosing charts or slide structure.';
  if (/dataset|csv|xlsx|excel file|data/i.test(text)) return 'Inspect the dataset and define the outcome/metric before doing analysis.';
  return 'Translate the brief into explicit questions and deliverables before opening a tool.';
}

function makeTask(title, why, action, category, evidence, validation) {
  return { id: crypto.randomUUID(), title, why, action, category, evidence, validation, done: false };
}

function buildTaskGraph(text, types, tools, rubric) {
  const names = new Set(types.map(item => item.name));
  const tasks = [];
  const seen = new Set();
  const add = (task) => {
    if (!seen.has(task.title)) { seen.add(task.title); tasks.push(task); }
  };

  add(makeTask(
    'Lock the assignment requirements',
    'Starting in a tool before the deliverables and limits are explicit is the fastest way to do unnecessary work or miss marks.',
    'Turn the brief and rubric into a checklist of questions, outputs, tool requirements, limits and grading criteria. Resolve anything genuinely ambiguous.',
    'Scope',
    'A requirements checklist tied to the original brief/rubric.',
    'Every explicit deliverable and numeric/tool constraint from the brief appears once in the checklist.'
  ));

  if (/dataset|data|csv|xlsx|excel|database|table|workbook/i.test(text) || names.has('Data cleaning') || names.has('Exploratory analysis')) {
    add(makeTask(
      'Preflight the source data',
      'You need the dataset grain, fields, types, missingness and obvious quality problems before deciding how to analyse it.',
      'Run Dataset Preflight or inspect the source manually. Record row count, field types, missing values, duplicates, identifiers, likely measures/dimensions and the data grain.',
      'Data',
      'A preflight/profile summary plus a one-sentence statement of dataset grain.',
      'You can explain what one row represents and identify the fields needed for the assignment.'
    ));
  }

  if (names.has('Data cleaning')) {
    add(makeTask(
      'Clean only what the analysis requires',
      'Cleaning everything wastes time; cleaning too little contaminates the result.',
      'Create a reproducible cleaning step for required fields: types, missing values, duplicates, inconsistent categories, date parsing and invalid values.',
      'Data',
      'Cleaning log/query/notebook steps showing every material transformation.',
      'Re-run the profile and confirm the issues affecting required fields are resolved or explicitly accepted.'
    ));
  }

  if (/rate|percentage|metric|kpi|outcome|success|churn|conversion|revenue|profit|retention|average/i.test(text)) {
    add(makeTask(
      'Define the key metric before calculating it',
      'A technically correct formula can still answer the wrong business question if the numerator, denominator, population or time window is wrong.',
      'Write the metric definition in plain language: numerator, denominator/aggregation, eligible population, grain, exclusions and time period.',
      'Metric',
      'A written metric definition next to the formula/query/measure that implements it.',
      'Manually reproduce the metric on a tiny subset and confirm the implementation matches the written definition.'
    ));
  }

  if (names.has('SQL exercise')) {
    add(makeTask(
      'Map SQL tables and grain',
      'Joins and aggregations are only safe when you know what one row means in each table.',
      'List required tables, keys and one-row grain. Identify one-to-many joins before writing the final query.',
      'SQL',
      'Schema/grain notes plus the base table and join keys.',
      'Row counts before/after joins are explainable and no metric is accidentally duplicated.'
    ));
    add(makeTask(
      'Build SQL in small validated queries',
      'Small queries make logic and mistakes visible before complexity compounds.',
      'Write one requirement at a time using the simplest SELECT/FROM/WHERE/GROUP BY/JOIN/window structure needed. Validate totals before adding the next layer.',
      'SQL',
      'Saved SQL queries and small result snapshots for each required question.',
      'Each query answers one stated requirement and key counts/totals reconcile to a simpler query or source check.'
    ));
  }

  if (names.has('Python / pandas')) {
    add(makeTask(
      'Build the Python analysis incrementally',
      'Notebook code is easier to learn and debug when every transformation has an observable before/after state.',
      'Load the data, inspect shape/dtypes, then perform one transformation or analysis step per logical cell. Keep outputs that validate each step.',
      'Python',
      'A readable notebook/script with intermediate checks and final outputs.',
      'The notebook runs top-to-bottom from a clean kernel and produces the same key results.'
    ));
  }

  if (names.has('Exploratory analysis') || names.has('Business case') || /analyse|analyze|compare|trend|driver|segment|insight/i.test(text)) {
    add(makeTask(
      'Answer the analytical questions one at a time',
      'Exploration should serve the assignment questions rather than produce charts with no decision value.',
      'For each required question, choose the metric, comparison dimension, filters and grain. Analyse it and write the one-sentence finding before moving on.',
      'Analysis',
      'A result table/chart plus a one-sentence finding for each required question.',
      'Every finding can be traced to a requirement and reproduced from the analysis output.'
    ));
  }

  if (names.has('Statistics')) {
    add(makeTask(
      'Choose the statistical method from the question',
      'A test should follow the hypothesis, variable types and assumptions—not be chosen because it is familiar.',
      'State H0/H1, identify variable types and independence, check relevant assumptions, then select the test/model and significance level.',
      'Statistics',
      'Hypotheses, assumption checks and the rationale for the selected method.',
      'The chosen method matches the data structure and assumptions; violations are handled or disclosed.'
    ));
    add(makeTask(
      'Report statistical evidence without overclaiming',
      'P-values alone do not communicate practical importance or prove causality.',
      'Report the estimate/effect, uncertainty or confidence interval where appropriate, test result, sample size and a plain-language interpretation with limitations.',
      'Statistics',
      'Statistical output plus a written interpretation.',
      'The narrative distinguishes association from causation and matches the actual statistical result.'
    ));
  }

  if (names.has('Dashboard') || names.has('Power BI') || names.has('Tableau')) {
    add(makeTask(
      'Design the dashboard around decisions',
      'A dashboard is useful when each visual helps the target audience answer a specific question.',
      'Define audience, decision, KPIs and the minimum visual set. Sketch the page structure before formatting.',
      'Visualisation',
      'A wireframe or list mapping each visual to a question/KPI.',
      'Every visual has a purpose, correct units, useful sorting and no redundant chart.'
    ));
    add(makeTask(
      'Build and cross-check the dashboard',
      'Interactive filters and calculated measures can make a polished dashboard silently inconsistent with the source analysis.',
      'Build measures/fields, visuals and interactions. Test filters, totals, labels, units, empty states and at least one number against the source calculation.',
      names.has('Power BI') ? 'Power BI' : names.has('Tableau') ? 'Tableau' : 'Dashboard',
      'Dashboard file/link plus screenshots and a list of core measures/calculated fields.',
      'Headline KPIs reconcile to source calculations under default and at least one filtered state.'
    ));
  }

  if (names.has('Business case') || /recommend/i.test(text)) {
    add(makeTask(
      'Convert findings into evidence-backed recommendations',
      'A finding describes what happened; a recommendation states what someone should do because of that evidence.',
      'For each recommendation, state the action, supporting finding/number, intended outcome, and one limitation or trade-off.',
      'Synthesis',
      'A recommendation table linking action → evidence → expected impact → caveat.',
      'No recommendation relies on a finding that is absent from the analysis.'
    ));
  }

  if (names.has('Presentation')) {
    add(makeTask(
      'Build the presentation from the required story',
      'A presentation should communicate the answer, not replay every analysis step.',
      'Create a slide outline from the assignment questions: context, strongest evidence, recommendation/decision and limitations. Respect explicit slide/time limits.',
      'Delivery',
      'Final deck plus a source note for every important number/chart.',
      'Every slide supports a required question, all numbers match the analysis, and the deck fits the stated limit.'
    ));
  }

  if (names.has('Capstone / end-to-end')) {
    add(makeTask(
      'Create milestone checkpoints',
      'End-to-end projects become chaotic if cleaning, analysis, visuals and delivery all move at once.',
      'Set milestone gates for scope, data readiness, analysis complete, visual/dashboard complete, QA and final delivery.',
      'Project',
      'A milestone checklist with completion criteria.',
      'No downstream milestone is marked complete while its prerequisite evidence is missing.'
    ));
  }

  add(makeTask(
    'Reconcile the final numbers across outputs',
    'The same metric can drift between Excel/SQL/Python/dashboard/slides when filters, refreshes or definitions differ.',
    'Choose every headline number and trace it back to its source calculation. Compare duplicated metrics across all submitted outputs.',
    'QA',
    'A final-number checklist with source references.',
    'Every repeated KPI/figure agrees across analysis, dashboard and presentation/report or has an explained reason for differing.'
  ));

  add(makeTask(
    'Run the brief-and-rubric submission gate',
    'Completion means there is evidence for every required item, not merely that the work feels finished.',
    'Read the original brief and rubric line by line. For each item, point to the exact file, query, chart, slide, calculation or paragraph proving it is satisfied.',
    'QA',
    'A requirement → evidence mapping with no mandatory item left blank.',
    'All mandatory deliverables/constraints have evidence, filenames are correct, and no unresolved blocker remains.'
  ));

  return tasks;
}

function deriveEvidence(tasks) {
  return uniqueText(tasks.map(task => task.evidence).filter(Boolean)).map((text, idx) => ({ text, kind: `Evidence ${idx + 1}` }));
}

function deriveValidation(tasks) {
  return uniqueText(tasks.map(task => task.validation).filter(Boolean)).map((text, idx) => ({ text, kind: `Check ${idx + 1}` }));
}

function confidenceFor(types, deliverables, constraints, rubric, ambiguities) {
  let score = 0;
  score += Math.min(types.length, 4) * 2;
  score += Math.min(deliverables.length, 6);
  score += Math.min(constraints.length, 4);
  score += Math.min(rubric.length, 3);
  score -= ambiguities.length * 2;
  if (score >= 12) return { level: 'high', label: 'High structure' };
  if (score >= 6) return { level: 'medium', label: 'Moderate structure' };
  return { level: 'low', label: 'Needs review' };
}

function analyseAssignment() {
  const brief = normalizeText(els.assignmentBrief.value);
  const rubricText = normalizeText(els.rubricText.value);
  if (!brief) {
    showToast('Paste or load the assignment instructions first.');
    els.assignmentBrief.focus();
    return;
  }

  const combined = `${brief}\n${rubricText}`;
  const types = detectTypes(combined);
  const tools = detectTools(combined);
  const deliverables = extractDeliverables(brief, rubricText);
  const constraints = extractConstraints(brief, rubricText);
  const rubric = parseRubric(rubricText, brief);
  const ambiguities = buildAmbiguities(combined, types, deliverables, rubric);
  const tasks = buildTaskGraph(combined, types, tools, rubric);
  const confidence = confidenceFor(types, deliverables, constraints, rubric, ambiguities);

  analysis = {
    version: '0.6.0',
    generatedAt: new Date().toISOString(),
    name: normalizeText(els.assignmentName.value) || inferName(brief, types),
    brief,
    rubricText,
    types,
    tools,
    deliverables,
    constraints,
    rubric,
    ambiguities,
    workMode: inferWorkMode(combined),
    firstDecision: firstDecisionFor(types, combined),
    tasks,
    evidence: deriveEvidence(tasks),
    validation: deriveValidation(tasks),
    confidence,
    sourceFile: loadedFileMeta
  };

  renderAnalysis();
  els.usePlanBtn.disabled = false;
  els.usePlanBottomBtn.disabled = false;
  showToast(`Built a ${tasks.length}-step workflow for this assignment.`);
}

function inferName(brief, types) {
  const first = textUnits(brief)[0] || '';
  if (first.length >= 5 && first.length <= 90 && !/[.!?]$/.test(first)) return first;
  return `${types[0]?.name || 'Analytics'} Project`;
}

function renderAnalysis() {
  if (!analysis) return;
  els.confidenceBadge.className = `adapter-badge ${analysis.confidence.level}`;
  els.confidenceBadge.textContent = analysis.confidence.label;
  renderChips(els.typeChips, analysis.types.map(item => ({ label: item.name, detail: `score ${item.score}` })));
  renderChips(els.toolChips, analysis.tools.map(item => ({ label: item.name, detail: item.score > 1 ? `${item.score} signals` : 'detected' })));
  els.workMode.textContent = analysis.workMode;
  els.firstDecision.textContent = analysis.firstDecision;

  if (analysis.ambiguities.length) {
    els.ambiguityBox.classList.remove('hidden');
    els.ambiguityBox.innerHTML = `<strong>Confirm before committing</strong><ul>${analysis.ambiguities.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  } else {
    els.ambiguityBox.classList.add('hidden');
  }

  renderList(els.deliverableList, analysis.deliverables, 'deliverable');
  renderList(els.constraintList, analysis.constraints, 'constraint');
  els.deliverableCount.textContent = analysis.deliverables.length;
  els.constraintCount.textContent = analysis.constraints.length;
  renderRubric();
  renderTasks();
  renderList(els.evidenceList, analysis.evidence, 'evidence');
  renderList(els.validationList, analysis.validation, 'validation');
}

function renderChips(container, items) {
  if (!items.length) {
    container.className = 'chip-cloud empty-state';
    container.textContent = 'Not explicitly detected';
    return;
  }
  container.className = 'chip-cloud';
  container.innerHTML = items.map(item => `<span class="adapter-chip">${escapeHtml(item.label)}${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</span>`).join('');
}

function renderList(container, items, kind) {
  if (!items.length) {
    container.className = 'adapter-list empty-state';
    container.textContent = `No ${kind} items detected.`;
    return;
  }
  container.className = 'adapter-list';
  container.innerHTML = items.map((item, idx) => `
    <div class="adapter-item">
      <strong>${escapeHtml(item.text)}</strong>
      <div class="item-meta">
        <span class="mini-pill">${escapeHtml(item.kind || item.source || `${kind} ${idx + 1}`)}</span>
        ${item.source ? `<span class="mini-pill">${escapeHtml(item.source)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderRubric() {
  els.rubricCount.textContent = analysis.rubric.length;
  if (!analysis.rubric.length) {
    els.rubricList.className = 'rubric-list empty-state';
    els.rubricList.textContent = 'No explicit rubric detected. The adapter will use deliverables and constraints as the submission checklist.';
    return;
  }
  els.rubricList.className = 'rubric-list';
  els.rubricList.innerHTML = analysis.rubric.map(item => `
    <div class="rubric-item ${item.weight ? 'weighted' : ''}">
      ${item.weight ? `<div class="rubric-weight">${escapeHtml(item.weight)}</div>` : ''}
      <strong>${escapeHtml(item.text)}</strong>
      <div class="item-meta"><span class="mini-pill">${escapeHtml(item.category)}</span></div>
    </div>
  `).join('');
}

function renderTasks() {
  els.taskCount.textContent = analysis.tasks.length;
  els.taskGraph.className = 'task-graph';
  els.taskGraph.innerHTML = analysis.tasks.map((task, idx) => `
    <div class="graph-step">
      <div class="graph-step-number">${String(idx + 1).padStart(2, '0')}</div>
      <div>
        <h3>${escapeHtml(task.title)}</h3>
        <p>${escapeHtml(task.why)}</p>
        <div class="graph-step-grid">
          <div class="graph-note"><span>DO</span><p>${escapeHtml(task.action)}</p></div>
          <div class="graph-note"><span>EVIDENCE</span><p>${escapeHtml(task.evidence)}</p></div>
          <div class="graph-note"><span>VALIDATE</span><p>${escapeHtml(task.validation)}</p></div>
        </div>
        <span class="graph-category">${escapeHtml(task.category)}</span>
      </div>
    </div>
  `).join('');
}

function usePlan() {
  if (!analysis) return;
  const existing = loadProject();
  const previousDone = new Map((existing.tasks || []).map(task => [task.title, Boolean(task.done)]));
  const supportedTools = analysis.tools.map(item => item.name).filter(name => ['Excel','SQL','Python','Power BI','Tableau'].includes(name));

  const requirements = uniqueText([
    ...analysis.deliverables.map(item => item.text),
    ...analysis.constraints.map(item => item.text),
    ...analysis.rubric.map(item => item.text)
  ]).slice(0, 30);

  const files = [...(existing.project?.files || [])];
  if (analysis.sourceFile && !files.some(file => file.name === analysis.sourceFile.name && file.size === analysis.sourceFile.size)) {
    files.push(analysis.sourceFile);
  }

  const nextState = {
    ...existing,
    project: {
      ...(existing.project || {}),
      name: analysis.name,
      deadline: existing.project?.deadline || '',
      tools: supportedTools,
      brief: analysis.rubricText ? `${analysis.brief}\n\nRUBRIC / GRADING CRITERIA\n${analysis.rubricText}` : analysis.brief,
      files
    },
    requirements,
    tasks: analysis.tasks.map(task => ({ ...task, done: previousDone.get(task.title) || false })),
    assignmentAdapter: {
      version: analysis.version,
      generatedAt: analysis.generatedAt,
      types: analysis.types,
      workMode: analysis.workMode,
      confidence: analysis.confidence,
      ambiguities: analysis.ambiguities,
      deliverables: analysis.deliverables,
      constraints: analysis.constraints,
      rubric: analysis.rubric
    }
  };

  localStorage.setItem(PROJECT_KEY, JSON.stringify(nextState));
  showToast('Universal plan saved to DA.OS. NEXT is ready.');
  setTimeout(() => { window.location.href = 'index.html#next'; }, 550);
}

function loadProject() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null');
    return raw || { project: { name:'', deadline:'', tools:[], brief:'', files:[] }, requirements:[], tasks:[] };
  } catch {
    return { project: { name:'', deadline:'', tools:[], brief:'', files:[] }, requirements:[], tasks:[] };
  }
}

async function handleAssignmentFile(file) {
  if (!file) return;
  loadedFileMeta = { name: file.name, size: file.size, type: file.type || '', lastModified: file.lastModified || null };
  els.fileStatus.className = 'file-summary';
  els.fileStatus.textContent = `${file.name} · ${formatBytes(file.size)} · extracting text…`;

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    let text = '';
    if (['txt','md','sql','py','csv'].includes(ext)) {
      text = await file.text();
    } else if (ext === 'json' || ext === 'ipynb') {
      const raw = await file.text();
      if (ext === 'ipynb') {
        const notebook = JSON.parse(raw);
        text = (notebook.cells || []).map(cell => Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '')).join('\n\n');
      } else {
        text = raw;
      }
    } else if (ext === 'docx') {
      if (typeof mammoth === 'undefined') throw new Error('DOCX parser did not load. Paste the brief manually or try again online.');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      text = result.value;
    } else if (ext === 'pdf') {
      if (typeof pdfjsLib === 'undefined') throw new Error('PDF parser did not load. Paste the brief manually or try again online.');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
      }
      text = pages.join('\n\n');
    } else {
      throw new Error('This file type is not supported by the local adapter yet. Paste the assignment text manually.');
    }

    const extracted = normalizeText(text);
    if (!extracted) throw new Error('No usable text could be extracted from this file.');
    els.assignmentBrief.value = extracted;
    if (!els.assignmentName.value.trim()) els.assignmentName.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    els.fileStatus.textContent = `${file.name} · ${formatBytes(file.size)} · ${extracted.length.toLocaleString()} characters extracted locally`;
    showToast('Assignment text extracted. Review it, then analyse.');
  } catch (error) {
    els.fileStatus.textContent = `${file.name}: ${error.message}`;
    showToast(error.message);
  }
}

function loadSample() {
  els.assignmentName.value = SAMPLE.name;
  els.assignmentBrief.value = SAMPLE.brief;
  els.rubricText.value = SAMPLE.rubric;
  loadedFileMeta = null;
  els.fileStatus.className = 'file-summary empty-state';
  els.fileStatus.textContent = 'Sample loaded from DA.OS; no source file.';
  analyseAssignment();
}

function resetAdapter() {
  analysis = null;
  loadedFileMeta = null;
  els.assignmentName.value = '';
  els.assignmentBrief.value = '';
  els.rubricText.value = '';
  els.assignmentFile.value = '';
  els.fileStatus.className = 'file-summary empty-state';
  els.fileStatus.textContent = 'No assignment file loaded.';
  els.confidenceBadge.className = 'adapter-badge neutral';
  els.confidenceBadge.textContent = 'Not analysed';
  ['typeChips','toolChips'].forEach(id => { els[id].className = 'chip-cloud empty-state'; els[id].textContent = '—'; });
  els.workMode.textContent = '—';
  els.firstDecision.textContent = 'Analyse an assignment to see the first thing that must be clarified.';
  els.ambiguityBox.classList.add('hidden');
  els.deliverableCount.textContent = '0';
  els.constraintCount.textContent = '0';
  els.rubricCount.textContent = '0';
  els.taskCount.textContent = '0';
  els.deliverableList.className = 'adapter-list empty-state'; els.deliverableList.textContent = 'No assignment analysed yet.';
  els.constraintList.className = 'adapter-list empty-state'; els.constraintList.textContent = 'No constraints detected yet.';
  els.rubricList.className = 'rubric-list empty-state'; els.rubricList.textContent = 'Paste a rubric or include grading language in the brief.';
  els.taskGraph.className = 'task-graph empty-state'; els.taskGraph.textContent = 'No task graph yet.';
  els.evidenceList.className = 'adapter-list empty-state'; els.evidenceList.textContent = 'No evidence plan yet.';
  els.validationList.className = 'adapter-list empty-state'; els.validationList.textContent = 'No validation plan yet.';
  els.usePlanBtn.disabled = true;
  els.usePlanBottomBtn.disabled = true;
  showToast('Assignment Adapter reset.');
}

function uniqueText(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const clean = normalizeText(item);
    const key = clean.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
    if (clean && !seen.has(key)) { seen.add(key); out.push(clean); }
  }
  return out;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B','KB','MB','GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2300);
}

els.analyseBtn.addEventListener('click', analyseAssignment);
els.usePlanBtn.addEventListener('click', usePlan);
els.usePlanBottomBtn.addEventListener('click', usePlan);
els.sampleBtn.addEventListener('click', loadSample);
els.resetBtn.addEventListener('click', resetAdapter);
els.assignmentFile.addEventListener('change', event => handleAssignmentFile(event.target.files[0]));
['dragenter','dragover'].forEach(name => els.assignmentDropzone.addEventListener(name, event => {
  event.preventDefault();
  els.assignmentDropzone.classList.add('dragging');
}));
['dragleave','drop'].forEach(name => els.assignmentDropzone.addEventListener(name, event => {
  event.preventDefault();
  els.assignmentDropzone.classList.remove('dragging');
}));
els.assignmentDropzone.addEventListener('drop', event => handleAssignmentFile(event.dataTransfer.files[0]));
