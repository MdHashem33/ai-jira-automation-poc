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

## Our POC's phase mapping (update as we move)

- **Phase 1** — partial. We have ticket volume, categories via dispatcher, processing time; missing: CSAT, cost per ticket, repeat-contact rate. Fill these gaps as we get real usage data.
- **Phase 2** — partial. 7 KB articles live but hardcoded in TypeScript. Flywheel (Phase 6) blocks on CMS migration.
- **Phase 3** — active. Dispatcher at F1 0.940 (> 85% gate). Shadow-mode today; flip to live routing in Week 3. Legacy decision engine is the fallback during the two-week review window.
- **Phase 4** — partial. Pipeline already auto-escalates to Jira with full context; what's missing is the AI-coding-agent draft PR leg.
- **Phase 5** — not started. Planned Week 4 (monitoring hook → auto-ticket).
- **Phase 6** — not started. Planned once the KB lives in a CMS (Week 3–4).
- **Phase 7** — not started. A Slack/WhatsApp query layer is a high-velocity Week 4 stretch item.
- **Phase 8** — always on. Track the 8 metrics in every weekly report; add faithfulness and semantic entropy as the internal companions.

## How to apply

- When writing a weekly report, tag each shipped artifact with its phase number (e.g. "shipped a Phase-3 dispatcher with 94.2% accuracy on a 120-case eval").
- When choosing what to build next, pick the earliest-numbered phase that is incomplete *unless* a later-phase item can be lit up cheaply on top of existing phase infrastructure.
- Never claim a phase is "done" until its documented exit condition is met (e.g., Phase 3 requires > 85% accuracy sustained across two weeks of manual review, not a single eval result).
- In the Verified Recipe, structure the narrative around phases: "Phase 3 dispatcher in Next.js, with Phase 4 Jira escalation already in flight — here's the pattern."

## Anti-patterns

- Skipping Phase 2 (KB) to rush to Phase 3 (dispatcher). The dispatcher's ceiling is the KB's completeness.
- Deploying Phase 5 (proactive detection) before Phase 4 (dev escalation) is stable — detection without a good escalation pipe is noise.
- Claiming Phase 7 (stakeholder intelligence) before Phase 8 metrics exist — there's nothing for stakeholders to query.
