---
name: end-of-week-submission
description: Use at the end of every sprint week (or when the user says "submit this week", "do the weekly submission", "end-of-week checklist"). Runs the full test → verify → record → submit cadence for the Fluent Agentic Games portal. Covers both the formal Sprint Tracker update and the interim "Submit an Update" box.
---

# End-of-Week Submission

The Agentic Games rubric awards 30 of 100 points for **Momentum** and **Knowledge Sharing**. A skipped or half-done weekly submission directly costs points. Invoke this skill at the end of every sprint week.

## Cadence (do in order)

### 1. Confirm what week we're actually submitting for

The portal's week numbering may not match the local file name.

- Check the Sprint Tracker header badge — it shows `Week N of 4 (X days left)`.
- The **next** submission button label (e.g., "Submit Week 3 Update") is the week to target.
- If the local report file name disagrees (e.g., `week-1.md` but portal asks for Week 3), rename the file to match the portal label OR note in the narrative that this is a catch-up submission.
- Check the **leaderboard** for our current standing, and the **"My Submissions"** tab for any admin feedback on the prior week. Address feedback in the current submission's narrative.

### 2. Write the weekly report (delegate to `weekly-reporting` skill)

Follow the template at `.claude/reports/weekly/TEMPLATE.md`. Save to `.claude/reports/weekly/YYYY-MM-DD-week-N.md`. Must include: headline, hours-saved math, agentic capabilities ticked, metrics diff, artifacts shipped, risks, next-week commitment, open questions. See `weekly-reporting` skill for structure.

### 3. Verification (gate — do not submit if any fails)

Run from the repo root:

```bash
# 3a. Typecheck
npx tsc --noEmit
# Expected: no output
```

```bash
# 3b. Start dev server (pick the port it reports — Next.js falls back to 3001 if 3000 is busy)
npm run dev
```

```bash
# 3c. Smoke test — dispatcher + redact on 6 mock samples
curl -s http://localhost:PORT/api/dev/smoke | jq '{environment, total_samples, results: [.results[] | {id, category: .dispatcher.category, confidence: .dispatcher.confidence, pii: .redact.pii_summary}]}'
# Expected: 6 results, categories sensible, PII flagged where present
```

```bash
# 3d. Regression — existing pipeline still processes
curl -s -X POST http://localhost:PORT/api/email/simulate -H 'Content-Type: application/json' -d '{"sampleIndex":1}' | jq '.ticket | {id, status, jiraKey}'
# Expected: ticket created (status resolved_auto or escalated_jira)
```

```bash
# 3e. Stats moved
curl -s http://localhost:PORT/api/dashboard/stats | jq '{totalProcessed, autoResolveRate}'
# Expected: totalProcessed >= 1 after 3d
```

```bash
# 3f. Secrets not tracked
git ls-files | grep -E '\.env' || echo OK
# Expected: only .env.example (or nothing)
```

If the report lists a new artifact, confirm its file path exists.

### 4. Record the demo (Playwright)

```bash
# Dev server must be running and stats fresh (restart it to reset the in-memory store to 0)
DEMO_BASE_URL=http://localhost:PORT node scripts/demo-record.mjs
```

The script lives at `scripts/demo-record.mjs`. It writes the video to `demo-video/*.webm` and a sanity-check screenshot to `demo-video/dashboard-after.png`.

