# DA.OS V0.6 — Data Analyst Bootcamp OS

DA.OS is a local-first personal operating system for an intensive data-analytics bootcamp. Its goal is not to assume a specific General Assembly assignment in advance. The system should accept the work GA actually gives the learner, turn it into an explicit execution plan, and then route each step through the right learning, data, debugging and feedback tools.

## V0.6 principle

```text
ANY ASSIGNMENT
      ↓
Universal Assignment Adapter
      ↓
Deliverables + constraints + rubric + work type
      ↓
Task graph with evidence + validation criteria
      ↓
NEXT
      ↓
Dataset Preflight / Learning Coach / Error Doctor
      ↓
Feedback Memory
      ↓
Final QA layers (roadmap)
```

The **Universal Assignment Adapter** is now the recommended entry point. The older keyword-based Deconstructor remains available as a quick fallback.

## Modules

### 1. Project Workspace
- Project name and deadline
- Tool selection: Excel, SQL, Power BI, Tableau, Python
- Full assignment brief
- Local file metadata list
- Browser-local persistence with `localStorage`
- Export the project state as JSON
- Direct entry into Universal Assignment Adapter or Dataset Preflight

### 2. V0.6 Universal Assignment Adapter
The adapter is designed to make DA.OS assignment-agnostic.

Input:
- pasted assignment brief
- pasted rubric / grading criteria
- locally extracted PDF
- locally extracted DOCX
- TXT / Markdown
- SQL / Python source files
- Jupyter notebooks (`.ipynb`)
- JSON
- CSV text

The adapter does **not** upload the source file. Supported file text is extracted in the browser. PDF extraction uses a pinned PDF.js CDN build; DOCX extraction uses a pinned Mammoth.js CDN build.

It detects likely assignment types such as:
- data cleaning
- exploratory analysis / EDA
- Excel analysis
- SQL exercise
- Python / pandas
- statistics
- dashboard work
- Power BI
- Tableau
- presentation / deck
- business case / recommendations
- capstone / end-to-end project
- generic analytics fallback

It also:
- detects required tools
- extracts likely deliverables
- extracts explicit limits and constraints
- parses rubric lines and visible percentage/points weights
- detects individual/team work signals
- surfaces ambiguities that should be confirmed before starting
- identifies the first decision that should be made
- builds a task graph appropriate to the detected work

Every generated task contains:
- **title** — the action to complete
- **why** — why it matters analytically
- **action** — what to do
- **category** — Scope / Data / Metric / SQL / Python / Statistics / Analysis / Visualisation / Synthesis / Delivery / QA
- **evidence** — what artifact should prove the step was completed
- **validation** — how the learner should verify the work is correct

Examples of task-specific adaptation:
- SQL assignments get table-grain, join-risk and incremental-query steps.
- Statistics assignments get hypothesis, assumption and interpretation steps.
- Dashboard assignments get audience/KPI design and source-number reconciliation.
- Presentation assignments get story/slide-limit and number-consistency checks.
- Mixed projects can receive several of these workflows together.

#### Commit to DA.OS

**Use this plan in DA.OS** writes the adapter result into the existing project state:
- project name
- brief + rubric
- detected supported tools
- requirements
- task graph
- adapter metadata
- source-file metadata (not the source file contents)

DA.OS then opens the **NEXT** view so all other modules continue from the same assignment plan.

### 3. Quick Deconstructor
The original deterministic keyword-driven deconstructor remains available for short/simple briefs.

For unusual, multi-tool, rubric-heavy or mixed assignments, Universal Assignment Adapter should be preferred.

### 4. NEXT engine
- Finds the first unfinished project task
- Shows exactly what to do next and why
- Displays upcoming work and total progress
- Works with both quick-deconstructor tasks and V0.6 adapter-generated task graphs
- Surfaces relevant Feedback Memory rules before you continue
- Links to Assignment Adapter, Dataset Preflight, Learning Coach and Error Doctor

### 5. Dataset Preflight
Supported input:
- CSV
- XLSX
- XLS

Profiles up to the first 100,000 rows for:
- rows / columns
- duplicate rows
- missing values
- inferred number/text/date/boolean/mixed types
- cardinality
- numeric min/max/mean/median/quartiles
- IQR-based outlier counts
- date ranges
- common values
- likely identifier / measure / time / dimension / target roles

It produces a data-health summary and ordered starting checklist. Raw dataset rows are not stored in localStorage.

