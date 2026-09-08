# DA.OS V0.8 — Data Analyst Bootcamp OS

DA.OS is a local-first operating system for intensive data-analytics coursework. It is designed around one requirement: **whatever assignment the learner receives, the system should help interpret it, execute it, retain proof, learn from mistakes, and stop avoidable submission errors.**

## V0.8 flow

```text
ANY ASSIGNMENT
      ↓
Universal Assignment Adapter
      ↓
Deliverables + constraints + rubric + work type
      ↓
Task graph with evidence + validation expectations
      ↓
NEXT
      ↓
Dataset Preflight / Learning Coach / Error Doctor
      ↓
Rubric + Evidence Engine
      ↓
Feedback Memory
      ↓
V0.8 Submission Gate
      ↓
PASS / WARN / BLOCK
```

## Current modules

### Project Workspace + NEXT
- project name, deadline, tool selection and assignment brief
- local file metadata
- execution checklist and progress
- first unfinished task shown as the next best action
- direct routes into the specialist modules

### Universal Assignment Adapter
Accepts pasted instructions/rubrics or locally extracts supported text from PDF, DOCX, TXT, Markdown, SQL, Python, Jupyter notebooks, JSON and CSV.

It detects likely work types including data cleaning, EDA, Excel, SQL, Python/pandas, statistics, Power BI, Tableau, dashboard work, presentations, business cases and capstones. It extracts deliverables, constraints, grading signals, required tools and ambiguities, then generates a task graph.

Each generated task includes:
- what to do
- why it matters
- what evidence to retain
- how to validate the result

### Dataset Preflight
Profiles CSV/XLS/XLSX data locally for:
- rows / columns
- duplicates
- missingness
- inferred types
- cardinality
- numeric ranges / summary statistics
- IQR outliers
- date ranges
- likely identifiers, measures, dimensions and targets

Raw dataset rows are not persisted in localStorage.

### Learning Coach
Supports Excel, SQL, Python, Power BI and Tableau using a reasoning → structure → validation → worked-pattern hint ladder.

### Error Doctor
Guided Excel / SQL / Python debugging that reveals diagnostic tests before the fix and preserves repeated debugging patterns.

### Feedback Memory
Stores instructor/self/peer corrections as reusable Blocker / Warning / Tip rules that can reappear in later project context.

### Rubric + Evidence Engine (V0.7)
Builds a live coverage matrix from Adapter deliverables, constraints and rubric lines (or project requirements as a fallback).

Each criterion moves through:

```text
MISSING
  ↓
EVIDENCE ADDED
  ↓
VERIFIED
```

Evidence can represent files, calculations, SQL, notebook output, dashboards, visuals, slides, screenshots, written explanations and validation checks. Raw evidence file bytes are not stored; optional file selection retains metadata only.

Coverage metrics are **evidence coverage, not grade predictions**.

## V0.8 Submission Gate

Submission Gate is the final project check. It combines existing DA.OS state with explicit manual confirmations and returns:

- **BLOCK** — do not submit while this remains unresolved
- **WARN** — no hard stop, but judgment/review is still required
- **PASS** — this check is satisfied

### Automated checks
V0.8 checks, where applicable:
- whether a project/assignment exists
- whether explicit rubric/deliverable/constraint criteria exist
- criteria with no linked evidence
- evidence linked but not explicitly verified
- stale V0.7 evidence maps after an assignment/rubric change
- unfinished final-QA tasks
- other unfinished workflow tasks
- whether a Dataset Preflight profile exists for data-oriented work
- high-severity issues in the latest preflight profile
- truncated preflight profiles
- project mismatch between current work and saved preflight profile
- active blocker-level Feedback Memory rules that match the project context

### Manual final checks
Some things cannot be proved from browser metadata because DA.OS does not execute or inspect every real workbook, database, dashboard or deck.

