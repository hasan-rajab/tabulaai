# DA.OS V1.0 — Data Analyst Bootcamp OS

DA.OS is a local-first operating system for intensive data-analytics coursework. Its requirement is simple: **whatever assignment the learner receives, the system should help interpret it, execute it, retain proof, learn from mistakes, and stop avoidable submission errors.**

V1.0 keeps the deterministic V0.9 system intact and adds an **optional semantic AI reasoning layer** at two ambiguity-heavy points: Assignment Adapter review and Unified Router reconsideration.

## V1.0 architecture

```text
                      ┌──────────────────────────────┐
ANY ASSIGNMENT ──────▶│ DETERMINISTIC DA.OS CORE    │
                      │ Adapter / NEXT / Preflight  │
                      │ Coach / Doctor / Evidence   │
                      │ Memory / Submission Gate    │
                      └──────────────┬───────────────┘
                                     │
                          optional semantic review
                                     │
                      ┌──────────────▼───────────────┐
                      │ V1.0 AI REASONING LAYER     │
                      │ suggestions only            │
                      └──────────────┬───────────────┘
                                     │
                      explicit learner review/apply
                                     │
                      ┌──────────────▼───────────────┐
                      │ deterministic state + QA     │
                      └──────────────────────────────┘
```

AI never becomes the authority for rubric coverage, evidence verification, data-quality acceptance, or PASS/WARN/BLOCK status.

## V1.0 optional AI reasoning

### 1. Semantic Assignment Review
After the normal Universal Assignment Adapter builds a deterministic plan, V1.0 can ask an AI model to look for likely omissions that keyword/rule logic may miss.

AI may suggest:
- additional deliverables that appear explicitly implied by the brief
- additional constraints that appear present but were not captured
- ambiguities that should be clarified
- additional workflow tasks
- review-only improvements to existing tasks
- cautions about interpretation

Safe-merge rules:
- AI cannot remove deterministic deliverables, constraints, rubric lines or tasks
- AI cannot invent rubric weights
- AI additions require an explicit **Apply safe additions** action
- task revisions remain review-only and are not silently applied
- applied additions retain AI provenance in the project plan
- the learner must still review the resulting plan before committing it to DA.OS

### 2. Semantic Router Reconsideration
The V0.9 Unified Router still runs first using transparent text and project-state scoring.

After a deterministic route exists, V1.0 can optionally ask AI to reconsider the blockage. The AI must choose only one existing DA.OS route:
- Assignment Adapter
- Dataset Preflight
- NEXT
- Learning Coach
- Error Doctor
- Rubric + Evidence
- Feedback Memory
- Submission Gate

The AI recommendation appears **alongside** the deterministic route. The learner can open either one. AI never silently replaces the deterministic result.

### 3. Secure server-side proxy
The browser never stores an AI provider key.

`server.py`:
- serves the existing static DA.OS files
- exposes `GET /api/health`
- exposes `POST /api/reason`
- reads `AI_GATEWAY_API_KEY` from the server environment
- reads optional `DAOS_AI_MODEL` from the server environment
- sends only the requested reasoning payload to the configured Vercel AI Gateway endpoint
- does not log prompt bodies or keys
- validates that the model returns JSON before passing a result to the browser

Default model configuration in this branch:

```text
openai/gpt-5.6-sol
```

The model can be changed without browser code by setting `DAOS_AI_MODEL`.

### 4. AI settings page
`/ai.html` controls only:
- whether optional AI reasoning is enabled in this browser
- which same-origin/custom reasoning endpoint the browser should call
- connection/health testing

No API-key field exists in the browser UI.

Storage:
- `daos-v1-ai-settings` — enabled flag + endpoint only
- router AI review is stored inside the existing latest route context when used

## Quick start — deterministic only

All non-AI DA.OS features continue to work with a normal static server:

```bash
cd da-os
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000
```

AI reasoning will simply remain unavailable.

## Quick start — V1.0 AI enabled

```bash
cd da-os
export AI_GATEWAY_API_KEY="your_gateway_key"
# optional override:
export DAOS_AI_MODEL="openai/gpt-5.6-sol"
python3 server.py
```

Then:
1. Open `http://127.0.0.1:8000/ai.html`
2. Enable AI reasoning
3. Test the connection
4. Use **Run semantic review** inside Assignment Adapter, or **Ask AI to reconsider** inside the Unified Router

Never commit a real key. `da-os/.env.example` contains placeholders only.

## Main pages

```text
/index.html       Workspace + quick Deconstructor + NEXT
/router.html      Unified “I'm stuck” Router + optional AI reconsideration
/ai.html          V1.0 AI settings / health
/adapter.html     Universal Assignment Adapter + optional semantic review
/evidence.html    Rubric + Evidence Engine
/preflight.html   Dataset Preflight
/coach.html       Learning Coach
/doctor.html      Error Doctor
/memory.html      Feedback Memory
/submission.html  Submission Gate
```

