---
name: model-portfolio
description: Use when choosing which LLM to call for a given task, or when adding a new AI call to the pipeline. Enforces model-agnostic wiring + right-sized model per task.
---

# Model Portfolio & Agnostic Wiring

Sources: team meeting + Anthropic support-chat guide.

## Principles

1. **Model-agnostic interface.** All model calls go through one adapter (`lib/ai/client.ts`) that takes `{task, input}` and picks the model. Never import `openai` or `anthropic` SDK directly from business logic.
2. **Right-size per task.** Don't send FAQ lookups to Opus. Don't send ambiguous multi-step reasoning to Haiku.
3. **No vendor lock-in in prompts.** Write prompts in plain text + XML tags that work across Claude, GPT, and open models.
4. **Reusability is about the process, not just code.** Capture the decision (task → model → prompt → eval) in the registry so switching vendors is mechanical.

## Task → Model Mapping (starting defaults)

| Task | Model tier | Why |
|---|---|---|
| PII/PHI redaction | tiny (regex + small model fallback) | Deterministic, cheap, runs on every request |
| Intent dispatcher | small / nano (Haiku 4.5, gpt-4o-mini, gpt-5.4-mini, or nano-class) | High volume, narrow task, needs speed |
| Categorization / FAQ matching | nano / small | Office hours: Rahul uses a local model here; Oscar uses OpenAI nano |
| Entity extraction | small | Narrow, schema-constrained |
| KB retrieval (RAG) | embeddings (Voyage / OSS) | Not a chat task |
| Judge / Reviewer (dual-model verification) | small (5–10× cheaper than Generator) | See `hallucination-defense` — claim-level verification, not holistic |
| Auto-reply drafting | medium (Sonnet 4.6) | Tone matters, some reasoning |
| Escalation summary for Jira | medium | Structured long-form |
| Complex multi-step reasoning / root-cause | large (Opus 4.7) | Reserved — use sparingly |
| Dev-side code investigation | large (Opus 4.7 / Claude Code) | Deep context |

**Office-hours rule of thumb** (Patrick, 35:18; Oscar, 35:40): if a nano or haiku-class model can handle a task (categorization, FAQ matching, schema extraction), never use Opus for it. Cost and latency compound across a high-traffic support pipeline; judges score on cost per ticket.

## Adapter Shape

```ts
// lib/ai/client.ts
type Task = "dispatch" | "extract" | "redact" | "draft_reply" | "summarize" | "reason";
export async function callModel(task: Task, input: string, opts?: {...}) {
  const { model, provider, params } = routeForTask(task);
  // provider-specific call hidden here
}
```

Swap provider by editing `routeForTask`, not business code.

## Escalation Path (when a small model isn't enough)

1. Run small model.
2. If `confidence < threshold` OR schema validation fails → retry with medium.
3. If still failing → human-review queue, don't silently escalate to large model in prod (cost).

## Anti-Patterns

- Hard-coding `openai.chat.completions.create` anywhere outside the adapter.
- Sending every ticket to Opus "to be safe". Cost explodes; latency hurts UX.
- Using one model for everything because it's simpler. It's simpler until it's expensive.