Verify the screenshot shows non-zero `Total Processed` before uploading — if it's still zero, the UI didn't update in time and you need to re-record (most common cause: simulations fired but dev server's hot-reload reset the store between runs; restart dev server, re-record end to end).

Copy to Downloads for easy portal upload:

```bash
cp demo-video/*.webm ~/Downloads/YYYY-MM-DD-week-N-demo.webm
```

### 5. Submit to the portal

Portal: `fluent-ai-fellows-portal.sage-franch.workers.dev`

Two submission boxes — don't confuse them:

**A. Sprint Tracker → Submit Week N Update** (the judged submission)
- Narrative field: a dense paragraph with hours saved, what shipped, what's next, blockers, and any mentor question. Metrics over narrative.
- Attach: the full `.claude/reports/weekly/YYYY-MM-DD-week-N.md` file (copy to `~/Downloads/` first).

**B. Submit an Update** (interim company-dashboard card, same page)
- Shorter, company-facing: hours saved, workflows impacted, teams affected. Less competition jargon.
- Attachment optional — the full report is fine but not required.

**C. Dashboard → Demo Drops** (optional but scores Momentum)
- Upload `~/Downloads/YYYY-MM-DD-week-N-demo.webm`.
- Caption: one sentence with the week's ROI number or capability shipped.

**D. Dashboard → Hours Saved**
- Log the week's claim with the math from the report.

**E. New Submission → Agentic Recipe** (Verified Recipe form — cumulative, scores Knowledge Sharing)
The portal's New Submission form has a dropdown set to "Agentic Recipe" and these fields:
- **Agentic Recipe Title** — short, descriptive name of the pattern (not the project).
- **Problem Statement** — the concrete pain the recipe solves; reference the horror stories where appropriate.
- **Solution & Approach** — the architecture in 1–2 paragraphs: dispatcher → judge → specialists → refusal trigger → multi-channel.
- **Hours Saved (Monthly)** — single number. Use the same math as the weekly report (`tickets per week × time-per-ticket × 4.33 weeks/month`).
- **ROI Details** — dollar value per year + the math (hours × loaded rate × 12), and the LLM cost contrast.
- **Category** — usually "Customer Support" for this project.

Always include this form in the end-of-week handoff. Pull the field content directly from `.claude/reports/recipe/recipe.md` so the recipe submission stays in sync with the recipe document.

**F. New Submission → Demo Drop** (structured form — submitted weekly)
The portal's New Submission form also has a "Demo Drop" type with these fields:
- **Demo Drop Title** — specific, action-oriented (not "Demo" — generic titles get rejected; one such submission was rejected on 2026-04-20).
- **Problem Statement** — the failure mode the demo proves we have addressed.
- **Solution & Approach** — what was on screen and the key takeaways.
- **Category** — usually "Customer Support".
- File upload (if present in the UI) for the .mp4.

Pull Demo Drop field content from the week's recording shot list, not the recipe. Demo Drops are submitted **every week** because each week's demo shows new capability.

### 6. Registry + memory

```bash
# Add a one-line entry to the artifact registry
echo "- [YYYY-MM-DD Week N] weekly/YYYY-MM-DD-week-N.md + demo" >> .claude/reports/_registry.md
```

Update `project_poc_state.md` memory ONLY if the POC's current state snapshot changed materially (new stack component, new architectural split, measured metric vs. target).

## Pre-submission gate (must all be true)

- [ ] Typecheck passes
- [ ] Smoke endpoint returns expected categories
- [ ] Regression sim creates a ticket
- [ ] Stats non-zero after sim
- [ ] Artifacts listed in report actually exist
- [ ] No `.env*` secrets tracked
- [ ] Demo video recorded with visible dashboard delta (screenshot confirms non-zero)
- [ ] Report narrative has a number in the first paragraph (hours saved or F1 or % automated)
- [ ] Week-N naming in file matches portal's Week-N expectation
- [ ] Report + Verified Recipe read as polished human-authored deliverables — no "paste this into X", no AI narrator voice, no tool-specific scaffolding inside the document itself

## Anti-patterns

- Submitting before running the verification block. One broken artifact path in the report destroys credibility.
- Recording the demo against a polluted store (tickets from prior runs inflate the baseline). Always restart the dev server before recording.
- Pasting prose without numbers. Judges scan for figures first.
- Forgetting the Demo Drop — free Momentum points.
- Writing a different narrative for the two portal boxes without reading both prompts. The Sprint Tracker box is for judges; the "Submit an Update" box is for internal company visibility.

## Hand-off at the end

Tell the user, with file paths:
1. Weekly report file path (in repo + copied to `~/Downloads/`)
2. Demo video path (`~/Downloads/YYYY-MM-DD-week-N-demo.webm`)
3. Two narrative strings (long = Sprint Tracker, short = Submit an Update)
4. The exact portal areas to paste into

Never submit to the portal yourself — the user owns portal interaction.
