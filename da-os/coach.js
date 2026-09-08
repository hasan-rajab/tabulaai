const PROJECT_STORAGE_KEY = 'daos-v0.1-state';
const COACH_STORAGE_KEY = 'daos-v0.2-coach';

const EMPTY_PROJECT = {
  project: { name: '', deadline: '', tools: [], brief: '', files: [] },
  requirements: [],
  tasks: []
};

const EMPTY_COACH = {
  byTask: {}
};

const $ = (id) => document.getElementById(id);
const els = {
  projectName: $('projectName'),
  projectContext: $('projectContext'),
  currentTask: $('currentTask'),
  currentCategory: $('currentCategory'),
  coachTools: $('coachTools'),
  toolNote: $('toolNote'),
  lessonTitle: $('lessonTitle'),
  lessonLevel: $('lessonLevel'),
  lessonQuestion: $('lessonQuestion'),
  lessonConcept: $('lessonConcept'),
  hintArea: $('hintArea'),
  hintBtn: $('hintBtn'),
  resetHintsBtn: $('resetHintsBtn'),
  scratchpad: $('scratchpad'),
  scratchStatus: $('scratchStatus'),
  checklist: $('checklist'),
  checkScore: $('checkScore'),
  needsReviewBtn: $('needsReviewBtn'),
  understoodBtn: $('understoodBtn'),
  understandingMessage: $('understandingMessage'),
  understoodCount: $('understoodCount'),
  reviewCount: $('reviewCount'),
  toast: $('toast')
};

const TOOL_NOTES = {
  Excel: 'Excel lens: think helper columns → PivotTable / formulas → manual spot-check.',
  SQL: 'SQL lens: define grain → SELECT/FROM/WHERE/GROUP BY → validate counts and totals.',
  Python: 'Python lens: inspect → transform one thing → print/check → aggregate → validate.',
  'Power BI': 'Power BI lens: prepare types → define a measure → choose a visual → test filter context.',
  Tableau: 'Tableau lens: separate dimensions/measures → calculated field → view → verify aggregation.'
};