V0.8 therefore requires explicit learner confirmation for the relevant items:
- original brief/rubric re-read against final outputs
- headline numbers traced back to source calculations
- visual labels/units/sorting/filters reviewed
- narrative and recommendations checked against the actual evidence
- final files opened and checked for correct version/format/name
- material assumptions/limitations disclosed where relevant

Relevant unchecked manual checks become **BLOCK** items.

### Overall status
- any BLOCK → overall `BLOCK`
- no BLOCK but at least one WARN → overall `WARN`
- no BLOCK and no WARN → overall `PASS`

A PASS means **no current completeness/QA warning was detected by the checks available to DA.OS**. It does **not** guarantee a grade, instructor approval, hidden-rubric compliance, or factual business correctness.

### Export
The Submission Gate report can be exported as JSON with:
- overall status
- BLOCK / WARN / PASS counts
- verified criterion coverage
- weighted rubric evidence coverage (if detected)
- stale-map state
- all individual checks and next actions
- manual-check confirmations

## Quick start

No build step is required.

```bash
cd da-os
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Main pages:

```text
/index.html       Workspace + quick Deconstructor + NEXT
/adapter.html     Universal Assignment Adapter
/evidence.html    Rubric + Evidence Engine
/preflight.html   Dataset Preflight
/coach.html       Learning Coach
/doctor.html      Error Doctor
/memory.html      Feedback Memory
/submission.html  Submission Gate
```

## Privacy

DA.OS remains local-first.

- project/assignment text is stored in browser localStorage when committed to the project
- assignment source files are read locally and are not uploaded by DA.OS
- Dataset Preflight does not persist raw data rows
- Rubric + Evidence does not persist raw evidence file bytes
- Submission Gate reads existing DA.OS local state and stores only manual-check state / last-run metadata

External browser libraries currently used:
- SheetJS for XLS/XLSX parsing
- PDF.js for PDF assignment-text extraction
- Mammoth.js for DOCX assignment-text extraction

Storage keys:
- `daos-v0.1-state` — shared project state
- `daos-v0.2-coach` — Learning Coach
- `daos-v0.3-doctor` — Error Doctor
- `daos-v0.4-feedback-memory` — feedback rules
- `daos-v0.5-preflight` — dataset profile summary only
- `daos-v0.7-evidence` — evidence register + assignment signature
- `daos-v0.8-submission` — manual final checks + last-run timestamp

## Design principles

1. Adapt before executing.
2. Plan from explicit deliverables and constraints.
3. Inspect data before analysing.
4. Reason before revealing answers.
5. Done is not the same as proven.
6. Evidence added is not the same as verified.
7. A polished output can still be wrong.
8. Do not hide uncertainty behind a single fake score.
9. Keep raw files/data local and transient where possible.
10. Make the learner more independent over time.

## Next planned modules

### V0.9 — Unified “I'm stuck” Router
One intake that routes the learner to Assignment Adapter, Dataset Preflight, Learning Coach, Error Doctor, Feedback Memory, Rubric + Evidence or Submission Gate based on the problem described.

### V1.0 — Optional AI reasoning layer
Use AI for ambiguous/unusual briefs and semantic interpretation while retaining deterministic state, evidence, validation and privacy-oriented fallbacks.

Portfolio mode remains later, after real GA projects exist.

## Current limitations

- assignment classification is deterministic pattern/rule analysis rather than semantic AI reasoning
- rubric extraction understands visible/simple criteria and weights, not hidden instructor expectations
- V0.7 does not inspect raw linked evidence file contents
- V0.8 cannot independently execute SQL, Excel formulas, Python notebooks, Power BI interactions or Tableau workbooks
- V0.8 relies on explicit learner confirmations for checks that require actual artifact inspection
- Dataset Preflight flags possible issues; it does not prove that an outlier or missing value is wrong
- PDF extraction requires selectable text; scanned PDFs need OCR or pasted text
- PPTX instruction extraction and screenshot OCR are not yet supported

These limitations are intentional: DA.OS should remain transparent about what it knows and what still requires human judgment.