const PROJECT_KEY = 'daos-v0.1-state';
const DOCTOR_KEY = 'daos-v0.3-doctor';

const DEFAULT_DOCTOR_STATE = {
  tool: 'Excel',
  active: null,
  notes: '',
  reflection: '',
  history: []
};

const $ = (id) => document.getElementById(id);
const els = {
  projectName: $('projectName'),
  projectContext: $('projectContext'),
  doctorTools: $('doctorTools'),
  errorText: $('errorText'),
  codeText: $('codeText'),
  diagnoseBtn: $('diagnoseBtn'),
  newDiagnosisBtn: $('newDiagnosisBtn'),
  diagnosisTitle: $('diagnosisTitle'),
  diagnosisConfidence: $('diagnosisConfidence'),
  diagnosisEmpty: $('diagnosisEmpty'),
  diagnosisContent: $('diagnosisContent'),
  errorClass: $('errorClass'),
  likelyCause: $('likelyCause'),
  conceptToLearn: $('conceptToLearn'),
  stepProgress: $('stepProgress'),
  diagnosticSteps: $('diagnosticSteps'),
  nextTestBtn: $('nextTestBtn'),
  restartBtn: $('restartBtn'),
  debugNotes: $('debugNotes'),
  notesStatus: $('notesStatus'),
  unlockBadge: $('unlockBadge'),
  resolutionLocked: $('resolutionLocked'),
  resolutionContent: $('resolutionContent'),
  fixPattern: $('fixPattern'),
  verification: $('verification'),
  prevention: $('prevention'),
  revealFixBtn: $('revealFixBtn'),
  learningReflection: $('learningReflection'),
  needsReviewBtn: $('needsReviewBtn'),
  solvedBtn: $('solvedBtn'),
  resolutionMessage: $('resolutionMessage'),
  solvedCount: $('solvedCount'),
  reviewCount: $('reviewCount'),
  historyList: $('historyList'),
  toast: $('toast')
};

