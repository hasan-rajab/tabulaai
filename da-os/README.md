# DA.OS V0.2 — Data Analyst Bootcamp OS

DA.OS is a lightweight personal operating system for an intensive data-analytics bootcamp. It keeps each project organised, turns an assignment brief into an executable checklist, always shows the next best action, and now coaches the learner through that action without immediately giving away the answer.

## V0.2 features

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

### 4. Learning Coach
- Reads the current NEXT task automatically
- Supports Excel, SQL, Python, Power BI and Tableau learning paths
- Uses a four-level hint ladder:
  1. reasoning prompt
  2. tool structure
  3. validation approach
  4. worked pattern/example
- Keeps examples hidden until the final hint
- Provides task-aware teaching for:
  - dataset inspection and cleaning
  - success/outcome metrics
  - duration analysis
  - pledge-goal bands
  - category comparisons
  - launch timing
  - SQL work
  - Python work
  - visualisation
  - recommendations
  - QA/submission checks
- Includes a local scratchpad for formulas, SQL structure, reasoning and notes
- Adds prompt chips for business question, numerator/denominator, data grain and validation
- Requires a four-part self-check before a concept can be marked understood
- Tracks `understood` and `needs review` learning states in the browser

## How to use it

1. Open the DA.OS workspace.
2. Create a project or load the Kickstarter sample.
3. Paste the assignment brief and run **Deconstruct assignment**.
4. Open **NEXT** to see the current action.
5. Click **Coach me through this** or open **Learning Coach** from the sidebar.
6. Choose the tool you are using.
7. Attempt the reasoning before revealing hints.
8. Use the scratchpad to work through the step.
9. Complete the self-check and mark the concept as understood, or flag it for review.
10. Return to the project and continue to the next task.

## Quick start

No build step is required.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

You can also open `index.html` directly in a modern browser, although running a local server is more reliable.

## Privacy

V0.2 remains fully client-side. Project text, file metadata, coach scratchpads, hint progress and learning status are stored in the browser's local storage. File contents are **not** uploaded or persisted by the app.

## Design principle

DA.OS should make the learner more capable, not make the learner dependent on the tool.

The Learning Coach therefore follows this sequence:

```text
Think → Hint → Structure → Validate → Example
```

It intentionally avoids opening with a finished formula, query or analysis.

## Current architecture

- `index.html` — Workspace, Assignment Deconstructor and NEXT UI
- `app.js` — project state, deterministic brief parsing, task generation and NEXT logic
- `styles.css` — main DA.OS design system
- `coach.html` — Learning Coach UI
- `coach.js` — task-aware lesson and hint engine
- `coach.css` — coach-specific interface styles

Project state continues to use the original `daos-v0.1-state` local-storage key so existing V0.1 projects remain compatible. Learning records are stored separately under `daos-v0.2-coach`.

## Roadmap

- V0.3: Error Doctor with guided debugging for Excel, SQL and Python
- V0.4: Mistake + instructor-feedback memory
- V0.5: Dataset preflight and field profiling
- V0.6: Portfolio mode for completed bootcamp projects
- Later: optional LLM-backed coaching while preserving the deterministic, no-API fallback

## Current limitation

The V0.2 coach is deterministic rather than conversational AI. This is intentional for the first bootcamp-ready version: it works without an API key, preserves privacy, and gives predictable teaching behavior. The next logical intelligence upgrade is the Error Doctor, where the learner can paste a real error and receive guided diagnostic questions instead of a one-shot fix.