const TOOL_PATTERNS = {
  Excel: {
    structure: 'Write the transformation as a helper column if needed, then summarize with a PivotTable or a small set of formulas.',
    validation: 'Filter a small sample manually and recalculate one result with COUNT / SUM / AVERAGE so you know the PivotTable is behaving as expected.',
    example: ({ dimension }) => `Worked pattern — not a dataset-specific answer:\n1. Create a clean ${dimension} field if needed.\n2. Create a 1/0 outcome field for success.\n3. Put ${dimension} in PivotTable Rows.\n4. Put the success flag in Values and summarize by Average.\n5. Format the average as a percentage.\n6. Add campaign count beside it so tiny groups do not mislead you.`
  },
  SQL: {
    structure: 'State the output grain first. Then build SELECT, FROM, WHERE and GROUP BY. Add joins only when the question truly needs another table.',
    validation: 'Compare COUNT(*) with COUNT(DISTINCT primary_key), inspect a few rows, and reconcile the total before and after any join.',
    example: ({ dimension }) => `Worked pattern — adapt names to your schema:\nSELECT\n  ${dimension},\n  COUNT(*) AS n,\n  AVG(CASE WHEN state = 'successful' THEN 1.0 ELSE 0 END) AS success_rate\nFROM campaigns\nGROUP BY ${dimension}\nORDER BY success_rate DESC;\n\nBefore trusting it, verify the table grain and whether every row really represents one campaign.`
  },
  Python: {
    structure: 'Inspect columns and dtypes first. Make one transformation at a time, print the result, then group or aggregate only after the intermediate field looks right.',
    validation: 'Check shape, missing values, unique values and one hand-calculated group before accepting the full output.',
    example: ({ dimension }) => `Worked pattern — adapt names to your dataframe:\ndf['is_success'] = (df['state'] == 'successful').astype(int)\nsummary = (\n    df.groupby('${dimension}', dropna=False)\n      .agg(n=('is_success', 'size'),\n           success_rate=('is_success', 'mean'))\n      .sort_values('success_rate', ascending=False)\n)\nprint(summary.head())\n\nThen manually inspect one ${dimension} group to validate the result.`
  },
  'Power BI': {
    structure: 'Keep row-level preparation in Power Query when practical, then define a measure for the metric rather than hard-coding values into the visual.',
    validation: 'Create a temporary table visual showing the dimension, numerator, denominator and final measure. Compare one group against the source.',
    example: ({ dimension }) => `Worked pattern — adapt to your model:\nSuccess Rate =\nDIVIDE(\n    CALCULATE(COUNTROWS(Campaigns), Campaigns[state] = "successful"),\n    COUNTROWS(Campaigns)\n)\n\nPlace ${dimension} on the axis and Success Rate as the value. Add campaign count to a tooltip or supporting table so you can judge sample size.`
  },
  Tableau: {
    structure: 'Decide which field is the dimension and which is the measure. Use a calculated 1/0 success field when you need an average success rate.',
    validation: 'Show the underlying data for one mark and compare the numerator/denominator with a manual count.',
    example: ({ dimension }) => `Worked pattern — adapt field names:\nCalculated field: Success Flag\nIF [state] = "successful" THEN 1 ELSE 0 END\n\nPut ${dimension} on Rows, AVG([Success Flag]) on Columns, and campaign count in the tooltip. Sort by the metric, not alphabetically.`
  }
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

let projectState = loadJson(PROJECT_STORAGE_KEY, EMPTY_PROJECT);
let coachState = loadJson(COACH_STORAGE_KEY, EMPTY_COACH);
let activeTask = getActiveTask();
let activeTool = chooseDefaultTool();

function getActiveTask() {
  if (!projectState.tasks?.length) return null;
  return projectState.tasks.find(task => !task.done) || projectState.tasks[projectState.tasks.length - 1];
}

function chooseDefaultTool() {
  if (activeTask?.category === 'SQL') return 'SQL';
  if (activeTask?.category === 'Python') return 'Python';
  if (activeTask?.category === 'Visualisation' && projectState.project?.tools?.includes('Power BI')) return 'Power BI';
  if (activeTask?.category === 'Visualisation' && projectState.project?.tools?.includes('Tableau')) return 'Tableau';
  return projectState.project?.tools?.[0] || 'Excel';
}

function taskKey() {
  return activeTask?.id || 'no-task';
}

function getRecord() {
  const key = taskKey();
  if (!coachState.byTask[key]) {
    coachState.byTask[key] = {
      tool: activeTool,
      hintLevel: 0,
      scratch: '',
      status: 'new',
      checks: [false, false, false, false]
    };
  }
  return coachState.byTask[key];
}

function saveCoach(message = 'Saved locally') {
  localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(coachState));
  els.scratchStatus.textContent = message;
  clearTimeout(saveCoach.timer);
  saveCoach.timer = setTimeout(() => { els.scratchStatus.textContent = 'Saved locally'; }, 900);
}

function inferDimension(task) {
  const text = `${task?.title || ''} ${task?.action || ''}`.toLowerCase();
  if (/goal|pledge/.test(text)) return 'goal_band';
  if (/duration|length/.test(text)) return 'duration_band';
  if (/category|project type/.test(text)) return 'category';
  if (/month|weekday|day|launch timing/.test(text)) return 'launch_month';
  if (/country|geograph/.test(text)) return 'country';
  return 'analysis_group';
}

