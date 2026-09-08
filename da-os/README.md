# DA.OS V0.7 — Data Analyst Bootcamp OS

DA.OS is a local-first personal operating system for an intensive data-analytics bootcamp. The goal is to accept whatever assignment the learner is actually given, turn it into an explicit workflow, support the work, and preserve enough evidence to know what is genuinely complete before submission.

## V0.7 flow

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
Submission Gate (V0.8)
```

The recommended entry point is the **Universal Assignment Adapter**. The older keyword-based Deconstructor remains available as a quick fallback.

## Modules

### 1. Project Workspace
- Project name and deadline
- Tool selection: Excel, SQL, Power BI, Tableau, Python
- Full assignment brief
- Local file metadata list
- Browser-local persistence with `localStorage`
- Export project state as JSON

### 2. Universal Assignment Adapter
Input can be:
- pasted assignment brief
- pasted rubric / grading criteria
- locally extracted PDF
- locally extracted DOCX
- TXT / Markdown
- SQL / Python source files
- Jupyter notebooks (`.ipynb`)
- JSON
- CSV text

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

It also extracts likely deliverables, explicit constraints, rubric lines, percentage/point weights, required tools, work-mode signals and ambiguities. It then builds a task graph appropriate to the detected assignment.

Every generated task contains:
- **title**
- **why**
- **action**
- **category**
- **evidence** — what artifact should prove the step was completed
- **validation** — how the learner should verify the work

**Use this plan in DA.OS** writes the result into the shared project state and routes into NEXT.

### 3. Quick Deconstructor
The original deterministic keyword-driven deconstructor remains available for short/simple briefs.

### 4. NEXT engine
- Finds the first unfinished task
- Shows exactly what to do next and why
- Displays upcoming work and progress
- Links to Assignment Adapter, Rubric + Evidence, Dataset Preflight, Learning Coach, Error Doctor and Feedback Memory
- Surfaces relevant Feedback Memory rules before continuing

### 5. Dataset Preflight
Supported input:
- CSV
- XLSX
- XLS

Profiles up to the first 100,000 rows for:
- rows / columns
- duplicates
- missing values
- inferred field types
- cardinality
- numeric ranges and summary statistics
- IQR-based outliers
- date ranges
- common values
- likely identifiers / measures / time / dimensions / targets

Raw dataset rows are not persisted in localStorage.

### 6. Learning Coach
- Reads the current NEXT task
- Supports Excel, SQL, Python, Power BI and Tableau
- Uses reasoning → structure → validation → worked-pattern hints
- Saves scratch work and understood/needs-review state locally

### 7. Error Doctor
- Guided Excel / SQL / Python debugging
- Starts from the exact error or wrong-result symptom
- Reveals diagnostic tests before the fix
- Stores solved vs needs-review debugging patterns locally

### 8. Mistake + Instructor Feedback Memory
- Saves corrections from instructor, self-review, peer or reviewer
- Separates original correction from permanent lesson
- Supports Blocker / Warning / Tip rules
- Matches rules against future assignment/NEXT context
- Tracks acknowledgement and origin project/task

### 9. V0.7 Rubric + Evidence Engine
V0.7 converts the assignment's explicit criteria into a live coverage matrix.

Criteria sources:
- Adapter deliverables
- Adapter constraints
- Adapter rubric lines
- Fallback project requirements when Adapter metadata is unavailable

For each criterion, DA.OS tracks three states:

```text
MISSING
  ↓
EVIDENCE ADDED
  ↓