const LIBRARY = {
  Excel: [
    {
      id: 'excel-value',
      match: /#VALUE!|value error|wrong type|text.*number|number.*text/i,
      title: 'Excel value/type mismatch',
      confidence: 'High match',
      errorClass: '#VALUE! / incompatible value type',
      cause: 'A formula is receiving a value in a form it cannot use—for example text where arithmetic expects a number, an invalid range shape, or hidden characters in imported data.',
      concept: 'Excel formulas operate on value types. Debug the inputs before changing the formula: inspect the exact cells, their types, and any coercion or cleaning that happens before the calculation.',
      steps: [
        { question: 'Which exact argument in the formula first produces an unexpected value?', action: 'Evaluate the formula in smaller pieces or use Formulas → Evaluate Formula. Test each referenced cell/range separately.' },
        { question: 'Are the inputs truly numeric/date values, or numbers/dates stored as text?', action: 'Check alignment, ISNUMBER/ISTEXT, and inspect for spaces or imported characters. Try =LEN(cell) and =TRIM(cell) on a suspect value.' },
        { question: 'Does the formula expect one value but receive a multi-cell range or incompatible array shape?', action: 'Compare the dimensions of every range used by the formula and reduce the formula to the smallest failing expression.' }
      ],
      fix: "Fix the bad input, not just the symptom. Typical patterns:\n\n=VALUE(TRIM(A2))          // text number → numeric\n=IFERROR(calculation, …)  // only after understanding expected failure\n\nThen restore the original formula using cleaned/compatible inputs.",
      verify: 'Recalculate the formula on several normal rows and at least one edge case. Confirm the numeric result against a manual calculation rather than only checking that the error disappeared.',
      prevent: 'Profile imported columns before analysis, standardize data types early, and avoid wrapping unknown errors in IFERROR until you know why they occur.'
    },
    {
      id: 'excel-na',
      match: /#N\/A|not available|lookup.*not found|xlookup|vlookup/i,
      title: 'Excel lookup mismatch',
      confidence: 'High match',
      errorClass: '#N/A / lookup key not found',
      cause: 'The lookup key does not match a value in the lookup range. Common causes are spelling differences, extra spaces, text-vs-number mismatches, or looking in the wrong range.',
      concept: 'A lookup is a key-matching operation. Before changing XLOOKUP/VLOOKUP, prove that the key exists in the lookup domain in the same representation.',
      steps: [
        { question: 'Does the exact lookup value exist in the lookup column?', action: 'Use =COUNTIF(lookup_column, lookup_value). A result of 0 means the key does not match exactly.' },
        { question: 'Could the values differ by spaces, case-independent text noise, or numeric/text type?', action: 'Compare =LEN() values, TRIM/CLEAN suspect text, and check ISNUMBER/ISTEXT on both lookup key and lookup column.' },
        { question: 'Is the lookup range pointing at the intended key and return columns?', action: 'Select the ranges in the formula and visually confirm the key column, return column, and absolute/relative references.' }
      ],
      fix: "Normalize the key before lookup and verify the range. Example:\n\n=XLOOKUP(TRIM(A2), cleaned_key_range, return_range, \"Not found\")\n\nIf IDs are numeric on one side and text on the other, convert them consistently before lookup.",
      verify: 'Test one known matching key, one known missing key, and one value that previously failed. Confirm the returned record is the correct entity, not merely a non-error result.',
      prevent: 'Standardize identifiers at import, preserve IDs consistently as text or numeric values, and test key uniqueness before relying on lookups.'
    },
    {
      id: 'excel-ref',
      match: /#REF!|reference.*invalid|deleted.*cell|deleted.*column/i,
      title: 'Excel broken reference',
      confidence: 'High match',
      errorClass: '#REF! / invalid cell or range reference',
      cause: 'A formula refers to a cell, row, column, sheet, or workbook location that no longer exists or moved in a way Excel could not preserve.',
      concept: 'Spreadsheet formulas have structural dependencies. A broken reference is a lineage problem: identify what the formula was supposed to depend on before repairing it.',
      steps: [
        { question: 'Which part of the formula contains #REF! and what did it originally refer to?', action: 'Use Find for #REF! and inspect nearby formulas or an earlier version of the workbook to infer the missing dependency.' },
        { question: 'Was a row, column, sheet, or external workbook recently deleted or renamed?', action: 'Check recent structural changes and workbook links. Compare with adjacent formulas that still work.' },
        { question: 'Should the repaired reference be absolute, relative, or structured?', action: 'Determine whether copying/filling the formula should move the reference. Prefer table structured references where practical.' }
      ],
      fix: "Replace #REF! with the intended source reference only after confirming the missing dependency. If this is tabular data, consider a structured reference such as:\n\n=SUM(Table1[Revenue])",
      verify: 'Compare the repaired formula with neighboring rows/columns and independently recompute the expected result from the source cells.',
      prevent: 'Use Excel Tables and structured references, avoid fragile hard-coded ranges, and version important workbooks before major structural edits.'
    },
    {
      id: 'excel-div0',
      match: /#DIV\/0!|divide.*zero|division.*zero/i,
      title: 'Excel zero denominator',
      confidence: 'High match',
      errorClass: '#DIV/0! / denominator is zero or blank',
      cause: 'The denominator evaluates to zero or blank. The real analytical question is whether zero means an invalid record, a legitimate undefined rate, or a condition that should be filtered.',
      concept: 'Ratios require meaningful denominators. Do not hide divide-by-zero errors until you decide what a zero denominator means for the business metric.',
      steps: [
        { question: 'Which denominator is zero, and why?', action: 'Evaluate the denominator alone and filter the source rows where it is 0 or blank.' },
        { question: 'Should those rows be excluded, shown as blank/NA, or treated as 0?', action: 'Use the metric definition or assignment context to decide the correct business behavior.' },
        { question: 'Is the denominator zero because of an upstream filter or missing-data problem?', action: 'Trace the denominator back to its source count/sum and check filters, blanks, and data types.' }
      ],
      fix: "Handle the zero case explicitly once its meaning is known. Example:\n\n=IF(B2=0, NA(), A2/B2)\n\nor return blank instead of NA if that matches the reporting rule.",
      verify: 'Check normal rows, zero-denominator rows, and totals. Make sure the treatment does not silently turn undefined rates into genuine zero performance.',
      prevent: 'Define denominator rules when you define the metric, and include zero/blank cases in your QA checklist.'
    },
    {
      id: 'excel-generic',
      match: /.*/,
      title: 'Excel formula/result diagnosis',
      confidence: 'Pattern-based',
      errorClass: 'Excel formula, data type, reference, or aggregation issue',
      cause: 'The symptom is not specific enough for a single diagnosis. Excel issues are easiest to solve by reducing the formula and checking inputs, references, filters, and expected output one layer at a time.',
      concept: 'Debug spreadsheets by isolating the smallest failing calculation. A visible final error often originates earlier in the data or formula chain.',
      steps: [
        { question: 'What exact value did you expect, and what exact value/error did Excel return?', action: 'Write both values down. Avoid “wrong” as the expected result—state a number, text, or behavior.' },
        { question: 'What is the smallest part of the formula that still produces the problem?', action: 'Evaluate the formula piece by piece and temporarily move subexpressions into helper cells.' },
        { question: 'Are filters, hidden rows, data types, or copied references changing the inputs?', action: 'Inspect source rows and compare one working case with one failing case.' }
      ],
      fix: 'Repair the smallest confirmed cause first—bad input, wrong reference, wrong aggregation, or wrong formula condition—then rebuild the larger formula from the verified pieces.',
      verify: 'Manually calculate one known row and compare it with Excel. Then test at least one edge case and confirm totals after the repair.',
      prevent: 'Use helper columns while learning, keep formulas readable, profile input types, and build a small QA section with counts/totals for important assignments.'
    }
  ],
  SQL: [
    {
      id: 'sql-fanout',
      match: /wrong total|too high|double count|duplicate|fan.?out|inflated|more rows|sum.*wrong/i,
      title: 'SQL join fan-out / duplicated grain',
      confidence: 'Strong symptom match',
      errorClass: 'Aggregation after a one-to-many or many-to-many join',
      cause: 'A join may be multiplying rows before you aggregate. For example, one order joined to multiple order_items repeats order-level revenue once per item.',
      concept: 'Every table/query has a grain. Before joining and summing, know what one row represents on both sides and whether the join preserves that grain.',
      steps: [
        { question: 'What does one row represent before and after the join?', action: 'Write the grain explicitly: e.g. orders = one row/order; order_items = one row/item. Then compare COUNT(*) before vs after the join.' },
        { question: 'Is your supposed join key unique on either side?', action: 'Run GROUP BY join_key HAVING COUNT(*) > 1 on both tables. This reveals one-to-many or many-to-many cardinality.' },
        { question: 'Does COUNT(DISTINCT business_key) stay stable while COUNT(*) increases?', action: 'Compare COUNT(*), COUNT(DISTINCT order_id), and SUM(metric) before and after the join.' }
      ],
      fix: "Aggregate the many-side to the required grain before joining, or calculate the metric from the table where it naturally lives. Pattern:\n\nWITH item_totals AS (\n  SELECT order_id, SUM(item_amount) AS item_total\n  FROM order_items\n  GROUP BY order_id\n)\nSELECT ...\nFROM orders o\nLEFT JOIN item_totals i USING (order_id);",
      verify: 'Reconcile row counts and a known total before/after the join. Manually inspect several business keys with multiple child rows.',
      prevent: 'Annotate grain in CTE names/comments, test join-key uniqueness, and reconcile counts/totals after every important join.'
    },
    {
      id: 'sql-column',
      match: /column .* does not exist|unknown column|invalid column|ambiguous column|no such column/i,
      title: 'SQL column reference problem',
      confidence: 'High match',
      errorClass: 'Missing, misspelled, out-of-scope, or ambiguous column',
      cause: 'The query references a column name that the current scope cannot resolve, or multiple joined tables contain the same unqualified column name.',
      concept: 'SQL columns exist within table/CTE scopes. After joins, qualify shared names with aliases and verify the schema instead of guessing column names.',
      steps: [
        { question: 'Does the named column exist exactly as written in the source table or CTE?', action: 'Inspect the schema or run a small SELECT * / DESCRIBE query on the relevant table/CTE.' },
        { question: 'Is the column created in a SELECT alias and then referenced somewhere that alias is not yet in scope?', action: 'Check the SQL execution/scope order and move repeated logic into a CTE if necessary.' },
        { question: 'Do multiple joined tables contain the same column name?', action: 'Qualify the reference with the correct alias, e.g. customers.id versus orders.id.' }
      ],
      fix: "Use the exact source column and qualify ambiguous names. Pattern:\n\nSELECT o.order_id, c.customer_id\nFROM orders AS o\nJOIN customers AS c\n  ON o.customer_id = c.customer_id;",
      verify: 'Run the smallest SELECT containing the corrected column first, then restore joins/aggregations and verify the field comes from the intended table.',
      prevent: 'Use short table aliases consistently, avoid SELECT * in final analytical queries, and inspect schemas before writing long queries.'
    },
    {
      id: 'sql-groupby',
      match: /group by|must appear in the GROUP BY|not.*aggregate|invalid.*group|aggregate function/i,
      title: 'SQL aggregation/grain mismatch',
      confidence: 'High match',
      errorClass: 'Selected column does not match aggregation grain',
      cause: 'The SELECT list mixes aggregated values with non-aggregated columns that are not part of the grouping grain.',
      concept: 'GROUP BY defines the output grain. Every selected field must either define that grain or be aggregated to it.',
      steps: [
        { question: 'What should one output row represent?', action: 'State the intended grain in plain English, e.g. one row per category per month.' },
        { question: 'Which selected columns define that grain?', action: 'Put those dimensions in GROUP BY. Everything else should be aggregated or removed.' },
        { question: 'Are you grouping by an unnecessary detail that fragments the result?', action: 'Compare the requested business question with each GROUP BY field and remove dimensions that are not needed.' }
      ],
      fix: "Align SELECT and GROUP BY with the desired grain. Pattern:\n\nSELECT category, AVG(pledged) AS avg_pledged\nFROM campaigns\nWHERE state = 'successful'\nGROUP BY category;",
      verify: 'Check row count against the expected number of groups and manually verify one group with a filtered source query.',
      prevent: 'Write “one row per ___” before every aggregation query and use that sentence to design GROUP BY.'
    },
    {
      id: 'sql-syntax',
      match: /syntax error|parse error|unexpected|near .* syntax|incorrect syntax/i,
      title: 'SQL syntax/parser error',
      confidence: 'High match',
      errorClass: 'SQL statement cannot be parsed',
      cause: 'A keyword, comma, parenthesis, quote, alias, or clause order prevents the SQL engine from parsing the statement.',
      concept: 'Parser errors are structural. Start at the location the database reports, but also inspect the token immediately before it because that is often the real source.',
      steps: [
        { question: 'What exact token/line does the database point to?', action: 'Locate that token and inspect the preceding comma, parenthesis, quote, alias, and clause.' },
        { question: 'Can the query run if you remove the newest clause or CTE?', action: 'Reduce the query to the last known working form, then add one clause back at a time.' },
        { question: 'Is the syntax valid for your specific SQL dialect?', action: 'Check whether functions, date syntax, QUALIFY/LIMIT/TOP, quoting, or aliases differ in your database.' }
      ],
      fix: 'Repair the first confirmed structural error, run the reduced query, and then rebuild incrementally. Avoid making five syntax changes at once because you lose the evidence about which change fixed it.',
      verify: 'The query should parse and return the expected columns at the expected grain. Parsing successfully is not proof the result is analytically correct.',
      prevent: 'Format SQL consistently, build with small CTEs, run each CTE during development, and know which SQL dialect the bootcamp environment uses.'
    },
    {
      id: 'sql-generic',
      match: /.*/,
      title: 'SQL result/query diagnosis',
      confidence: 'Pattern-based',
      errorClass: 'SQL syntax, scope, join, filter, or grain issue',
      cause: 'The symptom does not uniquely identify one SQL failure mode. The fastest path is to reduce the query and verify schema → filters → joins → grain → aggregation in that order.',
      concept: 'A query can execute without being correct. Debug SQL by validating intermediate row counts, distinct business keys, and totals—not only by removing error messages.',
      steps: [
        { question: 'What should one row in the final output represent?', action: 'Write the intended grain, then inspect whether the current SELECT/GROUP BY actually produces it.' },
        { question: 'At which CTE/join does the row count or total first diverge from expectation?', action: 'Run each stage independently with COUNT(*), COUNT(DISTINCT key), and a key SUM.' },
        { question: 'Are filters and date boundaries exactly aligned with the question?', action: 'List every WHERE/JOIN condition in plain English and compare it with the assignment requirement.' }
      ],
      fix: 'Fix the first stage where the query diverges from the expected grain/count/total, then rerun downstream stages. Do not patch the final SELECT to compensate for an upstream logic problem.',
      verify: 'Reconcile a known business total, inspect sample keys, and compare the output grain with the question you are answering.',
      prevent: 'Develop SQL incrementally and keep lightweight assertions for row counts, distinct keys, and metric totals after joins.'
    }
  ],
  Python: [
    {
      id: 'py-keyerror',
      match: /KeyError/i,
      title: 'Python/pandas KeyError',
      confidence: 'High match',
      errorClass: 'Requested dictionary/DataFrame key or label does not exist',
      cause: 'Your code is asking for a key/column/index label that is not present exactly as written at that point in the program.',
      concept: 'KeyError is usually an evidence problem, not a pandas mystery. Inspect the keys/columns that actually exist before changing code.',
      steps: [
        { question: 'What keys or DataFrame columns actually exist at the failing line?', action: "For pandas, run: print(df.columns.tolist())\nFor a dict, run: print(my_dict.keys())" },
        { question: 'Is the requested label different by spelling, capitalization, spaces, or prior renaming?', action: "Print repr() of suspicious column names or use: [repr(c) for c in df.columns]" },
        { question: 'Did an earlier transformation drop/rename the column or change the DataFrame being referenced?', action: 'Trace the variable backward and print df.shape / df.columns immediately after each transformation.' }
      ],
      fix: "Use the label that truly exists or intentionally rename columns once. Example:\n\nprint(df.columns)\ndf = df.rename(columns={'pledged': 'pledged_amount'})\n# then reference df['pledged_amount'] consistently",
      verify: 'Run the failing line, then inspect the selected Series/DataFrame values—not just the absence of an exception—to ensure it is the intended field.',
      prevent: 'Normalize column names after loading, inspect df.columns early, and avoid silently renaming the same concept multiple times.'
    },
    {
      id: 'py-typeerror',
      match: /TypeError/i,
      title: 'Python TypeError',
      confidence: 'High match',
      errorClass: 'Operation received an incompatible object/type',
      cause: 'A function or operator received a type it cannot handle—for example adding a string to an integer or calling a non-callable object.',
      concept: 'Python operations depend on runtime types. Inspect the object and its type at the failing expression before adding conversions.',
      steps: [
        { question: 'Which operand/argument has the unexpected type?', action: 'Print the relevant values and type(value) immediately before the failing line.' },
        { question: 'Where was that object created or converted?', action: 'Trace the variable backward and inspect the first point where its type differs from your expectation.' },
        { question: 'Should the data be converted, or is your operation conceptually wrong for that field?', action: 'Decide the intended semantic type first—numeric, datetime, category, text—then convert explicitly if appropriate.' }
      ],
      fix: "Convert only after confirming the intended type. For pandas numeric data, a common pattern is:\n\ndf['amount'] = pd.to_numeric(df['amount'], errors='coerce')\n\nThen inspect any new NaN values before calculating.",
      verify: 'Check type/dtype after the fix and validate several values, especially any values that could not be converted cleanly.',
      prevent: 'Inspect DataFrame dtypes after loading data and make type conversion an explicit cleaning step rather than relying on implicit coercion.'
    },
    {
      id: 'py-valueerror',
      match: /ValueError/i,
      title: 'Python ValueError',
      confidence: 'High match',
      errorClass: 'Correct general type, invalid value/shape/content',
      cause: 'The function understands the object type but rejects the specific value, format, length, shape, or conversion.',
      concept: 'ValueError often points to bad content or incompatible shapes. Inspect the actual values and dimensions passed to the operation.',
      steps: [
        { question: 'What exact value/shape is being passed when the error occurs?', action: 'Print the suspect value, repr(value), and for arrays/DataFrames print .shape and .dtypes.' },
        { question: 'Does one bad row/value violate the expected format?', action: 'Test the conversion/function on a small sample and identify rows that fail the assumption.' },
        { question: 'Are two arrays/Series/ranges different lengths or incompatible shapes?', action: 'Print len()/.shape for every object involved and verify index alignment.' }
      ],
      fix: 'Clean or reshape the specific invalid input rather than catching ValueError globally. Use explicit parsing/coercion only when you have decided how invalid values should be treated.',
      verify: 'Count values affected by the cleaning step and compare before/after shapes so the fix does not silently drop important data.',
      prevent: 'Validate formats, nulls, ranges, and shapes before transformations that assume clean input.'
    },
    {
      id: 'py-nameerror',
      match: /NameError|is not defined/i,
      title: 'Python NameError',
      confidence: 'High match',
      errorClass: 'Variable/function/module name is not defined in current scope',
      cause: 'The code references a name that has not been created in the current execution path, was misspelled, or disappeared because notebook cells ran out of order.',
      concept: 'Notebook state can hide dependency problems. A robust analysis should run from top to bottom in a fresh kernel/session.',
      steps: [
        { question: 'Where is this name supposed to be defined?', action: 'Search upward for its assignment/import/function definition and check spelling/case.' },
        { question: 'Did you run cells out of order or restart the kernel?', action: 'Restart the kernel/runtime and run the notebook from the top until the failure.' },
        { question: 'Is the name defined only inside another function/loop scope?', action: 'Inspect indentation and scope; decide whether the value needs to be returned or defined in the outer scope.' }
      ],
      fix: 'Define/import the name before use and make notebook execution order explicit. Prefer a clean top-to-bottom run rather than relying on hidden interactive state.',
      verify: 'Restart the environment and Run All. If the notebook only works after manually running cells in a special order, the dependency is still broken.',
      prevent: 'Keep imports and configuration near the top, avoid hidden notebook state, and periodically restart/run-all while developing.'
    },
    {
      id: 'py-module',
      match: /ModuleNotFoundError|No module named|ImportError/i,
      title: 'Python environment/import problem',
      confidence: 'High match',
      errorClass: 'Package/module unavailable or imported from wrong environment',
      cause: 'The active Python environment cannot locate the requested package/module, or the notebook/IDE is using a different interpreter from the one where it was installed.',
      concept: 'Python packages belong to environments/interpreters. Installing a package somewhere does not guarantee the current kernel can import it.',
      steps: [
        { question: 'Which Python interpreter/kernel is actually running?', action: "Run: import sys; print(sys.executable)" },
        { question: 'Is the package installed in that same environment?', action: 'Check the environment package list using the environment/kernel tooling provided by your bootcamp setup.' },
        { question: 'Could a local file/folder name be shadowing the real package?', action: 'Check your project directory for files named like the package (for example pandas.py) and rename them if necessary.' }
      ],
      fix: 'Install/select the dependency in the same environment used by the notebook or IDE, then restart the kernel. Avoid blindly installing into a different system Python.',
      verify: 'Restart the interpreter and import the package in a fresh session. Print its version and module path if environment confusion remains.',
      prevent: 'Use one project environment, record dependencies, and verify the selected interpreter/kernel before starting bootcamp exercises.'
    },
    {
      id: 'py-generic',
      match: /.*/,
      title: 'Python analysis/debugging diagnosis',
      confidence: 'Pattern-based',
      errorClass: 'Python state, type, shape, label, or transformation issue',
      cause: 'The symptom is not specific enough for a unique diagnosis. The reliable method is to isolate the failing line and inspect the values, types, shapes, labels, and state entering it.',
      concept: 'A traceback tells you where Python noticed the problem. Your job is to inspect the program state at that point and trace backward to where the state first became unexpected.',
      steps: [
        { question: 'What is the final relevant line of the traceback and which expression on that line can fail?', action: 'Read the traceback bottom-up and identify the first line in your own code.' },
        { question: 'What are the value, type, shape, and labels immediately before that line?', action: 'Use print/repr/type, and for pandas use .shape, .dtypes, .columns, .head().' },
        { question: 'What is the smallest input that reproduces the error?', action: 'Reduce the code/data to a tiny example. If the tiny example works, reintroduce transformations until it fails.' }
      ],
      fix: 'Correct the first confirmed mismatch in program state—name, type, shape, label, null handling, or transformation logic—then rerun from a clean state.',
      verify: 'Run the code from the start, validate the resulting values, and test an edge case. “No traceback” is not enough if the analysis output is wrong.',
      prevent: 'Build transformations incrementally, inspect outputs after each step, and use assertions/checks for expected columns, shapes, and value ranges.'
    }
  ]
};