function buildLesson(task, tool) {
  if (!task) {
    return {
      title: 'Load a project first',
      question: 'What assignment are you trying to complete?',
      concept: 'The Learning Coach uses your current NEXT task as the learning target. Create a project or load the Kickstarter sample in the workspace first.',
      hints: [
        'Go back to Workspace and paste the assignment brief.',
        'Run the Assignment Deconstructor so DA.OS can identify the next task.',
        'Then return here and the coach will attach the lesson to that task.',
        'No worked example is available until a project task exists.'
      ],
      checks: ['I have a project brief.', 'I have generated a task plan.', 'I know the current NEXT task.', 'I chose the tool I am using.']
    };
  }

  const text = `${task.title} ${task.why} ${task.action}`.toLowerCase();
  const dimension = inferDimension(task);
  const toolPattern = TOOL_PATTERNS[tool] || TOOL_PATTERNS.Excel;

  let title = `Understand: ${task.title}`;
  let question = `Before using ${tool}, explain in plain English what result this task needs to produce.`;
  let concept = 'Separate the business question from the tool. First define the metric, population, grouping and comparison; only then choose formulas, code or visuals.';
  let firstHint = `Restate the task as: “For each ${dimension}, I need to calculate a comparable metric and identify meaningful differences.”`;

  if (/inspect the dataset|clean/.test(text)) {
    question = 'Which columns actually matter for this assignment, and what could make them unsafe to analyse?';
    concept = 'Data inspection is targeted risk reduction. You are not cleaning everything; you are checking the fields that determine the answer for type errors, missingness, duplicates, impossible values and inconsistent labels.';
    firstHint = 'Start with the assignment questions. List the outcome field, dimensions, dates and numeric fields those questions depend on.';
  } else if (/define the success metric|outcome field/.test(text)) {
    question = 'What exactly counts as success, and what is the denominator of the rate you will report?';
    concept = 'A rate only makes sense when the event and eligible population are explicit. A 1/0 indicator is useful because its average equals the proportion of rows coded 1 when each row represents one eligible observation.';
    firstHint = 'Write the metric in words before writing a formula: successful eligible campaigns ÷ all eligible campaigns.';
  } else if (/duration/.test(text)) {
    question = 'Why might comparing every exact duration value be misleading, and how would you choose useful duration groups?';
    concept = 'Binning can turn a noisy continuous variable into interpretable groups, but the bands must be large enough to have useful sample sizes and should not be chosen only because they make the result look good.';
    firstHint = 'Inspect the distribution first. Look for natural ranges and make sure each proposed duration band contains enough campaigns.';
  } else if (/pledge goal|goal versus success|goal band/.test(text)) {
    question = 'Why should pledge goals usually be grouped before comparing success rates?';
    concept = 'Raw monetary values often have many unique values and extreme outliers. Goal bands create comparable groups, but every recommendation should be considered alongside the number of campaigns in each band.';
    firstHint = 'Inspect the minimum, median, upper percentiles and maximum. Then propose interpretable bands before calculating success rates.';
  } else if (/category/.test(text)) {
    question = 'What would make a category look “best” even when the evidence is weak?';
    concept = 'Ranking categories by success rate alone can overvalue tiny groups. Compare both rate and sample size, and be careful about broad categories hiding subcategory differences.';
    firstHint = 'For every category, calculate at least two numbers: campaign count and success rate.';
  } else if (/launch timing|month|weekday|hour/.test(text)) {
    question = 'Before comparing launch timing, what must be true about the date/time field?';
    concept = 'Temporal analysis depends on correctly parsed timestamps and clear timezone assumptions. Month, weekday and hour are derived features; each can create patterns that are confounded by seasonality, campaign category or geography.';
    firstHint = 'Confirm the timestamp datatype and timezone first. Derive one timing feature at a time and inspect the resulting values.';
  } else if (/recommendation|turn findings/.test(text)) {
    question = 'What is the difference between a finding and a recommendation?';
    concept = 'A finding describes what the data shows. A recommendation says what someone should do because of that evidence, while acknowledging uncertainty or limitations.';
    firstHint = 'Use the structure: Because we observed X, recommend Y, subject to limitation Z.';
  } else if (/presentation|visual evidence|chart/.test(text)) {
    question = 'What single comparison should the audience understand from this visual within a few seconds?';
    concept = 'A chart is an argument supported by data. Choose the visual based on the comparison—category, trend, distribution, relationship—not because the chart looks impressive.';
    firstHint = 'Write the takeaway sentence first. Then choose the simplest chart that makes that sentence visually obvious.';
  } else if (/validate|submission check|qa/.test(text)) {
    question = 'What independent check would convince you that your headline number is not just internally consistent but actually correct?';
    concept = 'Validation means attempting to falsify your result. Recalculate a small sample, reconcile totals, verify filters and compare the final claim against the original assignment requirement.';
    firstHint = 'Pick the most important number in the deliverable and trace it backwards to the raw rows or source calculation.';
  } else if (/sql/.test(text)) {
    question = 'What should one row of your SQL result represent?';
    concept = 'SQL correctness starts with grain. If you know what one output row represents, the required grouping, joins and aggregations become much easier to reason about.';
    firstHint = 'Write: “One output row represents ______.” Do that before writing SELECT.';
  } else if (/python/.test(text)) {
    question = 'How can you make this Python analysis easy to debug if something goes wrong?';
    concept = 'Build transformations incrementally and inspect intermediate outputs. Long method chains are concise, but during learning you should be able to explain what changed after each line.';
    firstHint = 'Do one transformation, inspect head/shape/dtypes, then continue. Do not stack five transformations before checking the first one.';
  }

  return {
    title,
    question,
    concept,
    hints: [
      firstHint,
      toolPattern.structure,
      `${toolPattern.validation} Also ask: does this output directly answer the original requirement?`,
      toolPattern.example({ dimension })
    ],
    checks: [
      'I can state the business question in one sentence without naming the software.',
      'I can name the metric, grouping/dimension, and what one row represents at the relevant step.',
      `I can explain the ${tool} steps I will use and why each is necessary.`,
      'I know at least one independent validation check I will run before trusting the result.'
    ]
  };
}