## Existing deterministic modules retained

### Project Workspace + NEXT
Tracks project setup, files/metadata, task progress and the first unfinished action.

### Universal Assignment Adapter
Parses pasted/extracted briefs and rubrics, detects work types/tools, extracts deliverables/constraints/rubric criteria and builds an evidence-aware task graph.

### Dataset Preflight
Profiles CSV/XLS/XLSX data locally for shape, duplicates, missingness, inferred types, cardinality, ranges, summary statistics, outliers, dates and likely analytical roles. Raw rows are not persisted.

### Learning Coach
Supports Excel, SQL, Python, Power BI and Tableau using a reasoning → structure → validation → worked-pattern hint ladder.

### Error Doctor
Guided Excel / SQL / Python debugging that reveals diagnostic tests before the fix and remembers repeated error patterns.

### Feedback Memory
Turns instructor/self/peer corrections into reusable Blocker / Warning / Tip rules.

### Rubric + Evidence Engine
Tracks each explicit criterion through:

```text
MISSING → EVIDENCE ADDED → VERIFIED
```

Coverage is evidence coverage, **not a grade prediction**.

### Submission Gate
Returns **BLOCK / WARN / PASS** from available project state, evidence, Dataset Preflight, Feedback Memory and explicit final manual checks. A PASS is a completeness/QA signal, not a grade guarantee.

### Unified Router
Routes a plain-language blockage to the correct existing DA.OS workflow using transparent text + project-state scoring and shows alternatives when confidence is low.

## Privacy and trust boundaries

DA.OS remains local-first by default.

- project state is browser-local
- raw dataset rows are not persisted by Dataset Preflight
- raw evidence file bytes are not persisted
- assignment source files are parsed locally where supported
- router history stores only typed blockage text + route metadata
- AI is disabled by default
- AI calls occur only after an explicit user action
- AI provider credentials remain server-side
- Assignment semantic review sends the assignment brief/rubric and deterministic plan to the configured reasoning backend when invoked
- Router semantic review sends the blockage text, deterministic route scores and lightweight project-state signals when invoked
- raw dataset rows and evidence-file bytes are not sent by the V1.0 semantic layer

Prompt-injection boundary:
- assignment/rubric text is treated as untrusted data by the server system prompt
- model output must parse as JSON
- client-side safe merge limits what AI output can modify
- deterministic evidence/validation rules are never delegated to AI

## CI

V1.0 adds `.github/workflows/daos-ci.yml`.

For DA.OS changes it:
- compiles `server.py`
- runs `node --check` on every DA.OS JavaScript file
- starts the local server without an AI key
- verifies `/api/health` reports AI disabled rather than failing
- verifies the main DA.OS page is served

## Storage keys

- `daos-v0.1-state` — shared project state
- `daos-v0.2-coach` — Learning Coach
- `daos-v0.3-doctor` — Error Doctor
- `daos-v0.4-feedback-memory` — feedback rules
- `daos-v0.5-preflight` — dataset profile summary only
- `daos-v0.7-evidence` — evidence register + assignment signature
- `daos-v0.8-submission` — manual final checks + last-run timestamp
- `daos-v0.9-router` — recent route history
- `daos-v0.9-route-context` — most recent router handoff (+ optional AI review)
- `daos-v1-ai-settings` — optional AI enabled flag + endpoint

## Design principles

1. Deterministic first; AI only where semantic ambiguity adds value.
2. AI suggests; deterministic checks decide.
3. Adapt before executing.
4. Inspect data before analysing.
5. Reason before revealing answers.
6. Done is not the same as proven.
7. Evidence added is not the same as verified.
8. A polished output can still be wrong.
9. Never hide uncertainty behind a fake grade or confidence score.
10. Keep raw files/data local and transient where possible.
11. Make the learner more independent over time.

## Current limitations

- V1.0 does not provide AI chat everywhere; it intentionally limits AI to assignment semantics and ambiguous routing
- semantic review quality still depends on the configured model
- AI may suggest something that sounds plausible but is not actually required; safe additions must still be checked against the original brief
- AI cannot inspect hidden instructor expectations
- Rubric + Evidence does not inspect raw linked evidence contents
- Submission Gate cannot independently execute SQL, Excel formulas, Python notebooks, Power BI interactions or Tableau workbooks
- Dataset Preflight flags possible issues; it does not prove an outlier/missing value is wrong
- scanned PDFs still require OCR/manual text
- PPTX instruction extraction and screenshot OCR are not yet implemented

These boundaries are deliberate: V1.0 adds semantic intelligence without turning DA.OS into an opaque “ask a chatbot and hope” system.