### 6. Learning Coach
- Reads the current NEXT task
- Supports Excel, SQL, Python, Power BI and Tableau
- Uses a hint ladder: reasoning → structure → validation → worked pattern
- Keeps examples hidden until later hints
- Saves scratch work and understood/needs-review status locally

### 7. Error Doctor
- Guided Excel / SQL / Python debugging
- Starts from exact error or wrong-result symptoms
- Reveals diagnostic tests before the fix
- Covers common Excel errors, SQL fan-out/grain/syntax issues and pandas/Python runtime patterns
- Stores solved vs needs-review sessions locally

### 8. Mistake + Instructor Feedback Memory
- Saves corrections from instructor, self-review, peer or reviewer
- Separates original correction from permanent lesson
- Supports Blocker / Warning / Tip rules
- Matches rules against future assignment/NEXT context
- Surfaces relevant past feedback inside NEXT
- Tracks acknowledgement and origin project/task

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
/index.html      Workspace + quick Deconstructor + NEXT
/adapter.html    Universal Assignment Adapter
/preflight.html  Dataset Preflight
/coach.html      Learning Coach
/doctor.html     Error Doctor
/memory.html     Mistake + Instructor Feedback Memory
```

## Privacy

DA.OS remains local-first.

- Project/assignment text is stored in browser `localStorage` only when the learner saves/commits it to the DA.OS project.
- Assignment files loaded into Adapter are read locally; source bytes are not uploaded by DA.OS.
- Adapter source-file metadata may be saved with the project, not source contents.
- Dataset Preflight reads selected data locally and does not persist raw rows.
- Learning, debugging and feedback-memory records remain local to the browser.

External browser libraries currently used:
- SheetJS for XLS/XLSX parsing in Dataset Preflight
- PDF.js for PDF assignment-text extraction
- Mammoth.js for DOCX assignment-text extraction

Those libraries are loaded from pinned public CDN URLs; file parsing itself occurs client-side.

Storage keys:
- `daos-v0.1-state` — shared project state, retained for backward compatibility and extended by V0.6 adapter metadata
- `daos-v0.2-coach` — Learning Coach
- `daos-v0.3-doctor` — Error Doctor
- `daos-v0.4-feedback-memory` — personal feedback rules
- `daos-v0.5-preflight` — dataset profile summary only

## Design principles

1. **Adapt before executing.** Do not assume the assignment type.
2. **Plan from explicit deliverables and constraints.**
3. **Inspect data before analysing.**
4. **Reason before revealing answers.**
5. **Keep evidence of completed analytical work.**
6. **Validate outputs rather than merely making code/formulas run.**
7. **Preserve instructor feedback so mistakes do not repeat.**
8. **No fake certainty.** Classification and target suggestions are labelled as heuristic.
9. **Keep raw files/data local and transient where possible.**
10. **Make the learner more independent over time.**

## Roadmap after V0.6

### V0.7 — Rubric + Evidence Engine
The adapter already **plans** evidence. V0.7 will track actual artifacts against requirements/rubric criteria and show which completed tasks still lack proof.

### V0.8 — Submission Gate
Cross-check requirements, data, calculations, visuals, narrative, recommendations and rubric coverage before submission using PASS / WARN / BLOCK states.

### V0.9 — Unified “I’m stuck” Router
One intake that routes the learner to Assignment Adapter, Dataset Preflight, Learning Coach, Error Doctor, Feedback Memory or Submission Gate based on the problem described.

### V1.0 — Optional AI reasoning layer
Use AI for ambiguous/unusual briefs and semantic interpretation while keeping deterministic state, validation, evidence and privacy-oriented fallbacks.

Portfolio mode remains later in the roadmap, after the learner has completed real GA work worth converting into portfolio evidence.

## Current limitations

- V0.6 assignment classification is transparent rule/pattern analysis rather than semantic AI reasoning.
- It can misclassify vague or unusually worded briefs; the inferred type/ambiguities are shown so the learner can review them.
- Rubric parsing recognizes visible text and simple percentage/point patterns but does not yet track live artifact coverage.
- PDF extraction depends on PDFs containing selectable/extractable text; scanned-image PDFs need OCR or manual pasted text.
- DOCX/PDF parsing requires the respective CDN script to load.
- PPTX assignment-text extraction and screenshot OCR are not supported in V0.6; instructions can still be pasted manually.
- Learning Coach uses a curated local lesson library.
- Error Doctor cannot execute the learner's real Excel/SQL/Python runtime.
- Feedback Memory uses transparent trigger matching rather than semantic embeddings.

These limitations are explicit because DA.OS should be dependable and understandable before opaque automation is added.