function renderProject() {
  const project = projectState.project || EMPTY_PROJECT.project;
  els.projectName.textContent = project.name || 'No project loaded';
  if (project.brief) {
    const tools = project.tools?.length ? project.tools.join(' · ') : 'Tools not selected';
    els.projectContext.textContent = `${tools}${project.deadline ? ` · Deadline ${project.deadline}` : ''}`;
  } else {
    els.projectContext.textContent = 'Create or load a project in DA.OS first.';
  }

  els.currentTask.textContent = activeTask?.title || 'No task available';
  els.currentCategory.textContent = activeTask?.category || '—';
}

function renderTools() {
  els.coachTools.querySelectorAll('[data-tool]').forEach(button => {
    button.classList.toggle('active', button.dataset.tool === activeTool);
  });
  els.toolNote.textContent = TOOL_NOTES[activeTool] || '';
}

function renderLesson() {
  const record = getRecord();
  const lesson = buildLesson(activeTask, activeTool);
  els.lessonTitle.textContent = lesson.title;
  els.lessonQuestion.textContent = lesson.question;
  els.lessonConcept.textContent = lesson.concept;
  els.lessonLevel.textContent = `${Math.min(record.hintLevel + 1, 4)}/4`;

  els.hintArea.innerHTML = lesson.hints
    .slice(0, record.hintLevel)
    .map((hint, index) => `
      <div class="hint-card ${index === 3 ? 'example' : ''}">
        <strong>${index === 3 ? 'Worked pattern' : `Hint ${index + 1}`}</strong>
        <p>${escapeHtml(hint)}</p>
      </div>
    `).join('');

  if (record.hintLevel >= 4) {
    els.hintBtn.disabled = true;
    els.hintBtn.textContent = 'All hints revealed';
  } else {
    els.hintBtn.disabled = false;
    els.hintBtn.textContent = record.hintLevel === 0 ? 'Reveal first hint' : record.hintLevel === 3 ? 'Reveal worked pattern' : 'Reveal next hint';
  }
}

function renderScratchpad() {
  els.scratchpad.value = getRecord().scratch || '';
}

