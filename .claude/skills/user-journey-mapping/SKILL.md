---
name: user-journey-mapping
description: Use at the start of any new feature or before adding a new AI agent. Enforces the rule — map the full resolution flow and break it into discrete tasks BEFORE picking models or writing prompts.
---

# User Journey Mapping

Sources: team meeting + Anthropic support-chat guide ("Break the interaction into unique tasks").

## The Rule

Before writing a prompt or choosing a model, produce a **journey map** for the customer request type:

1. Who starts the interaction, through what channel.
2. What the customer says at each step (actual sample wording).
3. What the system must do at each step (retrieve / classify / draft / ask / call tool / escalate).
4. What decision gates exist (auto-resolve? escalate? ask clarifying question?).
5. Where a specialized agent is actually needed vs. a single prompt suffices.

Journey maps live in `.claude/reports/journey/<scenario>.md`.

## Template

```md
# Journey: <scenario name>

## Trigger
Channel: email | chat | phone
Example opener: "…"

## Steps
| # | Actor | Action | Data needed | Decision gate |
|---|---|---|---|---|
| 1 | Customer | Sends email | — | — |
| 2 | System | Parse + redact | raw email | — |
| 3 | Dispatcher | Classify category | cleansed body | conf ≥ 0.80? |
| 4 | Specialist | Resolve or draft | category + KB | KB match ≥ 0.50? |
| 5 | Decision | Auto vs. human | all above | human-review flags? |
| 6 | System | Send reply / create Jira | final output | — |

## Tasks (one per step that needs AI)
- T1: redact PII (small model / regex)
- T3: dispatch (small model)
- T4a: resolve-from-KB (medium)
- T4b: draft Jira ticket (medium)

## Agents needed
- Dispatcher (shared)
- KB-resolver (specialized per category? or one with routing?)
- Jira-writer

## Eval cases
- Happy path
- Ambiguous intent
- PII in body
- Off-topic
- Hostile
```

## Outcome

Only after the journey map is written do you:
- Decide which steps need a specialized agent vs. inline call
- Pick models per task (see `model-portfolio`)
- Write prompts (see `customer-support-prompting`)
- Build the eval set (see `evaluation-driven-dev`)

## Anti-Patterns

- Jumping to "let's add a billing agent" before mapping the billing journey.
- Mapping in your head without writing it down — it decays in a day.
- One giant journey map covering every scenario. One scenario per file.
