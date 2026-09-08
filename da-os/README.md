# DA.OS V0.9 — Data Analyst Bootcamp OS

DA.OS is a local-first operating system for intensive data-analytics coursework. It is designed around one requirement: **whatever assignment the learner receives, the system should help interpret it, execute it, retain proof, learn from mistakes, and stop avoidable submission errors.**

## V0.9 flow

```text
I'M STUCK
   ↓
Unified Router
   ↓
Assignment Adapter / Dataset Preflight / NEXT / Learning Coach
Error Doctor / Feedback Memory / Rubric + Evidence / Submission Gate
   ↓
Return to the same project state
```

The normal end-to-end assignment flow remains:

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
Submission Gate
      ↓
PASS / WARN / BLOCK
```

## V0.9 Unified “I'm Stuck” Router

V0.9 removes the requirement that the learner must know which DA.OS module to open.

Describe the blockage in normal language, for example:
- “I don't understand what this assignment wants me to deliver.”
- “I have a new dataset and don't know what to inspect first.”
- “My SQL total doubled after a join.”
- “I know the task but don't know how to do it in Power BI.”
- “My instructor said my recommendations are just observations.”
- “I finished everything. Am I safe to submit?”

The router scores the description against transparent routing rules and combines those signals with the current DA.OS state:
- whether a project is loaded
- current NEXT task
- number of unfinished tasks
- whether Dataset Preflight exists
- evidence-register size
- active feedback rules
- whether Submission Gate has been run before

Possible destinations:
- **Universal Assignment Adapter** — unclear brief, deliverables, rubric, grading criteria, scope
- **Dataset Preflight** — new/unknown data, missing values, duplicates, types, outliers, data-quality questions
- **Error Doctor** — exact errors, wrong totals/results, broken formulas, tracebacks, join fan-out, runtime failures
- **Learning Coach** — knows the task but needs to learn how to perform it
- **Rubric + Evidence** — proving completion, coverage gaps, rubric/criterion evidence
- **Feedback Memory** — instructor/reviewer correction, mistake, reusable lesson
- **Submission Gate** — final readiness, finished work, before hand-in
- **NEXT** — assignment is understood; learner mainly needs the next action

The router shows:
- recommended destination
- routing confidence
- matched signals
- next action
- up to three alternatives
- recent routing history

It stores the most recent handoff under `daos-v0.9-route-context` so the route is traceable. Routing history is stored under `daos-v0.9-router`.

A reusable **I'm stuck** launcher is also available from the major DA.OS modules so routing is accessible without returning to the homepage.

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

Each generated task includes what to do, why it matters, what evidence to retain, and how to validate the result.

### Dataset Preflight
Profiles CSV/XLS/XLSX data locally for rows/columns, duplicates, missingness, inferred types, cardinality, numeric ranges, summary statistics, IQR outliers, date ranges, and likely identifiers/measures/dimensions/targets. Raw rows are not persisted in localStorage.

### Learning Coach
Supports Excel, SQL, Python, Power BI and Tableau using a reasoning → structure → validation → worked-pattern hint ladder.

### Error Doctor
Guided Excel / SQL / Python debugging that reveals diagnostic tests before the fix and preserves repeated debugging patterns.

### Feedback Memory
Stores instructor/self/peer corrections as reusable Blocker / Warning / Tip rules that can reappear in later project context.

### Rubric + Evidence Engine
Builds a live coverage matrix from Adapter deliverables, constraints and rubric lines (or project requirements as a fallback).

Each criterion moves through:

```text
MISSING → EVIDENCE ADDED → VERIFIED
```

Coverage metrics are **evidence coverage, not grade predictions**.

### Submission Gate
Returns **BLOCK / WARN / PASS** using project state, evidence coverage, Dataset Preflight, Feedback Memory and explicit final manual checks. A PASS is a completeness/QA signal, not a grade guarantee.

## Quick start

No build step is required.

```bash
cd da-os
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Main pages:

```text
/index.html       Workspace + quick Deconstructor + NEXT
/router.html      Unified “I'm stuck” Router
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
- Submission Gate stores only manual-check state / last-run metadata
- Unified Router stores only the typed problem description, route metadata/history and current project/task names — not raw assignment/evidence/data files

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
- `daos-v0.9-router` — recent route history
- `daos-v0.9-route-context` — most recent router handoff

## Design principles

1. Describe the blockage, not the module.
2. Adapt before executing.
3. Plan from explicit deliverables and constraints.
4. Inspect data before analysing.
5. Reason before revealing answers.
6. Done is not the same as proven.
7. Evidence added is not the same as verified.
8. A polished output can still be wrong.
9. Do not hide uncertainty behind a fake score.
10. Keep raw files/data local and transient where possible.
11. Make the learner more independent over time.

## Next planned module

### V1.0 — Optional AI reasoning layer
Use AI for ambiguous/unusual briefs and semantic interpretation while retaining deterministic routing, state, evidence, validation and privacy-oriented fallbacks.

Portfolio mode remains later, after real GA projects exist.

## Current limitations

- V0.9 routing is transparent rule/state scoring rather than semantic AI reasoning; ambiguous wording can produce low-confidence routes
- assignment classification is deterministic pattern/rule analysis rather than semantic AI reasoning
- rubric extraction understands visible/simple criteria and weights, not hidden instructor expectations
- Rubric + Evidence does not inspect raw linked evidence file contents
- Submission Gate cannot independently execute SQL, Excel formulas, Python notebooks, Power BI interactions or Tableau workbooks
- Dataset Preflight flags possible issues; it does not prove that an outlier or missing value is wrong
- PDF extraction requires selectable text; scanned PDFs need OCR or pasted text
- PPTX instruction extraction and screenshot OCR are not yet supported

These limitations are intentional: DA.OS should remain transparent about what it knows and what still requires human judgment.