function renderChecklist() {
  const record = getRecord();
  const lesson = buildLesson(activeTask, activeTool);
  if (!Array.isArray(record.checks) || record.checks.length !== 4) record.checks = [false, false, false, false];

  els.checklist.innerHTML = lesson.checks.map((item, index) => `
    <label class="learning-check">
      <input type="checkbox" data-check-index="${index}" ${record.checks[index] ? 'checked' : ''} />
      <span>${escapeHtml(item)}</span>
    </label>
  `).join('');

  els.checklist.querySelectorAll('[data-check-index]').forEach(input => {
    input.addEventListener('change', () => {
      record.checks[Number(input.dataset.checkIndex)] = input.checked;
      saveCoach();
      renderCheckScore();
    });
  });
  renderCheckScore();
}

function renderCheckScore() {
  const record = getRecord();
  const score = record.checks.filter(Boolean).length;
  els.checkScore.textContent = `${score}/4`;
}

function renderStatus() {
  const record = getRecord();
  if (record.status === 'understood') {
    els.understandingMessage.textContent = 'Marked understood. DA.OS will keep this learning record for this task.';
  } else if (record.status === 'review') {
    els.understandingMessage.textContent = 'Marked for review. Revisit this task before submission or when the concept appears again.';
  } else {
    els.understandingMessage.textContent = '';
  }

  const records = Object.values(coachState.byTask);
  els.understoodCount.textContent = records.filter(r => r.status === 'understood').length;
  els.reviewCount.textContent = records.filter(r => r.status === 'review').length;
}

function renderAll() {
  renderProject();
  const record = getRecord();
  activeTool = record.tool || activeTool;
  renderTools();
  renderLesson();
  renderScratchpad();
  renderChecklist();
  renderStatus();
}

function setTool(tool) {
  activeTool = tool;
  const record = getRecord();
  record.tool = tool;
  record.hintLevel = 0;
  record.checks = [false, false, false, false];
  saveCoach('Tool changed');
  renderTools();
  renderLesson();
  renderChecklist();
  showToast(`Coach switched to ${tool}.`);
}

function revealHint() {
  const record = getRecord();
  if (record.hintLevel >= 4) return;
  record.hintLevel += 1;
  saveCoach('Hint progress saved');
  renderLesson();
}

function resetHints() {
  const record = getRecord();
  record.hintLevel = 0;
  saveCoach('Hints reset');
  renderLesson();
}

function updateScratch(value) {
  const record = getRecord();
  record.scratch = value;
  saveCoach('Saving…');
}

function insertPrompt(prompt) {
  const existing = els.scratchpad.value.trim();
  els.scratchpad.value = `${existing}${existing ? '\n\n' : ''}${prompt}\n`;
  els.scratchpad.focus();
  updateScratch(els.scratchpad.value);
}

function markReview() {
  const record = getRecord();
  record.status = 'review';
  saveCoach('Marked for review');
  renderStatus();
  showToast('Added to your review list.');
}

function markUnderstood() {
  const record = getRecord();
  const score = record.checks.filter(Boolean).length;
  if (score < 4) {
    els.understandingMessage.textContent = `Complete the self-check first (${score}/4). The goal is to know why the step works, not just finish it.`;
    return;
  }
  record.status = 'understood';
  saveCoach('Marked understood');
  renderStatus();
  showToast('Learning step marked understood.');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

els.coachTools.querySelectorAll('[data-tool]').forEach(button => {
  button.addEventListener('click', () => setTool(button.dataset.tool));
});

els.hintBtn.addEventListener('click', revealHint);
els.resetHintsBtn.addEventListener('click', resetHints);
els.scratchpad.addEventListener('input', () => updateScratch(els.scratchpad.value));
els.needsReviewBtn.addEventListener('click', markReview);
els.understoodBtn.addEventListener('click', markUnderstood);

document.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => insertPrompt(button.dataset.prompt));
});

renderAll();
