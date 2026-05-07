# Final Submission Checklist — Customer Support Agentification

**Author:** Mohamad Hashem (JBL Solutions)
**Final Case form deadline:** Sunday 2026-05-10 at 23:59 ET. Late submissions will not be accepted.
**Sprint week:** Final week (Day 5 of 7 begins Thursday 2026-05-07).
**Live URL:** https://ai-jira-automation-poc.vercel.app/
**Repo:** https://github.com/MdHashem33/ai-jira-automation-poc *(currently PRIVATE — see Action 0 below)*

This file is the single source of truth between now and submission. Work through it top-to-bottom. Tick boxes as you go. Every paste-ready text block lives in `.claude/reports/` already; this checklist tells you when and where to put it.

---

## Action 0 — Critical decision: repo visibility

**Why this is first.** The Final Case Sophistication and Artifacts sections both link to GitHub paths. The repo is currently **private**, so a judge clicking those links sees a 404. You must do exactly one of the following before Sunday:

- [ ] **Option A (recommended):** Make the repo public. Run a secret audit first:
  ```sh
  git log --all --pretty=format: --name-only --diff-filter=A | sort -u | grep -iE "\.env|secret|token|key|credential"
  ```
  Confirm `.env`, `.env.local`, and any `*.pem` are NOT in history. Then on GitHub: Settings → General → Danger Zone → Change visibility → Public.

- [ ] **Option B:** Keep private and attach every linked artifact as a PDF/file upload in the form's Artifacts section. Run `node scripts/convert-submission.mjs` to convert the recipes and article to PDF. Upload all of them.

- [ ] **Option C:** Add the judging team as collaborators (Sage Franch + delegates). Less robust than A or B because it depends on each judge accepting the invite.

**If unsure:** pick Option B today (no risk, fully self-contained submission), and consider Option A on Sunday morning if the audit is clean.

---

## Today — Thursday 2026-05-07

### Step 1 — Submit the weekly update (15 min)

- [ ] Open https://fluent-ai-fellows-portal.sage-franch.workers.dev → Sprint Tracker tab.
- [ ] Paste the **Week 4 weekly text** (block in the chat above this checklist) into Submit-an-Update OR into the weekly Sprint Tracker post field, whichever the portal exposes today.
- [ ] Click submit / save.

### Step 2 — Open the Final Case form and land 3 sections in draft (60 min)

