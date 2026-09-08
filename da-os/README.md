# DA.OS V0.4 — Data Analyst Bootcamp OS

DA.OS is a lightweight personal operating system for an intensive data-analytics bootcamp. It is designed to reduce project friction without turning the bootcamp into answer-copying: plan the work, understand the next step, debug failures systematically, and make instructor feedback compound across future projects.

## V0.4 modules

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
- Shows exactly what to do next
- Explains why the step matters
- Lets the learner mark it complete and immediately move on
- Displays the next five queued tasks and total progress
- V0.4 also checks relevant Feedback Memory rules and surfaces them directly in NEXT before the task is completed

### 4. Learning Coach
- Reads the current NEXT task automatically
- Supports Excel, SQL, Python, Power BI and Tableau
- Uses a four-stage hint ladder: reasoning → tool structure → validation → worked pattern
- Keeps the worked example hidden until the final hint
- Includes task-aware lessons for common bootcamp analysis work
- Saves a scratchpad for formulas, SQL structure, reasoning and notes
- Uses self-check prompts for business question, grain, numerator/denominator and validation
- Requires a four-part self-check before a concept can be marked understood
- Tracks understood vs needs-review items locally

### 5. Error Doctor
- Guided debugging for Excel, SQL and Python
- Starts from the exact error/symptom and smallest relevant code/formula/query
- Classifies common failure modes using a deterministic local pattern library
- Reveals diagnostic tests one at a time instead of immediately revealing the fix
- Requires at least two diagnostic tests before the fix pattern unlocks
- Teaches the concept behind the error, not just the patch
- Includes a persistent debug-notes area and reflection step
- Stores solved vs needs-review debugging sessions locally
- Builds a lightweight personal debugging memory so repeated errors become recognizable patterns

#### Error Doctor coverage

**Excel**
- `#VALUE!` / type mismatches
- `#N/A` / lookup mismatches
- `#REF!` / broken references
- `#DIV/0!` / denominator problems
- generic formula/result diagnosis

**SQL**
- wrong/inflated totals from join fan-out
- missing/ambiguous columns
- `GROUP BY` / aggregation-grain mismatch
- syntax/parser errors
- generic result/query diagnosis

**Python / pandas**
- `KeyError`
- `TypeError`
- `ValueError`
- `NameError`
- import/environment problems
- generic traceback/state diagnosis

### 6. V0.4 Mistake + Instructor Feedback Memory
- Captures corrections from an instructor, self-review, peer, or reviewer
- Stores the original correction separately from the permanent lesson
- Scopes each lesson by tool, category, severity and trigger words
- Can suggest trigger words from the correction, lesson and current NEXT task
- Matches active personal rules against the current project brief and NEXT task
- Surfaces relevant rules proactively inside the normal NEXT screen
- Supports **Blocker**, **Warning** and **Tip** severity levels
- Tracks when a learner explicitly acknowledges a recurring rule
- Keeps the original project/task where a rule was learned
- Allows rules to be paused/reactivated rather than deleted when a lesson is temporarily irrelevant
- Includes search/filtering over accumulated analytics memory
- Includes three built-in examples for recommendation quality, chart sorting and rate-denominator mistakes

The key V0.4 loop is:

```text
Instructor/self correction
        ↓
Permanent lesson
        ↓
Trigger words + scope
        ↓
Future NEXT task
        ↓
Relevant rule appears
        ↓
Learner acknowledges the check
```

The goal is simple: **do not make the same category of analytical mistake twice.**

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
/index.html    Project Workspace + Deconstructor + NEXT
/coach.html    Learning Coach
/doctor.html   Error Doctor
/memory.html   Mistake + Instructor Feedback Memory
```

## Privacy

V0.4 is fully client-side. Project text, file metadata, coach records, debugging records, and feedback-memory rules are stored in browser `localStorage`. File contents are **not** uploaded or persisted by DA.OS.

Storage keys are intentionally separated:

- `daos-v0.1-state` — project state (retained for backward compatibility)
- `daos-v0.2-coach` — Learning Coach state
- `daos-v0.3-doctor` — Error Doctor state
- `daos-v0.4-feedback-memory` — personal feedback rules and acknowledgement count

## Design principles

DA.OS should make the learner more independent over time.

1. **Plan before executing.** Turn briefs into visible requirements and tasks.
2. **Reason before revealing.** Hints and debugging tests come before worked examples/fixes.
3. **Verify, don't just remove errors.** A query/formula that runs can still be analytically wrong.
4. **Preserve learning.** Scratch work, debugging reflections and instructor corrections become useful memory.
5. **Make feedback compound.** A correction should influence future work instead of disappearing after one assignment.
6. **No fake certainty.** Rule matching is explainable trigger/scope matching; it does not pretend every reminder is universally applicable.
7. **Keep the learner in control.** Feedback rules can be acknowledged, paused, reactivated or deleted.

## Roadmap

- V0.5: Dataset preflight and field profiling
- V0.6: Portfolio mode for completed bootcamp projects
- Later: optional LLM-backed assignment parsing/coaching/debugging/feedback extraction while preserving deterministic fallbacks and the learn-first workflow

## Current limitations

- The Assignment Deconstructor is deterministic and keyword-driven.
- Learning Coach lessons are a curated local library rather than generated dynamically.
- Error Doctor cannot execute the user's actual Excel workbook, SQL database, or Python environment yet.
- Feedback Memory uses transparent trigger-word/scope matching rather than semantic embeddings or an LLM; this makes the matching explainable but can miss paraphrased lessons.
- Feedback rules are browser-local in V0.4 and do not sync across devices.

These limitations are intentional for the bootcamp-ready versions: DA.OS works immediately, requires no API key, keeps data local, and can be improved based on real General Assembly coursework rather than hypothetical requirements.
