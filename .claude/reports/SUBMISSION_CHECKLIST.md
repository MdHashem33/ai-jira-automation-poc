# Submission Checklist — Fluent Agentic Games

How each artifact in this repo maps to the Fluent portal
(`fluent-ai-fellows-portal.sage-franch.workers.dev`).

Source: Agentic Games Kickoff deck.

## Portal areas (from the "USE THE PORTAL" slide)

| Portal area | What it's for | What to submit |
|---|---|---|
| **Sprint Tracker** | Weekly momentum updates | Paste the `weekly/YYYY-MM-DD-week-N.md` report, verbatim, every week. Minimum one per week. |
| **Submission Vault** | Final + milestone deliverables | At the end of the sprint: link to the GitHub repo (or ZIP), plus the Verified Recipe, plus the demo video. |
| **Knowledge Base** | Verified Recipes that other teams can reuse | Publish the final Verified Recipe here. Target: "Building a PII-safe, model-agnostic support dispatcher in Next.js". |
| **Leaderboard** | Rankings | Read-only; populated from your submissions + metrics. |
| **Dashboard — Recipes Submitted** | Your recipe count | Increments when a Verified Recipe is accepted. |
| **Dashboard — Hours Saved** | Your cumulative ROI claim | Report weekly with math. Judges validate. |
| **Dashboard — Mentees Helped** | Community contribution | Optional — help other teams in Teams channel. |
| **Dashboard — Demo Drops** | Short demo videos | 2–5 min screen recording of the pipeline in action, ideally after each major milestone. |

## Weekly cadence (the "Momentum" score — 30 pts bucket)

Every week, in order:

1. **Do the week's work** (see current weekly report's "Next week commitment" list).
2. **Run verification** (see below).
3. **Update metrics** in the weekly report — real numbers, not guesses. "Not yet measured" is acceptable.
4. **Paste the weekly report** into **Sprint Tracker** in the portal.
5. **Add an entry** to `.claude/reports/_registry.md` for each artifact shipped.
6. **(Optional)** Record a 2-min Demo Drop if the week produced something visible.
7. **(Optional)** Show up to Wed / Fri office hours with the week's open questions.

## Final-submission deliverable (end of sprint)

Goes into **Submission Vault** + **Knowledge Base**:

- [ ] **Verified Recipe** — the reusable how-to guide for other teams. Structure suggestion: Problem → Architecture → Key decisions → Code links → ROI measured → Limits & next steps.
- [ ] **Link to repo / ZIP** with the POC at its final state.
- [ ] **Demo video** (5–10 min) showing:
  - The chatbot-vs-agentic pivot (before/after)
  - Live demo of a password-reset auto-resolution and a Jira escalation
  - Dashboard metrics (resolution rate, hours saved)
  - The eval harness running (confusion matrix)
- [ ] **Metrics snapshot** — final values on all 8 metrics from the deck ("Metrics That Matter" slide).
- [ ] **Hours saved math** — the 40-pt ROI lever. Show the calculation.
- [ ] **One-page executive summary** — what was built, what was learned, what's next. Pin in the repo as `SUBMISSION.md`.

## Verification before every weekly submission

Run each of these and confirm output makes sense before pasting the report.

### 1. Typecheck
```bash
npx tsc --noEmit
```
Expected: no output.

### 2. Dispatcher + redact smoke test
```bash
npm run dev
# then in another terminal:
curl -s http://localhost:3000/api/dev/smoke | jq
```
Expected: JSON with 6 results, each showing category, confidence, PII summary. Sanity-check that the **obvious** categories are right (e.g. password reset → `account`, GDPR → `compliance`, 500 errors → `technical`).

### 3. Live pipeline (existing)
```bash
# Dashboard at http://localhost:3000
# Click "Email Simulation" tab → run each of the 6 samples
# Confirm ticket is created and classified as before (regression check)
```
Expected: no regression — the dispatcher runs in parallel and does not change the existing pipeline's outcomes this week.

### 4. Eval harness (starting Week 2)
```bash
npm run eval:dispatcher   # script to be added Week 2
```
Expected: confusion matrix printed + report written to `.claude/reports/eval/YYYY-MM-DD-*.md`.
Target for shipping: F1 ≥ 0.80.

## Pre-submission gate (every week)

Before pasting into the portal:

- [ ] `tsc --noEmit` passes
- [ ] Smoke endpoint returns expected categories for the 6 samples
- [ ] Existing `/api/email/simulate` still works (no regression)
- [ ] New files listed in the weekly report's "Artifacts shipped" table actually exist
- [ ] Registry updated with this week's entries
- [ ] Hours-saved math has a source (not made up)
- [ ] No secrets in any file that will be linked (grep `.env*` not in the submission)
- [ ] Submission documents (report PDF, Verified Recipe) read as polished human-authored work — no paste-this instructions, no AI narrator voice

## Anti-patterns to avoid (judges care)

- **Weekly report is late or skipped** — directly costs Momentum points.
- **Metrics are prose, not numbers** — put them in the table.
- **Claims without validation** — "auto-resolves billing" but no eval on billing cases = zero credit.
- **Architecture without ROI** — a sophisticated agent graph that doesn't save hours is a 0/40 on the ROI bucket.
- **Horror-story moments** — prompt injection, invented facts, or contract-making. Judges cited these explicitly.
