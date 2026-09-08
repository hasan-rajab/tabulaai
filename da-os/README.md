# DA.OS V0.5 — Data Analyst Bootcamp OS

DA.OS is a lightweight personal operating system for an intensive data-analytics bootcamp. It is designed to reduce project friction without turning the bootcamp into answer-copying: plan the work, inspect the data, understand the next step, debug failures systematically, and make instructor feedback compound across future projects.

## V0.5 modules

### 1. Project Workspace
- Project name and deadline
- Tool selection: Excel, SQL, Power BI, Tableau, Python
- Full assignment brief
- Local file metadata list
- Browser-local persistence with `localStorage`
- Export the project state as JSON

### 2. Assignment Deconstructor
- Extracts explicit requirements from the assignment brief
- Detects common data-analytics work from keywords
- Builds a practical task checklist with a reason and action for each step
- Includes final validation and submission checks

### 3. NEXT engine
- Finds the first unfinished project task
- Shows exactly what to do next and why
- Displays upcoming work and total progress
- Surfaces relevant Feedback Memory rules before you continue
- Links directly to Dataset Preflight, Learning Coach and Error Doctor

### 4. Learning Coach
- Reads the current NEXT task automatically
- Supports Excel, SQL, Python, Power BI and Tableau
- Uses a four-stage hint ladder: reasoning → tool structure → validation → worked pattern
- Keeps worked examples hidden until the final hint
- Saves scratch work and understood/needs-review status locally

### 5. Error Doctor
- Guided debugging for Excel, SQL and Python
- Reveals diagnostic tests one at a time instead of immediately revealing the fix
- Covers common Excel errors, SQL fan-out/grain/syntax issues and Python/pandas runtime patterns
- Stores solved vs needs-review debugging sessions locally

### 6. Mistake + Instructor Feedback Memory
- Captures corrections from an instructor, self-review, peer or reviewer
- Stores the original correction separately from the permanent lesson
- Scopes lessons by tool, category, severity and trigger words
- Matches active rules against future assignment/NEXT context
- Supports Blocker / Warning / Tip levels
- Tracks acknowledgement, search, pause/reactivate and origin project/task

### 7. V0.5 Dataset Preflight
Dataset Preflight is the first module that reads the actual dataset rather than only project metadata.

Supported input:
- CSV
- XLSX
- XLS

What it profiles:
- row and column counts
- duplicate rows
- missing values and missing percentages
- inferred field types: number, text, date, boolean, mixed, empty
- unique counts / cardinality
- numeric min, max, mean, median, quartiles
- IQR-based outlier counts
- date ranges
- most common values
- likely identifier, measure, time-dimension, segment/dimension and target/outcome roles

What it flags:
- mixed-type columns
- high or moderate missingness
- duplicate rows
- identifiers with missing values
- suspicious numeric outlier concentrations

What it suggests:
- likely target/outcome fields
- useful segmentation/dimension fields
- ordered first cleaning/validation actions
- a manual validation step before visualization
- preserving the raw source rather than editing it destructively

Dataset Preflight deliberately distinguishes **heuristic suggestions** from facts. A target suggestion is not treated as proof of what the assignment asks; the learner must confirm it against the brief.

For browser responsiveness, DA.OS profiles up to the first 100,000 rows. It labels the result when profiling was truncated.

## V0.5 flow

```text
Assignment brief
      ↓
Project plan / NEXT
      ↓
CSV or XLSX
      ↓
Dataset Preflight
      ↓
Types + missing + duplicates + ranges + outliers
      ↓
Likely target / dimensions
      ↓
Recommended first actions
      ↓
Learning Coach / analysis
      ↓
Error Doctor when something breaks
      ↓
Feedback Memory after review
```

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
/index.html      Project Workspace + Deconstructor + NEXT
/preflight.html  Dataset Preflight
/coach.html      Learning Coach
/doctor.html     Error Doctor
/memory.html     Mistake + Instructor Feedback Memory
```

## Privacy

DA.OS remains local-first.

- Project text and project metadata are stored in browser `localStorage`.
- Learning, debugging and feedback-memory records are stored in browser `localStorage`.
- Dataset Preflight reads the selected file in the browser.
- The **raw dataset is not stored in localStorage and is not uploaded by DA.OS**.
- Only the generated profile summary is persisted locally so the learner can reopen the results without retaining raw rows.

For Excel files, V0.5 loads SheetJS from a pinned public CDN build. Workbook bytes are still parsed locally in the browser. CSV parsing does not require the external library.

Storage keys:
- `daos-v0.1-state` — project state, retained for backward compatibility
- `daos-v0.2-coach` — Learning Coach
- `daos-v0.3-doctor` — Error Doctor
- `daos-v0.4-feedback-memory` — personal feedback rules
- `daos-v0.5-preflight` — dataset profile summary only

## Design principles

1. **Plan before executing.**
2. **Inspect before analysing.**
3. **Reason before revealing.**
4. **Verify rather than merely removing errors.**
5. **Preserve learning and instructor feedback.**
6. **No fake certainty.** Heuristics are labelled as heuristics.
7. **Keep raw data local and transient.**
8. **Make the learner more independent over time.**

## Roadmap

- V0.6: Portfolio Mode for completed bootcamp projects
- Later: optional LLM-backed assignment parsing/coaching/debugging/feedback extraction
- Later: deeper statistical preflight, relationship checks and project-level evidence validation based on actual GA coursework

## Current limitations

- Assignment Deconstructor is deterministic and keyword-driven.
- Learning Coach uses a curated local lesson library.
- Error Doctor cannot execute the learner's real Excel/SQL/Python runtime.
- Feedback Memory uses transparent trigger matching rather than semantic embeddings.
- Dataset Preflight does not infer business meaning and cannot determine whether a field is the *correct* target from data alone.
- IQR outliers are prompts to inspect values, not automatic evidence that records are wrong.
- XLS/XLSX parsing requires the SheetJS CDN script to load; CSV remains available without it.

These limitations are intentional: DA.OS should be bootcamp-ready, understandable and useful before adding opaque automation.
