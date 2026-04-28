---
name: customer-support-prompting
description: Use when writing or reviewing any Claude-powered support-chat prompt (dispatcher, classifier, resolver, auto-reply). Enforces Anthropic's support-chat patterns that reduce hallucinations and increase output consistency.
---

# Customer Support Prompting (Anthropic-grounded)

Source: Anthropic's "Customer support agent" use-case guide.

## Structural Rules

1. **System prompt = identity only.** Name, role, one-sentence mission. Nothing else.
   ```
   You are Eva, a friendly assistant for Acme. Answer questions about
   our insurance products and help customers get quotes.
   ```
2. **Bulk of the prompt goes in the FIRST user turn**, wrapped in XML tags so Claude can reference sections internally:
   - `<static_context>` — company info, product catalog, policies, hours
   - `<examples>` — 4–5 ideal Q/A pairs (few-shot)
   - `<guardrails>` — do's and don'ts
   - `<tools>` — tool-use instructions if any
3. Seed the conversation with an assistant `"Understood"` turn so the real user message is turn 3.

## Grounding Rules (hallucination control)

- Every factual answer must either cite a `<static_context>` section or call a tool. No free-form facts.
- If the answer isn't in context → say so and escalate. Never guess product details, prices, SLAs, or legal info.
- For RAG answers, return the source article ID/URL inline (KB-001, link, etc.).
- For tool calls, include the raw tool response as a short quote before paraphrasing.

## The Refusal Trigger

Per Sage Franch's hallucination playbook (see `hallucination-defense`): teach the model to say "I don't know" rather than guess. Three layers:

1. **System-prompt authorization:** explicit permission to refuse — "If the answer is not present in the provided context, respond with: 'I don't have that information. Let me connect you with an agent.' and set `requires_human_review=true`."
2. **Confidence thresholding:** below a set confidence score, auto-demote to escalate instead of answering.
3. **Retrieval-gated generation:** if RAG returns nothing above a minimum relevance score, block generation and show the escalation fallback.

A refusal is only useful if it has an escalation path. Never dead-end the user on "I don't know."

## Consistency Rules

- Pin the persona ("Eva") and refer to it in guardrails: "Always sign as Eva."
- Add negative examples ("Don't mention competitors", "Don't promise SLAs").
- For long sessions, include a short "stay in character" reminder every ~N turns.
- Use the same output schema across tasks (e.g., always return `{intent, priority, confidence, reasoning}` for classification).

## Success Criteria (numeric targets from the guide)

| Metric | Target |
|---|---|
| Query comprehension accuracy | ≥ 95% |
| Response relevance | ≥ 90% |
| Response accuracy (company info) | 100% |
| Topic adherence | ≥ 95% |
| Escalation accuracy | ≥ 95% |
| Deflection rate | 70–80% |
| CSAT | ≥ 4/5 |

Write evals against these before shipping. No eval → no ship.

## Performance Levers

- **Large context** → RAG with embeddings (Voyage), don't stuff everything.
- **Real-time data** (account balance, ticket status) → tool use, not RAG.
- **Perceived latency** → streaming (SSE) from day one.
- **Varied tasks** → separate intent classifier routes to specialized prompts with their own tools and `<static_context>`.

## Checklist before merging any support prompt

- [ ] System prompt is identity-only
- [ ] Context is XML-tagged and in first user turn
- [ ] ≥4 few-shot examples present
- [ ] Guardrails include "don't make promises", "don't mention competitors", "strip PII"
- [ ] No-answer path: "escalate to human"
- [ ] Eval cases cover: on-topic, off-topic, ambiguous, hostile, PII leak attempt, jailbreak
- [ ] PII-stripping on inputs AND outputs
