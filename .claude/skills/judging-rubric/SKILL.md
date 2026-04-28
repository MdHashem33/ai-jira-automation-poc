---
name: judging-rubric
description: Use when prioritizing what to build or deciding whether a change is worth shipping for the Agentic Games sprint. Maps every decision to the 100-pt rubric + the judges' chatbot-vs-agentic contrast + cited horror stories.
---

# Agentic Games — Judging Rubric

Source: Fluent Agentic Games Kickoff deck (Customer Support sprint, 4 weeks, $15K CAD pool).

## The 100-point rubric

| Category | Pts | What moves the score |
|---|---|---|
| **Operational Impact & ROI** | **40** | Validated ROI (measurable reduction in manual hours) + ≥ 30% automation of a core departmental workflow |
| **Technical Orchestration** | **30** | Sophistication (beyond simple prompts → real agentic orchestration) + Reliability (stable, consistent, accurate output) |
| **Velocity & Contribution** | **30** | Knowledge Sharing (quality of the "Verified Recipe" added to the Fluent Knowledge Base) + Momentum (consistent **weekly** portal updates) |

**Implication:** ROI is the biggest lever (40%). Every feature should be justified in "manual-hours saved" or "tickets deflected" terms in the weekly report. A cool architecture that doesn't reduce manual hours loses to a simple workflow that does.

## Chatbot vs. Agentic AI (the judges' framing)

| Feature | Chatbot (loses) | Agentic AI (wins) |
|---|---|---|
| Decision-making | Rule-based | Autonomous, goal-driven |
| Task complexity | Simple, single-step | Multi-step, complex workflows |
| Tool use | None/limited | APIs, databases, CRM, ticketing |
| Adaptability | Static | Dynamic, context-aware |
| Escalation | Frequent | Minimal, selective |

The POC's current `pipeline.ts` (single-pass classify→RAG→decide) reads as chatbot. To score on Sophistication we must demonstrate:
- Multi-agent orchestration (dispatcher → specialists)
- Tool use against Jira/KB/logs
- Context/memory across interactions
- Proactive flagging (not just reactive)
- Selective, precise escalation

## The 5 capabilities the judges highlighted

The deck explicitly lists these as what agentic AI does and chatbots never can — treat as a **must-demonstrate** checklist for the final submission:

1. **Resolve billing errors end-to-end** — not just classify, but actually call refund/invoice APIs and close the loop.
2. **Proactively flag issues before customers notice** — hook into logs/monitoring, create tickets without a human asking.
3. **Remember context across a full conversation** — thread-aware memory, not single-message pattern-match.
4. **Route with precision based on urgency & history** — use customer/account history, not only current message.
5. **Work alongside human agents in real time** — draft-assist, summarize, surface KB — not just autoreply.

## Horror stories the judges cited — and how we avoid them

| Case | What happened | Our defense |
|---|---|---|
| Air Canada chatbot | Invented a refund policy; company held liable in court | Grounding rule in `customer-support-prompting`: no free-form facts, always cite KB source |
| Chevy of Watsonville | Prompt-injection tricked bot into "legally binding $1 Tahoe" | Input guardrails + hard rule: bot never makes commitments or commits to prices; all offers gated by human review |
| Cursor "Sam" | Bot hallucinated a subscription policy, invented a fake persona | Identity-only system prompt + topic-adherence eval + transparent "AI assistant" labeling |

## Prize + cadence

- 1st $7K / 2nd $5K / 3rd $2K / 2× $500 (CAD)
- **AT LEAST weekly updates** on the Fluent portal (`fluent-ai-fellows-portal.sage-franch.workers.dev`) → see `weekly-reporting` skill
- Optional office hours Wed + Fri
- Final deliverable includes a "Verified Recipe" for the KB

## Before shipping any feature, ask:

- [ ] Does this reduce manual hours? By how much? (ROI — 40 pts)
- [ ] Does it demonstrate at least one of the 5 agentic capabilities above? (Sophistication — 30 pts)
- [ ] Is it reliable — can I show the eval numbers? (Reliability — 30 pts)
- [ ] Which **Phase** of the Fluent 8-phase playbook does this advance? (see `eight-phase-playbook`)
- [ ] Does it move one of the **Support-Lead KPIs**: % Support Handled by AI, Support Cost / Revenues, NPS? (see `valsoft-kpis`)
- [ ] Does it reinforce the **75/25 framing** for deflection targets?
- [ ] Is it protected by the **Dual-Model / Refusal Trigger / RAG** defenses from `hallucination-defense`?
- [ ] Is it documented in the weekly report? (Velocity — 30 pts)
- [ ] Would any of the 3 horror stories apply if this fails? If yes, add the defense.

## Winning differentiators (from `feedback_winning_priorities` memory)

The 100-point rubric rewards the delta between a pipeline that works and a pipeline that looks production-ready. The Week-3+ work that moves the score:

1. **Dual-Model Judge** verifying dispatcher output — scores Sophistication.
2. **Faithfulness ≥ 0.95 and Semantic Entropy ≤ 0.15** in every weekly metrics table — scores Reliability.
3. **75/25 framing** explicitly in every report — scores alignment with the Valsoft agentic-transformation framework.
4. **Phase tags on every artifact** — scores alignment with the Fluent 8-phase playbook.
5. **Self-learning flywheel** (Phase 6) — even a minimal version differentiates from teams stuck at Phase 3.
