---
name: office-hours-principles
description: Use when making architectural, tooling, or governance decisions in the POC. Distills the April 17 office-hours discussion led by Sage Franch — design-dispatcher-first, MCP + read-only accounts, Reviewer-layer pattern, FAQ specialist first, hybrid local/cloud, model sizing.
---

# Office Hours Principles (April 17, 2026)

Source: 40-minute recorded office hours with Sage Franch and ten other agentic leads. These are not the deck or the playbook articles — they are the live nuance.

## Design the dispatcher first, even if you build specialists in parallel

Sage (13:01): "Start with designing your dispatcher first. If you design your dispatcher and you say, okay, we need an FAQ specialist, we need an account management specialist, then even if you don't build it first, you at least know which specialist agents you need to create, and you can go one by one."

Practical rule: the dispatcher's category list is the spec sheet for the specialists. Don't design specialists before the dispatcher knows what categories it emits. Start with the dispatcher and at least one specialist.

## The FAQ-first specialist strategy

Jordi (14:03): Dispatcher asks "is this an FAQ?" → if yes, AI answers directly via RAG; if no, create a ticket and hand to human. Ship this. It's the simplest thing that gets a real deflection number on the board.

For our POC, the `how_to` category maps 1:1 to FAQ. Week 3 should light up a `how_to` specialist backed by RAG over the 7 KB articles before building any other specialist.

## MCP + read-only service accounts, never direct DB access

Victor (16:20): "Don't open your database or anything like that to AI unless it's a read-only account. If you limit the AI to using tools that are services and then through that limit their account access, it's just like a regular person who you wouldn't want to have access to certain things."

Patrick (20:46): "Build tools. Put in whatever business logic and security you think is required."

Pattern for our POC: when a specialist needs to touch Jira, the KB, or any live system, it goes through an MCP server with a dedicated read-only service account scoped to exactly what the specialist needs. Never a raw SQL connection, never a token with write-anything scope.

## The Reviewer-layer pattern (Sage's RegTech precedent)

Sage (24:33): "We had doers and reviewers. The doers were creative, far-reaching. The reviewers were trained in an entirely different direction — highly risk-averse, detail-oriented, down to grammar and punctuation. The reviewers are able to say 'I've looked at your three to five proposed solutions, here's my critical feedback, go find the missing components.' "

This is the Dual-Model Judge pattern under a different name. For us: wherever dispatcher output or specialist output drives an action with real risk (compliance, legal, billing, human-review), route the draft through a Reviewer agent before acting. Sage's words — use them.

## Hybrid local + cloud models

Boris (29:30): "Cloud model directing traffic and high-reasoning. Offline local model for anything super private you can't send to cloud. The drawback: AI companies subsidize your cloud use, so hosting yourself is more expensive."

Patrick (31:58): "Fine-tuned local models can be faster. Smaller context windows work when the model is fine-tuned for the task."

For our POC today: Azure OpenAI (`gpt-5.4-mini`) is enterprise-controlled and equivalent to "cloud with our own perimeter." We do not need local. If PHI later forces a local path, Ollama + a fine-tuned small model is the playbook.

## Model sizing (don't use Opus for what Haiku can do)

Patrick (35:18): "Always good to decide what size of model you need. You don't want to spend on tokens for the big frontier Opus models when you could do it with Haiku or a llama."

Oscar (35:40): "We use the OpenAI nano models for categorization things — dead cheap, consistent, faster."

Rahul's architecture (from Sage's opening screen share): local models for categorization specifically.

Our route table in `src/lib/ai/client.ts` already routes `dispatch` and `extract` to cheap models and `reason` to the big one. Document this choice in the Verified Recipe — it is the kind of decision judges score.

## Data-retention opt-out

Oscar (33:28): "The AI SDK from Vercel lets you turn off data retention at about 10p per thousand calls. Nothing, for the security payoff."

If we move off Azure OpenAI (enterprise-controlled) to a consumer cloud API for any reason, we turn data retention off explicitly in the request. Document the setting in any deployment guide.

## Portal engagement

Sage (38:40): The portal is hers and evolving. Feature requests turn around fast — submission tracking was added within a day of being requested.

Implication: if the portal is missing something we need (specific Verified Recipe template, separate demo-drop fields per capability, etc.), ask. It is cheap for Sage to add and high-signal for us.

## Self-learning flywheel (Rahul's exemplar)

From Sage's opening showcase: Rahul's architecture extracts resolution patterns from every resolved ticket — root cause, classification reasoning, applied fix, result — categorizes them for embedding, and retrieves them on the next inbound. This is Phase 6 of the playbook (Documentation Flywheel) in action.

For our POC: even a minimal version is worth shipping in Week 3 or 4. After each resolution, the system stores `{category, pattern, resolution_steps, outcome}` for the RAG index. Judges will reward the flywheel.

## When to invoke this skill

- Before adding a new agent or tool, to check the "design first, build specialists one by one" rule and the MCP/read-only access pattern.
- When reviewing a prompt that drives an action, to check whether a Reviewer layer is appropriate.
- When writing the model-choice paragraph of the Verified Recipe.
- When deciding whether to self-host a model (hybrid path) or stay cloud.

## Anti-patterns

- Building a specialist before the dispatcher output shape is stable. The specialist's input is the dispatcher's output.
- Giving the AI a direct SQL connection or a token with more scope than its task requires. Build a tool.
- Using a frontier model for a task a nano/haiku model handles. It shows up in cost per ticket and in judging.
- Ignoring the portal's missing features. Ask for them.