- [ ] Sprint Tracker → Final Case — Customer Support Agentification.
- [ ] Paste the **Executive summary** content (Headline, Win 1, Win 2, Win 3, leave the optional video URL blank for now). Save Draft.
- [ ] Paste the **Validated ROI** content. Append the Week 3 + Week 4 paragraph to whatever Week 1/Week 2 text is already in the field. Add the 8 quantified-outcomes rows (use the form's "Add row" button). Fill Annualized $ and How you calculated it. Tick the stakeholder reviewer box only if a Valsoft validator has reviewed; otherwise leave it for Sunday. Save Draft.
- [ ] Paste the **Roadmap & ask** content (next 90 days plan + what support unlocks the next leap). Save Draft.

### Step 3 — Day 5 build: Phase 5 — Proactive Outage Detection (3–5 hours)

This is the planned Day 5 ship. Tag every artifact with "Phase 5".

- [ ] Build a rolling ticket-cluster detector: HDBSCAN (or a simpler size-windowed cluster count) over the last 24 hours of resolution log embeddings.
- [ ] When a cluster size exceeds 5σ above the rolling baseline, emit an outage alert and auto-create a parent Jira incident that subsequent matching tickets attach to.
- [ ] Wire the alert through `/api/dashboard/kpis` so the Proactive Detection Rate tile starts moving above 0.
- [ ] Run `npm run eval:dispatcher` and `npm run test:agents` to confirm no regression.
- [ ] Write Verified Recipe `recipe-phase5-outage-detection.md` in `.claude/reports/recipe/`. Lead the title with **"Phase 5 — Proactive Outage Detection from Ticket Clusters"**. Same five-section structure as the others.
- [ ] Commit specific files (no `git add -A`). Push. Smoke-test `/api/dev/smoke` once Vercel redeploys.

### Step 4 — End of Thursday self-check

- [ ] Final Case form draft has Executive summary, Validated ROI, and Roadmap saved (3 of 9 sections).
- [ ] 5 Verified Recipes published in repo (PHI, prompt caching, Phase 2 retrieval, Phase 3 cache, Phase 8 KPIs) + Phase 5 if Day-5 build finished today.
- [ ] Eval suites still passing (F1 ≥ 0.80, harness ≥ 70%).

---

## Friday 2026-05-08 (Day 6)

### Step 5 — Day 6 build: Phase 7 — Stakeholder Intelligence Layer (Slack bot) (3–5 hours)

- [ ] `/support` Slack slash command that answers natural-language queries against `/api/dashboard/kpis` (e.g., "How many tickets did we auto-resolve this week?", "What's our cost per ticket?").
- [ ] 8 AM daily digest with: top categories by volume, current AI Resolution Rate, current Cost Per Ticket, any drift alerts.
- [ ] Update the **Stakeholder Query Adoption** tile so it stops showing 0 once a query has been served.
- [ ] Write Verified Recipe `recipe-phase7-stakeholder-slack.md`. Title leads with **"Phase 7 — Stakeholder Intelligence Layer in Slack"**.
- [ ] Run evals. Commit. Push. Smoke.

### Step 6 — Volunteer for Sage's Friday demo slot (10 min, optional but high-value)

- [ ] Message Sage in Teams: "Happy to take one of the Friday demo slots — covering Phase 8 KPI dashboard + Phase 5 outage detection + Phase 7 Slack bot, all live on the deployed URL." Live exposure to judges = score lift.

### Step 7 — Land Final Case sections 3, 4, 5, 6 in draft (90 min)

- [ ] Paste the **Efficiency Gain** content (Workflow before append, Workflow after, 5 time-saved rows, Time regained). Save Draft.
- [ ] Paste the **Sophistication** content (Tooling, Hallucination mitigation, Guardrails, Data protection, Architecture, Links). Save Draft.
- [ ] Paste the **Reliability** content (Fallback, Resiliency, Testing, Thresholds). Save Draft.
- [ ] Paste the **Knowledge Sharing** append paragraph after the existing Week 1–2 draft text. Save Draft.

### Step 8 — Submit weekly report (15 min)

- [ ] Per the `end-of-week-submission` skill: paste a week-closing narrative covering Days 5+6 into the Sprint Tracker weekly box. Mention Phase 5 + Phase 7 are live; Phase 4 lands Saturday; Final Case in flight.

---

## Saturday 2026-05-09 (Day 7)

### Step 9 — Day 7 build: Phase 4 — AI-coding-agent draft PR (3–5 hours)

- [ ] When the dispatcher routes a ticket to `technical` + `escalate`, drive `gh` CLI + Claude Code to open a draft PR in the repo with reproduction steps + a candidate fix.
- [ ] Cite Rahul Ranjan's 2026-05-06 demo in the recipe Further-reading.
- [ ] Recipe `recipe-phase4-ai-coding-pr.md`. Title leads with **"Phase 4 — AI-Assisted Bug Investigation with Draft PRs"**.
- [ ] Run evals. Commit. Push. Smoke.

### Step 10 — Record the master demo video (45 min)

- [ ] 5–7 minute Loom over the live URL covering, in order:
  1. Submit a sample email via the Simulate tab. Show the pipeline: Semantic Cache → Dispatcher → Judge → Specialist → Auto-reply.
  2. Show the Phase 8 KPI panel updating within 15 seconds of resolution.
  3. Submit a near-duplicate of the first ticket — show the "Semantic Cache: HIT" step short-circuiting at $0.000001.
  4. Trigger an outage cluster (Phase 5) and show the auto-incident.
  5. Run a Slack `/support` query (Phase 7) — show natural-language answer over live KPI data.
  6. Show the Phase 4 AI-coding-agent draft PR opened in GitHub from a technical+escalate ticket.
- [ ] Save the Loom URL. Paste into the Executive Summary's Optional video walkthrough field. Save Draft.

### Step 11 — Generate PDF artifacts (15 min)

- [ ] `node scripts/convert-submission.mjs` to convert recipes + article to PDF.
- [ ] Files land in `~/Downloads/`. Move them into the form's Artifacts → File uploads.

### Step 12 — Land Final Case sections 7, 8, 9 (30 min)

- [ ] Paste **Artifacts** links (10 link rows from the chat). Attach the PDFs from Step 11. Attach the Loom URL.
- [ ] Confirm **Roadmap & ask** is still saved from Thursday.
- [ ] Paste **Anything else** content (3 notes for the judges).

---

## Sunday 2026-05-10 — Submit day

### Step 13 — Stakeholder validator walkthrough (30 min)

- [ ] Walk a Valsoft contact (Support Lead or Operations Director at JBL Solutions, or another Valsoft unit) through:
  - The live dashboard showing Phase 8 tiles.
  - The cost-per-ticket line and the projected $312k/yr math.
  - One sample auto-resolve and one Jira escalation in the simulator.
- [ ] Get explicit "I have reviewed these numbers" sign-off.
- [ ] Tick the stakeholder reviewer checkbox in **Validated ROI**. Fill validator name + title.

### Step 14 — Final pre-submit verification (45 min)

- [ ] Open the live URL — `/api/dev/smoke` returns HTTP 200 with `source: "model"` rows.
- [ ] Open `/api/dashboard/kpis` — all 8 tiles return.
- [ ] Click every Sophistication and Artifacts link — each resolves to either a public URL or an attached PDF.
- [ ] Run `npm run eval:dispatcher` and `npm run test:agents` once more. Confirm F1 ≥ 0.80, harness ≥ 70%. Append the result to the Final Case Reliability → Testing field if numbers improved.
- [ ] Re-read the Executive summary. The headline is ≤120 chars. The three wins each name a metric.
- [ ] Re-read the Validated ROI table. Every row has a Source URL that resolves.
- [ ] Re-read Knowledge Sharing. The five named cross-team references (Rahul, Jacob, James Jansma, Jack Taing, Michelle Gagarra) are all there.

### Step 15 — Submit (5 min)

- [ ] Sprint Tracker → Final Case → **Submit for judging**.
- [ ] Take a screenshot of the confirmation. Save to `demo-video/submission-confirmation.png`.

### Step 16 — Post-submit cool-down

- [ ] Post a closing 3-line note to Submit-an-Update: "Final Case submitted. 8 phases mapped, 7 recipes published, live URL stable. Open to questions in Teams."
- [ ] Update memory MEMORY.md with `feedback_submission_complete.md` if anything was learned for next time.

---

## Pre-submit coverage audit (run this before Step 15)

**Form sections (9 total).**

| # | Section | Drafted? | Saved? | Notes |
|---|---|---|---|---|
| 1 | Executive summary | ☐ | ☐ | Headline ≤ 120 chars; 3 wins each name a metric; Loom URL added Saturday |
| 2 | Validated ROI (/20) | ☐ | ☐ | 8 quantified-outcome rows with verifiable Source URLs; stakeholder validator ticked Sunday |
| 3 | Efficiency Gain (/20) | ☐ | ☐ | 5 time-saved rows; Workflow before/after both filled |
| 4 | Sophistication (/15) | ☐ | ☐ | 5 fields + Architecture optional + 8 link rows |
| 5 | Reliability (/15) | ☐ | ☐ | 4 fields, all populated |
| 6 | Knowledge Sharing (/15) | ☐ | ☐ | Existing Week 1-2 text + Week 3-4 append; 5 cross-team citations present |
| 7 | Artifacts | ☐ | ☐ | 10 link rows + Loom URL + PDF uploads |
| 8 | Roadmap & ask | ☐ | ☐ | Days 5–7 + Weeks 5–8 + Weeks 9–13 + Support ask |
| 9 | Anything else | ☐ | ☐ | 3 notes for the judges |

**Scored total: 85.** Target: maximum on every scored section. The unscored sections (1, 8, 9) are framing levers — judges read them first and last.

**Build coverage (Phases 1–8 of the Alame & Radovan playbook).**

| Phase | Status target Sunday | Required for "covered" |
|---|---|---|
| 1 — Baseline & Tooling | ✅ covered | Phase 1 baseline doc present, eval set documented |
| 2 — Knowledge Base | ✅ covered | 15 KB articles + two-stage retrieval recipe |
| 3 — Tier-1 Agent | ✅ covered | Dispatcher F1 0.937, three specialists, four channels |
| 4 — Auto Dev Escalation | 🚧 ship Saturday | AI-coding-agent draft PR demo + recipe |
| 5 — Proactive Detection | 🚧 ship Thursday/Friday | Cluster detector + outage alarm + recipe |
| 6 — Documentation Flywheel | partial OK | Resolution log + cache write-back live; auto-KB-write nice-to-have |
| 7 — Stakeholder Layer | 🚧 ship Friday | Slack bot + recipe |
| 8 — Measure, Iterate | ✅ covered | KPI dashboard live, 8 tiles |

If any of Phases 4/5/7 slip, the recipe still goes in the catalog as "designed, scoped, scheduled post-pilot" — but the demo video must show what is actually live.

**Risks to address.**

- [ ] **Repo privacy** — settle Action 0 on Sunday morning.
- [ ] **Stakeholder validator** — schedule the walkthrough by Friday at the latest so Sunday is buffer.
- [ ] **PHI test flake** — `test-phi-01` failed both runs in Day 4 eval. The behavior (escalating to compliance with `requires_human_review: true`) is the safe failure mode, but the recipe Reliability section should call this out as "known disambiguation, not a hallucination."
- [ ] **Loom recording** — block 45 minutes Saturday for it; do not push to Sunday.
- [ ] **Embedding env on Vercel** — set `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` so the semantic cache + reranker show real activity in the Loom recording. Without it, Phase 3 is graceful-no-op in the demo.

---

## Where every paste-ready block lives

The actual content for every form field is in this conversation's preceding turn (the long message starting "I have a complete picture now..."). For convenience, the canonical sources in the repo:

- Recipes: `.claude/reports/recipe/recipe-*.md`
- Knowledge-sharing article: `.claude/reports/article-knowledge-sharing-may04.md`
- Phase 1 baseline: `.claude/reports/phase-1-baseline.md`
- 8-phase plan: `.claude/reports/sprint-plan-final-10-days.md`
- Eval reports: `.claude/reports/eval/2026-05-06-*.md`

If you need to regenerate any paste-ready block from these source files, the rule is: each form field corresponds to one or more recipes; the answer to "what should I paste?" is "concatenate the matching recipe sections, then trim AI-narrator voice."

---

## One-screen daily summary (print this, tape to monitor)

| Day | Build | Recipe | Form sections to land |
|---|---|---|---|
| **Thu 5/7** | Phase 5 — Outage Detection | Phase 5 recipe | Executive, ROI, Roadmap |
| **Fri 5/8** | Phase 7 — Slack stakeholder bot | Phase 7 recipe | Efficiency, Sophistication, Reliability, Knowledge Sharing + weekly report |
| **Sat 5/9** | Phase 4 — AI-coding draft PR + record Loom + generate PDFs | Phase 4 recipe | Artifacts, Anything else |
| **Sun 5/10** | Validator walkthrough → final pre-flight → SUBMIT before 23:59 ET | — | Tick the stakeholder reviewer box → Submit |

Stay phase-tagged. Keep evals green. Submit Sunday before midnight ET.
