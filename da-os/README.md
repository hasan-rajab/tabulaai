# DA.OS V0.1 — Data Analyst Bootcamp OS

DA.OS is a lightweight personal operating system for intensive data-analytics bootcamps. The first version is deliberately narrow: it keeps one project organised, turns an assignment brief into an executable checklist, and always shows the next best action.

## V0.1 features

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

V0.1 is fully client-side. Project text and file metadata are stored in the browser's local storage. File contents are **not** uploaded or persisted by the app.

## Design principle

DA.OS should help the learner understand and execute the work — not invisibly do the assignment for them. Future coaching features should therefore explain concepts, guide debugging, and preserve instructor feedback rather than simply returning finished answers.

## Roadmap

- V0.2: Learning Coach for Excel / SQL / Python
- V0.3: Error Doctor with guided debugging
- V0.4: Mistake + instructor-feedback memory
- V0.5: Dataset preflight and field profiling
- V0.6: Portfolio mode for completed bootcamp projects

## Current limitation

The assignment deconstructor in V0.1 is deterministic and keyword-driven. This is intentional: the app works without an API key and can be tested immediately. A later version can add an optional LLM-backed parser while keeping the deterministic workflow as a fallback.
