const PROJECT_KEY = 'daos-v0.1-state';
const PREFLIGHT_KEY = 'daos-v0.5-preflight';
const MAX_PROFILE_ROWS = 100000;

const $ = (id) => document.getElementById(id);
const els = {
  projectName: $('projectName'),
  projectContext: $('projectContext'),
  datasetDropzone: $('datasetDropzone'),
  datasetInput: $('datasetInput'),
  fileSummary: $('fileSummary'),
  sheetChooserWrap: $('sheetChooserWrap'),
  sheetChooser: $('sheetChooser'),
  profileSheetBtn: $('profileSheetBtn'),
  sampleBtn: $('sampleBtn'),
  exportBtn: $('exportBtn'),
  newDatasetBtn: $('newDatasetBtn'),
  healthBadge: $('healthBadge'),
  rowCount: $('rowCount'),
  columnCount: $('columnCount'),
  duplicateCount: $('duplicateCount'),
  issueCount: $('issueCount'),
  healthExplanation: $('healthExplanation'),
  issuesList: $('issuesList'),
  fieldSearch: $('fieldSearch'),
  fieldTableBody: $('fieldTableBody'),
  targetSuggestions: $('targetSuggestions'),
  dimensionSuggestions: $('dimensionSuggestions'),
  actionChecklist: $('actionChecklist'),
  previewMeta: $('previewMeta'),
  previewTable: $('previewTable'),
  toast: $('toast')
};

let project = loadJson(PROJECT_KEY);
let workbook = null;
let loadedFile = null;
let activeRows = [];
let activeHeaders = [];
let profile = loadJson(PREFLIGHT_KEY);
let issueFilter = 'all';

function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return null; }
}

function saveProfile() {
  if (!profile) return;
  localStorage.setItem(PREFLIGHT_KEY, JSON.stringify(profile));
}

