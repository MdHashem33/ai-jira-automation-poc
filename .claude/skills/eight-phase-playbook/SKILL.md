---
name: eight-phase-playbook
description: Use when scoping any support-automation work in this project, naming milestones in a weekly report, or choosing what to build next. Anchors the POC to Fluent's official 8-phase agentic support playbook so deliverables are phrased in the judges' own vocabulary.
---

# The 8-Phase Agentic Support Playbook

Source: Fluent Knowledge Base, "AI Playbooks" article. Each phase builds on the previous one; skipping creates expensive gaps. Pace varies by business unit but order does not.

| # | Phase | One-line purpose |
|---|---|---|
| 1 | Establish Baseline & Tooling | Capture before-and-after metrics; pick an MCP-native platform. |
| 2 | Build the Knowledge Base | Centralize and structure every source the AI will draw from. |
| 3 | Deploy Tier 1 AI Support Agent | Auto-resolve or triage every inbound request — no dead ends. |
| 4 | Automated Developer Escalation | Auto-create structured bug reports; AI coding agent opens draft PR. |
| 5 | Proactive Error Detection | Monitor logs; ticket before the customer does. |
| 6 | Documentation Flywheel | Every resolution updates or creates a KB article. |
| 7 | Stakeholder Intelligence Layer | Natural-language queries over live support data via Slack/WhatsApp. |
| 8 | Measure, Iterate, Expand | Track against baseline on the 8 metrics; prove, then expand. |

## Targets baked into the playbook (quote these in reports)

- **Phase 1 deflection target: 60%** of inbound tickets handled without human intervention by end of Phase 1 (tier-1 agent).
- **Phase 3 rollout gate: 85%** accuracy on auto-responses before expanding to additional channels or broader categories. Start on one channel, manually review every AI auto-response for two weeks.
- **Phase 4 rollout gate:** review every auto-created engineering ticket for the first two weeks before trusting the pipeline.
- **Phase 8 KPIs** (the eight metrics): AI Resolution Rate, Repeat Contact Rate, Escalation-to-Fix Time, Proactive Detection Rate, Knowledge Base Growth, Stakeholder Query Adoption, CSAT, Cost Per Ticket.

## Our POC's phase mapping (last updated 2026-05-04, end of Day 2)

- **Phase 1** — covered. 220-case eval, dispatcher F1 0.937, ECE 0.017, cost per ticket on the dashboard. CSAT/repeat-contact-rate proxies still pending and will be filled in Day 4 (Phase 8 KPI suite). Detailed metrics live in `.claude/reports/phase-1-baseline.md`.
- **Phase 2** — covered. 15 KB articles in `fixtures/kb/articles.jsonl`; structured, deduped, keyword-indexed, and now reranked at retrieval time via two-stage retrieval (Day 2).
- **Phase 3** — covered. Dispatcher F1 0.937 (> 85% gate), three live specialists (FAQ, account, billing), four channels (email/voice/screenshot/monitor), every decision logged. Hardened on Day 2 with semantic cache + cross-encoder rerank.
- **Phase 4** — partial. Jira escalation live with full context; AI-coding-agent draft PR scheduled Day 7 (final).
- **Phase 5** — scheduled Day 5 (ticket clustering + outage auto-incident; rolling 5σ alarm).
- **Phase 6** — partial. Resolution log writes already; auto-KB-write-back from successful resolutions scheduled Day 3.
- **Phase 7** — scheduled Day 6 (Slack bot for natural-language queries over `/api/dashboard/stats` + 8 AM digest).
- **Phase 8** — partial. Cost dashboard tile + agent test harness live; full 8-KPI dashboard suite scheduled Day 4.

## How to apply

- When writing a weekly report, tag each shipped artifact with its phase number (e.g. "shipped a Phase-3 dispatcher with 94.2% accuracy on a 120-case eval").
- When choosing what to build next, pick the earliest-numbered phase that is incomplete *unless* a later-phase item can be lit up cheaply on top of existing phase infrastructure.
- Never claim a phase is "done" until its documented exit condition is met (e.g., Phase 3 requires > 85% accuracy sustained across two weeks of manual review, not a single eval result).
- In the Verified Recipe, structure the narrative around phases: "Phase 3 dispatcher in Next.js, with Phase 4 Jira escalation already in flight — here's the pattern."

## Anti-patterns

- Skipping Phase 2 (KB) to rush to Phase 3 (dispatcher). The dispatcher's ceiling is the KB's completeness.
- Deploying Phase 5 (proactive detection) before Phase 4 (dev escalation) is stable — detection without a good escalation pipe is noise.
- Claiming Phase 7 (stakeholder intelligence) before Phase 8 metrics exist — there's nothing for stakeholders to query.
