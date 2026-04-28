---
name: weekly-reporting
description: Use at the end of each working week (or when the user asks for a status update). Produces the weekly report that gets posted to the Fluent Agentic Games portal — optimized for the "Momentum" and "Knowledge Sharing" judging criteria.
---

# Weekly Reporting

The Agentic Games reward **Momentum** and **Knowledge Sharing** — these are 30 of the 100 judging points. A week without a posted update is a week of lost points.

## Cadence

- Minimum one update per calendar week (a missed week triggers the portal's "Week N Update Required" block and locks the team out of the leaderboard — see `project_portal_state` memory).
- **Mid-week short updates are a scoring differentiator.** Tracy Harrison's daily updates were called out by Sage Franch as exemplary for clarity-of-thought. Aim for at least one short interim update between the formal Monday/Friday reports.
- File lives at `.claude/reports/weekly/YYYY-MM-DD-week-N.md`.
- Content gets pasted into the Fluent portal → Sprint Tracker / Submission Vault.

## Before writing the next week's report

1. Open the portal. Check the **sprint leaderboard** to see current standing.
2. Open **"My Submissions"** (left sidebar). Read any admin feedback left by Sage or other reviewers on the prior week.
3. If feedback is present, the current-week plan must address it before doing anything else.
4. Check the weekly shoutouts chat message for competitor signals — any new capability a competing team shipped becomes a benchmark for our next submission (see `project_competitor_signals` memory).

## What a strong weekly report contains

Use `.claude/reports/weekly/TEMPLATE.md` as the scaffold. Every report must include:

1. **One-paragraph headline** — what changed this week and why it matters.
2. **Hours saved estimate** — even rough. This is the 40-pt ROI lever. Show the math.
3. **Agentic capabilities demonstrated** — tick which of the 5 (end-to-end resolution, proactive detection, memory, precision routing, human collaboration) this week's work advances.
4. **Metrics diff** — baseline vs. current on the 8 metrics the deck listed (AI Resolution Rate, Repeat Contact Rate, Escalation-to-Fix Time, Proactive Detection Rate, KB Growth, Stakeholder Query Adoption, CSAT, Cost Per Ticket). Also report the Support-Lead KPI trio from `valsoft-kpis` (% Support Handled by AI, Support Cost / Revenues, NPS) and the reliability metrics from `hallucination-defense` (Faithfulness ≥ 0.95, Semantic Entropy ≤ 0.15). Missing data is fine — write "not yet measured" rather than making it up.
5. **Phase marker** — tag each shipped artifact with its phase number from `eight-phase-playbook` (e.g., "Phase-3 dispatcher at F1 0.940"). Signals alignment with the judges' own playbook structure.
6. **75/25 framing** — state the deflection target explicitly: "Target 75% agentic deflection per the office-hours rule; current coverage X%."
7. **Artifacts shipped** — link each new file/feature with file path + registry entry.
8. **Risks / blockers** — what could derail the sprint.
9. **Next week** — 3–5 items, each tied to a rubric category (ROI / Orchestration / Velocity).
10. **Open questions for the mentors** — use office hours productively.

## Tone

- Metrics over narrative. "Dispatcher F1 went from 0 to 0.82 on 120-item eval" beats "built a new agent."
- Honest about what didn't work. Judges see many submissions; calibrated reporting stands out.
- No marketing fluff. The deck's own language is plain and measurable — match it.
- Polished, human-authored style. Do not include meta-instructions ("Paste into portal", "Upload here"), AI-narrator voice, emojis, or skill/tool scaffolding inside the document body. Portal-workflow guidance stays in chat; the document is the deliverable.

## After writing the report

1. Save to `.claude/reports/weekly/YYYY-MM-DD-week-N.md`.
2. Add a one-line entry to `.claude/reports/_registry.md`.
3. Tell the user: "paste this week's report at `<path>`" — don't submit to the portal yourself (the user owns portal interaction).
4. Update `project_poc_state.md` memory if the POC's current-state snapshot changed materially.

## Anti-patterns

- Writing the report before doing the work (speculative).
- Copy-pasting last week's items forward without the diff.
- Burying the ROI number inside prose — put it in the top paragraph.
- Skipping the "next week" commitment — judges look for consistency.
