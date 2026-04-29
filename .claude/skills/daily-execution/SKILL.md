---
name: daily-execution
description: Use when the user says "Day N", "start Day N", "do today's day", or any phrasing that asks for a daily sprint-plan execution. Runs the full daily ritual end-to-end on the day specified by the 10-day plan, integrates any pasted materials (office hours, mentor notes, portal feedback, competitor shoutouts) into memory + skills + that day's tasks, and outputs a day-end summary with submission-ready text.
---

# Daily Execution Loop (10-day final-stretch plan)

The full 10-day plan lives at `.claude/reports/sprint-plan-final-10-days.md`. Read it before executing — it is the authoritative day-by-day schedule.

## Trigger

When the user says any of:
- "start Day N" or "Day N"
- "do today" / "do today's tasks"
- "execute Day N"
- "run the day"

…begin the daily ritual immediately, end-to-end. No per-step approvals.

## If the user pastes materials with the trigger

The user may attach new office hours, portal messages, mentor notes, competitor shoutouts, or other context. Treat these as inputs to *this* day's work:

1. Read the materials in full.
2. Extract the new insights that affect the project: rules, deadlines, exemplars, capabilities, judging signals, framing.
3. Update memory or skills if the insights are durable (will matter beyond this day). Use the existing memory schema; add to `MEMORY.md` index.
4. Adjust this day's tasks if a new feature suggestion or risk emerged. Skipping or reordering planned features is acceptable when the materials demand it; document the deviation in the day's recipe so the audit trail is intact.
5. Then run the standard daily ritual.

## Daily ritual (run for every day in the plan)

Each step has a target time-box; surface to the user only at step 8 (the day-end summary), unless a judgment call arises.

1. **Portal scan (15 min).** Open `https://fluent-ai-fellows-portal.sage-franch.workers.dev`. Check My Submissions for admin feedback on prior submissions; check the leaderboard for current standing; read any new shoutouts or chat from Sage.
2. **Build (3–5 hours).** Ship the day's primary feature per the plan file. Commit at least once with a clear message (`feat(scope): description` format).
3. **Evaluate (30 min).** Run `npm run eval:dispatcher` and `npm run test:agents`. Confirm metrics did not regress: macro F1 ≥ 0.95 and per-case consistency ≥ 70%. If a regression appears, fix before moving on.
4. **Recipe (45 min).** Write the day's Verified Recipe under `.claude/reports/recipe/recipe-<feature>.md`. Include problem, solution, code excerpt, ROI math, adoption checklist for other Valsoft units. Recipes follow the no-AI-narrator-voice rule.
5. **Demo capture (10 min).** Capture a 20-second screen recording or curl-output snippet that proves the feature works end-to-end on the live URL. Save to `demo-video/`.
6. **Submit (10 min).** Convert the recipe to PDF via `node scripts/convert-submission.mjs`. Provide the user with: (a) the day's 2-line Submit-an-Update text, (b) the Agentic Recipe form field copy (Title, Problem Statement, Solution & Approach, Hours/month, ROI Details, Category), (c) the Demo Drop form field copy, (d) any file paths in `~/Downloads/`. The user owns portal interaction.
7. **Push (5 min).** `git add` specific files (no `git add -A`); commit; `git push origin main`. Vercel auto-deploys. Smoke-test the live URL once redeployed: `curl /api/dev/smoke` should still return `source: "model"` rows.
8. **Day-end summary to user.** A single message with: what shipped (1-2 lines), key metrics (macro F1, ECE, cost per ticket, any new metric), the submission-ready text from step 6, and what tomorrow's plan calls for so the user can verify alignment.
9. **Memory note (5 min, only if applicable).** If the day produced a learning that future-me must not relearn (a new constraint, a new exemplar from the competition, a vendor quirk), save it as a memory file under `~/.claude/projects/.../memory/`.

## What counts as a judgment call worth surfacing mid-day

Stop and ask the user before continuing when:
- A planned feature can't ship as scoped and a substitute is needed.
- An eval regression cannot be reproduced or fixed in <30 min.
- A vendor (Anthropic, Azure, Vercel) returns an error that requires the user's account-level action.
- A scope decision shifts the plan by more than half a day.
- The portal returns a rejection or admin feedback that contradicts the plan.

Otherwise: keep moving. The user does not want a step-by-step running commentary.

## End-of-week (Friday) extension

On Day 2, Day 9, and any day that lands on a Friday: in addition to the daily ritual, also write the week's full report and prepare the Sprint Tracker and Submit-an-Update narratives per the `end-of-week-submission` skill. Friday's day-end summary includes the weekly submission package.

## Daily 2-line update template

For step 6's Submit-an-Update text:

> Day N: [shipped feature, 1 sentence with metric].
> Day N+1: [tomorrow's primary feature, 1 sentence].

Example (Day 1):
> Day 1: prompt caching shipped on Generator + Judge; cost per resolution down from $0.000606 to $0.000180 (70% saving). KB expanded to 15 articles; agent test harness now 12/12 consistent. Day 2: cross-encoder reranking + semantic cache layer.

## Anti-patterns

- Asking the user "should I do step X?" mid-day. The plan is the answer.
- Skipping the recipe because the feature was small. Every shipped feature gets a recipe — the catalog count is the win.
- Pasting full code in the day-end summary. Link to the file.
- Surfacing day-N-1 metrics in day-N summary without the diff. Always show the delta.
- Submitting the same Submit-an-Update text two days in a row. Each day's update must reference what shipped that day.

## End-of-session summary (mandatory at every session close)

Whenever the session is ending — the user pauses, signs off, says "okay", "see you", "goodnight", "tomorrow", or any equivalent, AND any time the day's ritual is complete — emit a structured summary with three sections in this order. Never skip this; the user has explicitly requested it as the standing close-out format.

**Section 1 — What is covered (cumulative).**
Bullet list of every feature that is shipped and live on the deployed URL through this point in the sprint. Reference Verified Recipes by number. Include the current values of: macro F1, ECE, multi-run consistency, cost per resolution, channels live, specialists live, recipes published. Show the delta from the prior session if there is one.

**Section 2 — What is needed (immediate next steps).**
Bullet list of what the user must do before the next session, in priority order. Examples: rotate a token, request a budget approval, add an env var on Vercel, paste a new office-hours transcript, watch a specific portal area. If nothing is needed, state that explicitly.

**Section 3 — All submissions needed.**
Concrete, paste-ready content for every portal form that should be submitted before the next session begins. Cover at minimum:
- Sprint Tracker weekly update (only on Fridays or when a week closes — narrative + attached file path)
- Submit-an-Update interim box (every weekday — 2-line update with the day's metric + tomorrow's plan)
- Agentic Recipe form (any new recipes that day — Title, Problem Statement, Solution & Approach, Hours/month, ROI Details, Category)
- Demo Drop form (when a new demo is recorded — Title, Problem Statement, Solution & Approach, Category + .mp4 path)
- Hours-Saved dashboard tile (when the number changes)

Use the rule from the saved feedback memory: paste-ready text only, no AI-narrator voice, no "paste this into X" preamble inside the document body — those are chat-only instructions to the user.

The session-close summary is always the last message before the user's next turn or sign-off.