function hydrateProject() {
  project = loadJson(PROJECT_KEY);
  if (project?.project?.name) {
    els.projectName.textContent = project.project.name;
    const next = project.tasks?.find(task => !task.done);
    els.projectContext.textContent = next
      ? `Current NEXT task: ${next.title}`
      : 'Project loaded. No unfinished NEXT task is currently available.';
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

function normalizeHeaders(raw) {
  const seen = new Map();
  return raw.map((value, index) => {
    let base = String(value ?? '').trim() || `column_${index + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function arraysToObjects(matrix) {
  if (!matrix.length) return { headers: [], rows: [] };
  const headers = normalizeHeaders(matrix[0]);
  const rows = matrix.slice(1).map(values => {
    const obj = {};
    headers.forEach((header, idx) => { obj[header] = values[idx] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

async function handleFile(file) {
  if (!file) return;
  loadedFile = file;
  const ext = file.name.split('.').pop().toLowerCase();
  resetTransientData();
  els.fileSummary.className = 'file-summary';
  els.fileSummary.textContent = `${file.name} · ${formatBytes(file.size)} · reading…`;

  try {
    if (ext === 'csv') {
      const text = await file.text();
      const matrix = parseCsv(text);
      const parsed = arraysToObjects(matrix);
      activeHeaders = parsed.headers;
      activeRows = parsed.rows;
      workbook = null;
      els.sheetChooserWrap.classList.add('hidden');
      runProfile(file.name, 'CSV');
    } else if (ext === 'xlsx' || ext === 'xls') {
      if (typeof XLSX === 'undefined') {
        throw new Error('Excel parser did not load. Check your internet connection or use CSV.');
      }
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      els.sheetChooser.innerHTML = workbook.SheetNames.map(name => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join('');
      els.sheetChooserWrap.classList.remove('hidden');
      els.fileSummary.textContent = `${file.name} · ${formatBytes(file.size)} · ${workbook.SheetNames.length} sheet(s)`;
      profileSelectedSheet();
    } else {
      throw new Error('Unsupported file type. Use CSV, XLSX or XLS.');
    }
  } catch (error) {
    els.fileSummary.textContent = `Could not read ${file.name}: ${error.message}`;
    showToast(error.message);
  }
}

function profileSelectedSheet() {
  if (!workbook) return;
  const sheetName = els.sheetChooser.value || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const parsed = arraysToObjects(matrix);
  activeHeaders = parsed.headers;
  activeRows = parsed.rows;
  runProfile(`${loadedFile?.name || 'Workbook'} · ${sheetName}`, 'Excel');
}

function runProfile(label, format) {
  if (!activeHeaders.length) {
    showToast('No columns were found in this dataset.');
    return;
  }

  const rowsForProfile = activeRows.slice(0, MAX_PROFILE_ROWS);
  const truncated = activeRows.length > MAX_PROFILE_ROWS;
  const columnProfiles = activeHeaders.map(header => profileColumn(header, rowsForProfile));
  const duplicates = countDuplicates(rowsForProfile, activeHeaders);
  const issues = detectIssues(columnProfiles, duplicates, rowsForProfile.length);
  const targets = suggestTargets(columnProfiles);
  const dimensions = suggestDimensions(columnProfiles);
  const actions = buildActions(columnProfiles, issues, duplicates, targets, dimensions);

  profile = {
    version: '0.5.0',
    generatedAt: new Date().toISOString(),
    projectName: project?.project?.name || '',
    file: {
      name: loadedFile?.name || label,
      label,
      format,
      size: loadedFile?.size || null
    },
    rows: activeRows.length,
    profiledRows: rowsForProfile.length,
    truncated,
    columns: activeHeaders.length,
    duplicates,
    columnProfiles,
    issues,
    targets,
    dimensions,
    actions,
    preview: rowsForProfile.slice(0, 8)
  };

  saveProfile();
  renderProfile();
  els.fileSummary.textContent = `${label} · ${activeRows.length.toLocaleString()} rows · ${activeHeaders.length} columns${truncated ? ` · profiled first ${MAX_PROFILE_ROWS.toLocaleString()}` : ''}`;
  els.exportBtn.disabled = false;
  showToast('Dataset profile created.');
}

function profileColumn(name, rows) {
  const values = rows.map(row => row[name]);
  const nonBlank = values.filter(value => !isBlank(value));
  const missing = values.length - nonBlank.length;
  const normalized = nonBlank.map(value => normalizeValue(value));
  const uniqueValues = new Set(normalized.map(value => String(value))).size;
  const typeCounts = { number: 0, date: 0, boolean: 0, text: 0 };

  normalized.forEach(value => { typeCounts[classifyValue(value)] += 1; });
  const inferredType = inferColumnType(typeCounts, nonBlank.length);
  const base = {
    name,
    type: inferredType,
    missing,
    missingPct: values.length ? missing / values.length : 0,
    unique: uniqueValues,
    uniquePct: nonBlank.length ? uniqueValues / nonBlank.length : 0,
    nonBlank: nonBlank.length,
    topValues: topValues(normalized, 4),
    numeric: null,
    dates: null,
    outliers: 0,
    role: inferRole(name, inferredType, uniqueValues, nonBlank.length)
  };

  if (inferredType === 'number') {
    const nums = normalized.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (nums.length) {
      const q1 = quantile(nums, .25);
      const q3 = quantile(nums, .75);
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      base.numeric = {
        min: nums[0],
        max: nums[nums.length - 1],
        mean: nums.reduce((sum, value) => sum + value, 0) / nums.length,
        median: quantile(nums, .5),
        q1,
        q3
      };
      base.outliers = iqr > 0 ? nums.filter(value => value < lower || value > upper).length : 0;
    }
  }

  if (inferredType === 'date') {
    const dates = normalized.map(parseDate).filter(Boolean).sort((a, b) => a - b);
    if (dates.length) {
      base.dates = { min: dates[0].toISOString(), max: dates[dates.length - 1].toISOString() };
    }
  }

  return base;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value.trim() : value;
}

function classifyValue(value) {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  const text = String(value).trim();
  if (/^(true|false|yes|no)$/i.test(text)) return 'boolean';
  if (isNumericString(text)) return 'number';
  if (looksLikeDate(text)) return 'date';
  return 'text';
}

function isNumericString(text) {
  if (!text || /^0\d{4,}$/.test(text)) return false;
  const cleaned = text.replace(/[$£€¥,%\s]/g, '').replace(/,/g, '');
  return cleaned !== '' && Number.isFinite(Number(cleaned));
}

function looksLikeDate(text) {
  if (!text || text.length < 6) return false;
  if (!/[\/-]|[A-Za-z]{3}/.test(text)) return false;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed);
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inferColumnType(counts, total) {
  if (!total) return 'empty';
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topType, topCount] = ranked[0];
  const activeTypes = ranked.filter(([, count]) => count > 0).length;
  if (activeTypes > 1 && topCount / total < .9) return 'mixed';
  return topType;
}

function topValues(values, limit) {
  const counts = new Map();
  values.forEach(value => {
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function inferRole(name, type, unique, nonBlank) {
  const n = name.toLowerCase();
  if (/id$|^id$|_id$|uuid|identifier|key$/.test(n) && nonBlank && unique / nonBlank > .8) return 'Identifier';
  if (/target|outcome|label|status|state|success|successful|funded|converted|churn|response/.test(n)) return 'Target candidate';
  if (type === 'date' || /date|time|timestamp|month|year|day/.test(n)) return 'Time dimension';
  if (/country|city|region|category|segment|type|channel|product|gender|department|source/.test(n)) return 'Dimension';
  if (type === 'number' && /revenue|amount|price|cost|goal|pledge|sales|profit|margin|score|duration|age|count/.test(n)) return 'Measure';
  if (type === 'text' && unique > 1 && unique <= Math.max(30, Math.sqrt(nonBlank || 1) * 2)) return 'Dimension candidate';
  return 'Unclassified';
}

function countDuplicates(rows, headers) {
  const seen = new Set();
  let duplicates = 0;
  rows.forEach(row => {
    const key = headers.map(header => String(row[header] ?? '').trim()).join('\u241f');
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  });
  return duplicates;
}

function detectIssues(columns, duplicates, rowCount) {
  const issues = [];
  if (duplicates > 0) {
    issues.push({
      severity: duplicates / Math.max(rowCount, 1) > .05 ? 'high' : 'medium',
      title: `${duplicates.toLocaleString()} duplicate row${duplicates === 1 ? '' : 's'} detected`,
      detail: 'Duplicates can inflate counts, sums and rates. Confirm whether repeated rows are legitimate observations before deleting anything.'
    });
  }

  columns.forEach(col => {
    if (col.type === 'mixed') {
      issues.push({ severity: 'high', title: `${col.name}: mixed value types`, detail: 'The column contains incompatible representations. Standardize its type before filtering, grouping or calculating.' });
    }
    if (col.missingPct >= .5) {
      issues.push({ severity: 'high', title: `${col.name}: ${pct(col.missingPct)} missing`, detail: 'More than half the values are missing. Decide whether the field is usable, whether missingness is meaningful, and whether another source is needed.' });
    } else if (col.missingPct >= .2) {
      issues.push({ severity: 'medium', title: `${col.name}: ${pct(col.missingPct)} missing`, detail: 'Missing values are substantial enough to change totals or segment comparisons. Define a treatment before analysis.' });
    } else if (col.missingPct > 0) {
      issues.push({ severity: 'low', title: `${col.name}: ${pct(col.missingPct)} missing`, detail: 'A small amount of missing data exists. Check whether it is random or concentrated in a specific group.' });
    }
    if (col.type === 'number' && col.outliers > 0 && col.nonBlank && col.outliers / col.nonBlank >= .01) {
      issues.push({ severity: col.outliers / col.nonBlank >= .05 ? 'medium' : 'low', title: `${col.name}: ${col.outliers.toLocaleString()} IQR outlier${col.outliers === 1 ? '' : 's'}`, detail: 'Outliers may be valid business events or data errors. Inspect them before using averages or setting visual scales.' });
    }
    if (col.role === 'Identifier' && col.missing > 0) {
      issues.push({ severity: 'medium', title: `${col.name}: identifier has missing values`, detail: 'Missing identifiers can break joins, uniqueness assumptions and row-level traceability.' });
    }
  });

  return issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(severity) {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

function suggestTargets(columns) {
  return columns
    .map(col => {
      const n = col.name.toLowerCase();
      let score = 0;
      const reasons = [];
      if (/target|outcome|label|success|successful|funded|converted|churn|status|state|response/.test(n)) { score += 4; reasons.push('outcome-like name'); }
      if (col.unique >= 2 && col.unique <= 12) { score += 2; reasons.push(`${col.unique} distinct values`); }
      if (col.type === 'boolean') { score += 3; reasons.push('boolean'); }
      if (col.missingPct < .1) score += 1;
      return { name: col.name, score, reason: reasons.join(' · ') || 'weak signal' };
    })
    .filter(item => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function suggestDimensions(columns) {
  return columns
    .map(col => {
      let score = 0;
      const reasons = [];
      if (['Dimension', 'Dimension candidate', 'Time dimension'].includes(col.role)) { score += 3; reasons.push(col.role); }
      if (col.unique >= 2 && col.unique <= 50) { score += 2; reasons.push(`${col.unique} groups`); }
      if (col.type === 'date') { score += 2; reasons.push('date field'); }
      if (col.missingPct < .2) score += 1;
      return { name: col.name, score, reason: reasons.join(' · ') || 'weak signal' };
    })
    .filter(item => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildActions(columns, issues, duplicates, targets, dimensions) {
  const actions = [];
  const mixed = columns.filter(col => col.type === 'mixed');
  const missingImportant = columns.filter(col => col.missingPct >= .2);
  const dates = columns.filter(col => col.type === 'date' || col.role === 'Time dimension');

  if (mixed.length) actions.push({ title: 'Standardize mixed-type columns', detail: `Start with ${mixed.slice(0, 3).map(c => c.name).join(', ')}. Confirm whether values should be numbers, dates, booleans or text.` });
  if (duplicates) actions.push({ title: 'Investigate duplicate rows', detail: `Determine why ${duplicates.toLocaleString()} duplicate row(s) exist before deciding whether to remove them.` });
  if (missingImportant.length) actions.push({ title: 'Define missing-value treatment', detail: `High-missing fields: ${missingImportant.slice(0, 4).map(c => c.name).join(', ')}. Decide whether to exclude, impute, label as missing, or source better data.` });
  if (targets.length) actions.push({ title: `Confirm the outcome field`, detail: `Preflight's strongest target candidate is ${targets[0].name}. Check the assignment brief and define exactly what each value means before calculating success/rates.` });
  if (dates.length) actions.push({ title: 'Validate date fields before extracting time features', detail: `Confirm parsing/timezone/period completeness for ${dates.slice(0, 3).map(c => c.name).join(', ')} before creating month, weekday, duration or trend analyses.` });
  if (dimensions.length) actions.push({ title: 'Choose only dimensions that answer the brief', detail: `Potential segments include ${dimensions.slice(0, 5).map(d => d.name).join(', ')}. Do not analyse every available field by default.` });
  if (issues.some(issue => issue.title.includes('outlier'))) actions.push({ title: 'Inspect extreme values', detail: 'Compare flagged extremes with source records and business context before trimming, winsorizing or using means.' });
  actions.push({ title: 'Write one manual validation check', detail: 'Before building charts, manually reproduce one count, sum or rate from a small subset so you know the transformation logic is correct.' });
  actions.push({ title: 'Preserve the raw file', detail: 'Do cleaning in a copy/query/notebook step. Do not overwrite the original source dataset.' });
  return actions.slice(0, 8);
}

function renderProfile() {
  if (!profile) return renderEmpty();
  els.rowCount.textContent = profile.rows.toLocaleString();
  els.columnCount.textContent = profile.columns.toLocaleString();
  els.duplicateCount.textContent = profile.duplicates.toLocaleString();
  els.issueCount.textContent = profile.issues.length.toLocaleString();
  renderHealth();
  renderIssues();
  renderFields();
  renderSuggestions();
  renderActions();
  renderPreview();
  els.exportBtn.disabled = false;
}

function renderHealth() {
  const high = profile.issues.filter(issue => issue.severity === 'high').length;
  const medium = profile.issues.filter(issue => issue.severity === 'medium').length;
  let level = 'good';
  let label = 'Good starting point';
  if (high >= 2 || (high >= 1 && medium >= 3)) { level = 'bad'; label = 'Needs attention'; }
  else if (high || medium >= 2) { level = 'warn'; label = 'Review before analysis'; }
  els.healthBadge.className = `health-badge ${level}`;
  els.healthBadge.textContent = label;
  els.healthExplanation.className = 'health-explanation';
  els.healthExplanation.textContent = profile.truncated
    ? `Profile based on the first ${profile.profiledRows.toLocaleString()} of ${profile.rows.toLocaleString()} rows. ${high} high and ${medium} medium issue(s) detected.`
    : `${high} high and ${medium} medium issue(s) detected across ${profile.rows.toLocaleString()} rows. “Good” means no obvious structural issue was detected—not that the data is analytically correct.`;
}

function renderIssues() {
  const issues = issueFilter === 'all' ? profile.issues : profile.issues.filter(issue => issue.severity === issueFilter);
  if (!issues.length) {
    els.issuesList.className = 'issues-list empty-state';
    els.issuesList.textContent = issueFilter === 'all' ? 'No obvious structural issues were detected.' : `No ${issueFilter}-severity issues detected.`;
    return;
  }
  els.issuesList.className = 'issues-list';
  els.issuesList.innerHTML = issues.map(issue => `
    <div class="issue-item ${issue.severity}">
      <div class="issue-item-head">
        <div><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.detail)}</p></div>
        <span class="issue-severity">${escapeHtml(issue.severity)}</span>
      </div>
    </div>
  `).join('');
}

function renderFields() {
  const search = els.fieldSearch.value.trim().toLowerCase();
  const columns = profile.columnProfiles.filter(col => !search || `${col.name} ${col.type} ${col.role}`.toLowerCase().includes(search));
  if (!columns.length) {
    els.fieldTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No fields match this search.</td></tr>';
    return;
  }
  els.fieldTableBody.innerHTML = columns.map(col => `
    <tr>
      <td>${escapeHtml(col.name)}</td>
      <td><span class="type-pill ${escapeHtml(col.type)}">${escapeHtml(col.type)}</span></td>
      <td>${col.missing.toLocaleString()} <span class="muted-mini">(${pct(col.missingPct)})</span></td>
      <td>${col.unique.toLocaleString()} <span class="muted-mini">(${pct(col.uniquePct)})</span></td>
      <td>${formatColumnSummary(col)}</td>
      <td><span class="role-pill">${escapeHtml(col.role)}</span></td>
    </tr>
  `).join('');
}

function formatColumnSummary(col) {
  if (col.numeric) return `${formatNumber(col.numeric.min)} → ${formatNumber(col.numeric.max)} <span class="muted-mini">· mean ${formatNumber(col.numeric.mean)}</span>`;
  if (col.dates) return `${escapeHtml(shortDate(col.dates.min))} → ${escapeHtml(shortDate(col.dates.max))}`;
  if (col.topValues?.length) return col.topValues.map(item => `${escapeHtml(truncate(item.value, 24))} <span class="muted-mini">(${item.count})</span>`).join(' · ');
  return '—';
}

function renderSuggestions() {
  els.targetSuggestions.className = profile.targets.length ? 'suggestion-list' : 'suggestion-list empty-state';
  els.targetSuggestions.innerHTML = profile.targets.length
    ? profile.targets.map(item => `<div class="suggestion-chip"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.reason)}</span></div>`).join('')
    : 'No strong target/outcome field detected. Use the assignment brief to identify the outcome manually.';

  els.dimensionSuggestions.className = profile.dimensions.length ? 'suggestion-list' : 'suggestion-list empty-state';
  els.dimensionSuggestions.innerHTML = profile.dimensions.length
    ? profile.dimensions.map(item => `<div class="suggestion-chip"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.reason)}</span></div>`).join('')
    : 'No strong segmentation fields detected.';
}

function renderActions() {
  els.actionChecklist.className = 'action-checklist';
  els.actionChecklist.innerHTML = profile.actions.map((action, index) => `
    <div class="action-item">
      <div class="action-number">${index + 1}</div>
      <div><strong>${escapeHtml(action.title)}</strong><p>${escapeHtml(action.detail)}</p></div>
    </div>
  `).join('');
}

function renderPreview() {
  const rows = activeRows.length ? activeRows.slice(0, 8) : profile.preview || [];
  const headers = activeHeaders.length ? activeHeaders : profile.columnProfiles.map(col => col.name);
  if (!rows.length || !headers.length) {
    els.previewTable.innerHTML = '<tbody><tr><td class="empty-cell">No preview available.</td></tr></tbody>';
    return;
  }
  els.previewTable.innerHTML = `
    <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${headers.map(header => `<td>${escapeHtml(truncate(row[header], 80))}</td>`).join('')}</tr>`).join('')}</tbody>
  `;
  els.previewMeta.textContent = `Showing ${rows.length} row(s)`;
}

function renderEmpty() {
  els.rowCount.textContent = '—';
  els.columnCount.textContent = '—';
  els.duplicateCount.textContent = '—';
  els.issueCount.textContent = '—';
  els.healthBadge.className = 'health-badge neutral';
  els.healthBadge.textContent = 'Not profiled';
}

function exportProfile() {
  if (!profile) return;
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(profile.file?.name || 'dataset')}-preflight.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Dataset profile exported.');
}

function newDataset() {
  loadedFile = null;
  workbook = null;
  activeRows = [];
  activeHeaders = [];
  profile = null;
  localStorage.removeItem(PREFLIGHT_KEY);
  els.datasetInput.value = '';
  els.fileSummary.className = 'file-summary empty-state';
  els.fileSummary.textContent = 'No dataset loaded.';
  els.sheetChooserWrap.classList.add('hidden');
  els.exportBtn.disabled = true;
  els.issuesList.className = 'issues-list empty-state';
  els.issuesList.textContent = 'No profile yet.';
  els.fieldTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">Load a dataset to inspect fields.</td></tr>';
  els.targetSuggestions.className = 'suggestion-list empty-state';
  els.targetSuggestions.textContent = 'No suggestions yet.';
  els.dimensionSuggestions.className = 'suggestion-list empty-state';
  els.dimensionSuggestions.textContent = 'No suggestions yet.';
  els.actionChecklist.className = 'action-checklist empty-state';
  els.actionChecklist.textContent = 'No recommendations yet.';
  els.previewTable.innerHTML = '<tbody><tr><td class="empty-cell">No preview available.</td></tr></tbody>';
  els.previewMeta.textContent = '—';
  renderEmpty();
  showToast('Ready for a new dataset.');
}

function resetTransientData() {
  workbook = null;
  activeRows = [];
  activeHeaders = [];
}

function loadSample() {
  loadedFile = { name: 'kickstarter_sample.csv', size: 0 };
  activeHeaders = ['project_id', 'category', 'country', 'goal', 'pledged', 'state', 'launch_date', 'duration_days'];
  activeRows = [
    { project_id:'K001', category:'Games', country:'US', goal:'5000', pledged:'8200', state:'successful', launch_date:'2026-01-04', duration_days:'30' },
    { project_id:'K002', category:'Technology', country:'GB', goal:'25000', pledged:'17000', state:'failed', launch_date:'2026-02-14', duration_days:'45' },
    { project_id:'K003', category:'Games', country:'US', goal:'3000', pledged:'5100', state:'successful', launch_date:'2026-03-02', duration_days:'21' },
    { project_id:'K004', category:'Film', country:'CA', goal:'10000', pledged:'', state:'failed', launch_date:'2026-03-18', duration_days:'30' },
    { project_id:'K005', category:'Design', country:'AE', goal:'7500', pledged:'9100', state:'successful', launch_date:'2026-04-11', duration_days:'30' },
    { project_id:'K006', category:'Technology', country:'GB', goal:'2500000', pledged:'12000', state:'failed', launch_date:'2026-05-01', duration_days:'90' },
    { project_id:'K006', category:'Technology', country:'GB', goal:'2500000', pledged:'12000', state:'failed', launch_date:'2026-05-01', duration_days:'90' }
  ];
  els.sheetChooserWrap.classList.add('hidden');
  runProfile('kickstarter_sample.csv', 'CSV');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B','KB','MB','GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function pct(value) { return `${(value * 100).toFixed(value >= .1 ? 1 : 2)}%`; }
function formatNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  return abs >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : Number(value.toFixed(3)).toString();
}
function shortDate(value) {
  try { return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(new Date(value)); }
  catch { return String(value); }
}
function truncate(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function slugify(value) { return String(value).toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function escapeAttr(value) { return escapeHtml(value); }
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

els.datasetInput.addEventListener('change', event => handleFile(event.target.files[0]));
['dragenter','dragover'].forEach(name => els.datasetDropzone.addEventListener(name, event => {
  event.preventDefault();
  els.datasetDropzone.classList.add('dragging');
}));
['dragleave','drop'].forEach(name => els.datasetDropzone.addEventListener(name, event => {
  event.preventDefault();
  els.datasetDropzone.classList.remove('dragging');
}));
els.datasetDropzone.addEventListener('drop', event => handleFile(event.dataTransfer.files[0]));
els.profileSheetBtn.addEventListener('click', profileSelectedSheet);
els.sampleBtn.addEventListener('click', loadSample);
els.exportBtn.addEventListener('click', exportProfile);
els.newDatasetBtn.addEventListener('click', newDataset);
els.fieldSearch.addEventListener('input', () => profile && renderFields());
document.querySelectorAll('[data-issue-filter]').forEach(button => {
  button.addEventListener('click', () => {
    issueFilter = button.dataset.issueFilter;
    document.querySelectorAll('[data-issue-filter]').forEach(b => b.classList.toggle('active', b === button));
    if (profile) renderIssues();
  });
});

hydrateProject();
if (profile) {
  renderProfile();
  els.fileSummary.className = 'file-summary';
  els.fileSummary.textContent = `${profile.file?.label || profile.file?.name || 'Previous dataset'} · saved profile from ${shortDate(profile.generatedAt)} · raw file not retained`;
}
