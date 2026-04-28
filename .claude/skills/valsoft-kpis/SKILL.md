---
name: valsoft-kpis
description: Use whenever writing a weekly report, the Verified Recipe, or any company-facing summary. Enforces Valsoft's agentic-transformation KPI framework — Support Lead role and its three KPIs — and the 75/25 rule as the framing for deflection targets.
---

# Valsoft KPIs — The Agentic Support Lead framing

Source: "The Agentic Transformation" by W. Alame and M. Radovan, Valsoft, February 2026. Three agentic roles across Valsoft portfolios: Support, Services, Product. Our POC is a **Support-lead** deliverable.

## The Support Lead KPIs (report these in every weekly update)

| KPI | What it measures | Framing in our reports |
|---|---|---|
| **% Support Handled by AI** | Share of tickets resolved by agentic systems without human escalation | "X% of tickets resolved by AI, trending upward quarter-over-quarter." |
| **Support Cost / Revenues** | Total support operating costs as a ratio of company revenues | "Reduce support cost as a share of total revenue by Y% through automation." |
| **NPS** | Customer satisfaction with the support experience | "Guardrail — automation must not erode quality of service." |

NPS is the guardrail. Efficiency gains that drop NPS are a net loss.

## The 75/25 rule (use this as the headline target)

From the April 17 office-hours discussion: **75% of customer support requests are repetitive and can be automated; 25% require empathy, judgment, or human intervention.**

- Frame the POC's deflection goal explicitly as "75% target, currently at X%".
- Do not claim a deflection rate above 75% without flagging it as an outlier worth validating.
- The 25% human-retained slice is not a failure mode — it is the design.

## Human / agent role split (must appear in the Verified Recipe)

| Humans focus on | Agents focus on |
|---|---|
| Complex cases requiring judgment and investigation | First-line support across all channels |
| Industry-specific advisory guidance | Knowledge retrieval and article matching |
| Escalations requiring cross-functional coordination | Log analysis and diagnostic gathering |
| Enterprise and strategic client relationships | Draft responses for human review |
| Relationship-sensitive, emotionally charged | Root cause hypotheses, churn risk detection |

Before any automation is added, the role split must be explicit. The boundary shifts over time as agents prove reliable; it never starts implicit.

## Integration is everything

"An AI agent is only as capable as the systems it can connect to. If the AI can't access a system, that system doesn't exist in the agent's world."

When evaluating or renewing software contracts the key question is: "How well does this platform support AI-driven automation?" Agentic-Ready (Linear) vs. Limited Support (Monday.com) is the framing.

## The communication layer (include in architecture diagrams)

Two components:
1. **Connectors** — into every working system the AI needs to reach.
2. **Feedback loop** — back to humans. The AI needs a way to reach out when it encounters something ambiguous, needs approval, or wants to flag a decision before acting.

A pipeline without a feedback loop is a chatbot. A pipeline with a feedback loop is agentic.

## How to apply

- **Every weekly report's metrics table** includes % Support Handled by AI, Support Cost / Revenues, NPS — even when the numbers are "not yet measured." The table structure signals alignment with the judges' framework.
- **The Verified Recipe** opens with the human/agent role split and the 75/25 target. These frames are non-negotiable.
- **When choosing a new tool** for the POC, ask first whether it is agentic-ready. A platform that cannot be driven by an AI agent is a Monday.com-class dead end for this sprint.

## Anti-patterns

- Reporting the POC's deflection rate without a stated target. 75% is the target.
- Dropping NPS from the metrics table because we don't have a number yet. Leave it in and mark "not yet measured" — the judges read the table structure.
- Presenting an architecture diagram without the communication layer (connectors + feedback loop). Missing either half reads as a chatbot architecture.