VERIFIED
```

**Missing** means no evidence is linked.  
**Evidence added** means an artifact/reference exists but has not yet been checked against the criterion.  
**Verified** means the learner explicitly inspected the evidence and confirmed it satisfies the linked criterion(s).

Evidence can represent:
- file / artifact
- calculation / metric
- SQL query
- Python / notebook output
- chart / visual
- dashboard
- slide / presentation
- screenshot
- written explanation
- validation check
- other project proof

Each evidence record can store:
- evidence type
- title
- reference/location (for example `query_03.sql`, `Sheet1!PivotTable2`, dashboard KPI card, slide number)
- optional local file metadata
- notes explaining what the evidence proves
- one or more linked criterion IDs
- verified / needs-verification state

Raw evidence files are **not** stored in localStorage. When a learner selects a local evidence file, V0.7 stores metadata such as filename, size, type and modified timestamp only.

#### Coverage metrics
V0.7 shows:
- total explicit criteria
- criteria with no evidence
- criteria with evidence added but not verified
- verified criteria
- verified criteria coverage percentage
- verified percentage of detected rubric weight when percentage weights are available

These are **evidence-coverage metrics, not grade predictions**.

#### Assignment sync protection
V0.7 stores a deterministic signature of the current assignment criteria. If the assignment/rubric changes after evidence has been recorded, the engine warns that the map is stale. **Sync from assignment** refreshes criteria and removes only obsolete criterion links while retaining evidence records themselves.

#### Task proof plan
The page also exposes the V0.6 task-level **Evidence expected** and **Validation** instructions so a checked NEXT task cannot silently imply that proof exists.

#### Evidence export
The evidence map can be exported as JSON containing:
- project summary
- coverage summary
- criteria + status
- evidence register
- task proof plan

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
/evidence.html   Rubric + Evidence Engine
/preflight.html  Dataset Preflight
/coach.html      Learning Coach
/doctor.html     Error Doctor
/memory.html     Mistake + Instructor Feedback Memory
```

## Privacy

DA.OS remains local-first.

- Project/assignment text is stored in browser `localStorage` only when committed to the DA.OS project.
- Assignment files loaded into Adapter are read locally; source bytes are not uploaded by DA.OS.
- Adapter source-file metadata may be saved with the project, not source contents.
- Dataset Preflight reads selected data locally and does not persist raw rows.
- Rubric + Evidence stores evidence descriptions, references, criterion links and optional file metadata — not raw evidence file bytes.
- Learning, debugging and feedback-memory records remain browser-local.

External browser libraries currently used:
- SheetJS for XLS/XLSX parsing in Dataset Preflight
- PDF.js for PDF assignment-text extraction
- Mammoth.js for DOCX assignment-text extraction

Storage keys:
- `daos-v0.1-state` — shared project state
- `daos-v0.2-coach` — Learning Coach
- `daos-v0.3-doctor` — Error Doctor
- `daos-v0.4-feedback-memory` — personal feedback rules
- `daos-v0.5-preflight` — dataset profile summary only
- `daos-v0.7-evidence` — evidence register, criterion links and assignment signature

## Design principles

1. **Adapt before executing.**
2. **Plan from explicit deliverables and constraints.**
3. **Inspect data before analysing.**
4. **Reason before revealing answers.**
5. **Done is not the same as proven.**
6. **Evidence added is not the same as verified.**
7. **Validate outputs rather than merely making code/formulas run.**
8. **Preserve instructor feedback so mistakes do not repeat.**
9. **No fake certainty or fake grade estimates.**
10. **Keep raw files/data local and transient where possible.**
11. **Make the learner more independent over time.**

## Roadmap after V0.7

### V0.8 — Submission Gate
Cross-check requirements, data, calculations, visuals, narrative, recommendations, feedback rules and evidence coverage using PASS / WARN / BLOCK states before submission.

### V0.9 — Unified “I'm stuck” Router
One intake that routes the learner to Assignment Adapter, Dataset Preflight, Learning Coach, Error Doctor, Feedback Memory, Rubric + Evidence or Submission Gate based on the problem described.

### V1.0 — Optional AI reasoning layer
Use AI for ambiguous/unusual briefs and semantic interpretation while keeping deterministic state, validation, evidence and privacy-oriented fallbacks.

Portfolio mode remains later, after real GA projects exist.

## Current limitations

- Assignment classification is transparent pattern/rule analysis rather than semantic AI reasoning.
- Rubric parsing recognizes visible text and simple percentage/point patterns.
- V0.7 does not inspect the contents of linked evidence files; verification is an explicit learner action.
- A verified evidence item linked to multiple criteria assumes the learner checked it against all selected criteria.
- V0.7 does not predict marks or instructor judgment.
- PDF extraction requires selectable/extractable text; scanned-image PDFs need OCR or pasted text.
- PPTX assignment-text extraction and screenshot OCR are not yet supported.
- Learning Coach uses a curated local lesson library.
- Error Doctor cannot execute the learner's real Excel/SQL/Python runtime.
- Feedback Memory uses transparent trigger matching rather than semantic embeddings.

These limitations are intentional: DA.OS should remain understandable, auditable and useful before opaque automation is added.