const SAMPLES = {
  excel: {
    tool: 'Excel',
    error: '#VALUE! when calculating Goal / Backers',
    code: '=E2/F2\n\nSome imported cells in E are left-aligned and look like numbers.'
  },
  sql: {
    tool: 'SQL',
    error: 'My total revenue is much higher after I join orders to order_items. The query runs but the total is wrong.',
    code: 'SELECT c.category, SUM(o.revenue)\nFROM orders o\nJOIN order_items i ON o.order_id = i.order_id\nJOIN categories c ON i.category_id = c.category_id\nGROUP BY c.category;'
  },
  python: {
    tool: 'Python',
    error: "KeyError: 'pledged_amount'",
    code: "print(df.columns)\n# Index(['pledged', 'goal', 'state'], dtype='object')\n\ndf['pledged_amount'].mean()"
  }
};

let state = loadDoctorState();
let project = loadProject();

function loadDoctorState() {
  try {
    const raw = localStorage.getItem(DOCTOR_KEY);
    if (!raw) return structuredClone(DEFAULT_DOCTOR_STATE);
    return { ...structuredClone(DEFAULT_DOCTOR_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_DOCTOR_STATE);
  }
}

function loadProject() {
  try {
    return JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveDoctorState(message = 'Saved locally') {
  localStorage.setItem(DOCTOR_KEY, JSON.stringify(state));
  els.notesStatus.textContent = message;
  clearTimeout(saveDoctorState.timer);
  saveDoctorState.timer = setTimeout(() => { els.notesStatus.textContent = 'Saved locally'; }, 1200);
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll('.doctor-tool').forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));
  saveDoctorState();
}

function hydrate() {
  if (project?.project?.name) {
    els.projectName.textContent = project.project.name;
    const next = project.tasks?.find(t => !t.done);
    els.projectContext.textContent = next ? `Current NEXT task: ${next.title}` : 'Project loaded. No unfinished NEXT task is currently available.';
  }
  setTool(state.tool || 'Excel');
  els.debugNotes.value = state.notes || '';
  els.learningReflection.value = state.reflection || '';
  if (state.active) {
    els.errorText.value = state.active.errorText || '';
    els.codeText.value = state.active.codeText || '';
    renderActiveDiagnosis();
  }
  renderHistory();
}

function findDiagnosis(tool, combinedText) {
  const templates = LIBRARY[tool] || [];
  return templates.find(template => template.match.test(combinedText)) || templates[templates.length - 1];
}

function startDiagnosis() {
  const errorText = els.errorText.value.trim();
  const codeText = els.codeText.value.trim();
  if (!errorText) {
    showToast('Paste the exact error message or describe the wrong result first.');
    els.errorText.focus();
    return;
  }
  const template = findDiagnosis(state.tool, `${errorText}\n${codeText}`);
  state.active = {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    tool: state.tool,
    errorText,
    codeText,
    diagnosisId: template.id,
    revealedSteps: 0,
    fixRevealed: false,
    status: 'active'
  };
  state.notes = '';
  state.reflection = '';
  els.debugNotes.value = '';
  els.learningReflection.value = '';
  saveDoctorState('Diagnosis started');
  renderActiveDiagnosis();
  showToast('Diagnosis started. Run the first test.');
}

function getActiveTemplate() {
  if (!state.active) return null;
  return (LIBRARY[state.active.tool] || []).find(t => t.id === state.active.diagnosisId) || null;
}

function renderActiveDiagnosis() {
  const template = getActiveTemplate();
  if (!state.active || !template) {
    renderEmptyDiagnosis();
    return;
  }
  setTool(state.active.tool);
  els.diagnosisEmpty.classList.add('hidden');
  els.diagnosisContent.classList.remove('hidden');
  els.diagnosisTitle.textContent = template.title;
  els.diagnosisConfidence.textContent = template.confidence;
  els.errorClass.textContent = template.errorClass;
  els.likelyCause.textContent = template.cause;
  els.conceptToLearn.textContent = template.concept;
  renderSteps(template);
  renderResolution(template);
}

function renderEmptyDiagnosis() {
  els.diagnosisEmpty.classList.remove('hidden');
  els.diagnosisContent.classList.add('hidden');
  els.diagnosisTitle.textContent = 'No diagnosis yet';
  els.diagnosisConfidence.textContent = '—';
  els.resolutionContent.classList.add('hidden');
  els.resolutionLocked.classList.remove('hidden');
  els.unlockBadge.textContent = 'Locked';
  els.unlockBadge.classList.add('locked');
  els.revealFixBtn.disabled = true;
  els.needsReviewBtn.disabled = true;
  els.solvedBtn.disabled = true;
}

function renderSteps(template) {
  const count = Math.min(state.active.revealedSteps || 0, template.steps.length);
  els.stepProgress.textContent = `${count}/${template.steps.length}`;
  if (count === 0) {
    els.diagnosticSteps.innerHTML = '<div class="empty-state">No tests revealed yet.</div>';
    els.nextTestBtn.textContent = 'Reveal first test';
  } else {
    els.diagnosticSteps.innerHTML = template.steps.slice(0, count).map((step, idx) => `
      <div class="diagnostic-step">
        <span class="step-number">TEST ${idx + 1}</span>
        <strong>${escapeHtml(step.question)}</strong>
        <p>Do this:</p>
        <div class="test-action">${escapeHtml(step.action)}</div>
      </div>
    `).join('');
    els.nextTestBtn.textContent = count >= template.steps.length ? 'All tests revealed' : 'Reveal next test';
  }
  els.nextTestBtn.disabled = count >= template.steps.length;
}

function revealNextTest() {
  const template = getActiveTemplate();
  if (!template || !state.active) return;
  state.active.revealedSteps = Math.min((state.active.revealedSteps || 0) + 1, template.steps.length);
  saveDoctorState('Test revealed');
  renderSteps(template);
  renderResolution(template);
}

function renderResolution(template) {
  const unlocked = (state.active?.revealedSteps || 0) >= Math.min(2, template.steps.length);
  els.revealFixBtn.disabled = !unlocked;
  els.needsReviewBtn.disabled = !unlocked;
  els.solvedBtn.disabled = !unlocked;
  els.unlockBadge.textContent = unlocked ? 'Ready' : 'Locked';
  els.unlockBadge.classList.toggle('locked', !unlocked);

  if (state.active?.fixRevealed) {
    els.resolutionLocked.classList.add('hidden');
    els.resolutionContent.classList.remove('hidden');
    els.fixPattern.textContent = template.fix;
    els.verification.textContent = template.verify;
    els.prevention.textContent = template.prevent;
    els.revealFixBtn.textContent = 'Fix pattern revealed';
    els.revealFixBtn.disabled = true;
  } else {
    els.resolutionContent.classList.add('hidden');
    els.resolutionLocked.classList.remove('hidden');
    els.resolutionLocked.textContent = unlocked
      ? 'You have enough diagnostic evidence to reveal the fix pattern. Before clicking, write what you think the cause is in Debug Notes.'
      : 'Complete at least two diagnostic tests before revealing the fix pattern.';
    els.revealFixBtn.textContent = 'Reveal fix pattern';
  }
}

function revealFix() {
  const template = getActiveTemplate();
  if (!template || !state.active || (state.active.revealedSteps || 0) < Math.min(2, template.steps.length)) return;
  state.active.fixRevealed = true;
  saveDoctorState('Fix revealed');
  renderResolution(template);
}

function restartDiagnosis() {
  if (!state.active) return;
  state.active.revealedSteps = 0;
  state.active.fixRevealed = false;
  saveDoctorState('Diagnosis restarted');
  renderActiveDiagnosis();
}

function appendPrompt(prompt) {
  const current = els.debugNotes.value.trimEnd();
  els.debugNotes.value = `${current}${current ? '\n\n' : ''}${prompt}\n`;
  state.notes = els.debugNotes.value;
  saveDoctorState();
  els.debugNotes.focus();
}

function finalize(status) {
  const template = getActiveTemplate();
  if (!template || !state.active) return;
  const reflection = els.learningReflection.value.trim();
  if (reflection.length < 20) {
    els.resolutionMessage.textContent = 'Write at least one clear sentence explaining what caused the error and what you will check next time.';
    els.learningReflection.focus();
    return;
  }
  const record = {
    id: state.active.sessionId,
    finishedAt: new Date().toISOString(),
    projectName: project?.project?.name || '',
    tool: state.active.tool,
    errorText: state.active.errorText,
    diagnosisId: template.id,
    diagnosisTitle: template.title,
    errorClass: template.errorClass,
    reflection,
    status
  };
  state.history = [record, ...(state.history || []).filter(item => item.id !== record.id)].slice(0, 50);
  state.active.status = status;
  state.reflection = reflection;
  saveDoctorState(status === 'solved' ? 'Solved session saved' : 'Review session saved');
  els.resolutionMessage.textContent = status === 'solved'
    ? 'Saved as solved. The pattern is now part of your local debugging memory.'
    : 'Saved for review. Revisit this pattern before the next similar task.';
  renderHistory();
  showToast(status === 'solved' ? 'Error pattern saved as solved.' : 'Saved as needs review.');
}

function renderHistory() {
  const history = state.history || [];
  const solved = history.filter(item => item.status === 'solved').length;
  const review = history.filter(item => item.status === 'review').length;
  els.solvedCount.textContent = solved;
  els.reviewCount.textContent = review;
  if (!history.length) {
    els.historyList.className = 'history-list empty-state';
    els.historyList.textContent = 'No debugging sessions saved yet.';
    return;
  }
  els.historyList.className = 'history-list';
  els.historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-tool">${escapeHtml(item.tool)}</div>
      <div>
        <strong>${escapeHtml(item.diagnosisTitle)}</strong>
        <p>${escapeHtml(truncate(item.errorText, 120))} · ${escapeHtml(formatDate(item.finishedAt))}</p>
      </div>
      <span class="history-status ${item.status === 'solved' ? 'solved' : 'review'}">${item.status === 'solved' ? 'Solved' : 'Review'}</span>
    </div>
  `).join('');
}

function loadSample(name) {
  const sample = SAMPLES[name];
  if (!sample) return;
  setTool(sample.tool);
  els.errorText.value = sample.error;
  els.codeText.value = sample.code;
  state.active = null;
  saveDoctorState();
  renderEmptyDiagnosis();
  showToast(`${sample.tool} sample loaded.`);
}

function newSession() {
  state.active = null;
  state.notes = '';
  state.reflection = '';
  els.errorText.value = '';
  els.codeText.value = '';
  els.debugNotes.value = '';
  els.learningReflection.value = '';
  els.resolutionMessage.textContent = '';
  saveDoctorState('New diagnosis');
  renderEmptyDiagnosis();
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

function truncate(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

els.doctorTools.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]');
  if (!btn) return;
  setTool(btn.dataset.tool);
});

els.diagnoseBtn.addEventListener('click', startDiagnosis);
if (els.newDiagnosisBtn) els.newDiagnosisBtn.addEventListener('click', newSession);
els.nextTestBtn.addEventListener('click', revealNextTest);
els.restartBtn.addEventListener('click', restartDiagnosis);
els.revealFixBtn.addEventListener('click', revealFix);
els.needsReviewBtn.addEventListener('click', () => finalize('review'));
els.solvedBtn.addEventListener('click', () => finalize('solved'));

els.debugNotes.addEventListener('input', () => {
  state.notes = els.debugNotes.value;
  saveDoctorState();
});
els.learningReflection.addEventListener('input', () => {
  state.reflection = els.learningReflection.value;
  saveDoctorState();
});

document.querySelectorAll('[data-prompt]').forEach(btn => {
  btn.addEventListener('click', () => appendPrompt(btn.dataset.prompt));
});
document.querySelectorAll('[data-sample]').forEach(btn => {
  btn.addEventListener('click', () => loadSample(btn.dataset.sample));
});

hydrate();
