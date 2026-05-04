# Three patterns that make a support agent feel like infrastructure, not a bot

**Author:** Mohamad Hashem (JBL Solutions)
**Audience:** Other Valsoft business unit leads who want to lift this work into their support stack
**Date:** 2026-05-04
**Maps to:** Fluent's 8-phase Agentic Support Playbook (Alame & Radovan, Feb 2026), specifically Phases 2, 3, and 6

A small team can ship a chatbot in a weekend. Shipping something a support lead trusts on day one is a different problem. Over the last two weeks of the Fluent Agentic Games sprint, we have been figuring out which patterns are load-bearing for that trust, against the backdrop of Fluent's eight-phase Agentic Support Playbook. Three patterns turned out to do most of the work, they each map cleanly onto a phase the playbook treats as load-bearing, and they all cost less than the bot itself. This article walks through each one with code, numbers, and the part that does not show up in the architecture diagram — what it takes to roll the pattern out without breaking the relationship between the support lead and the AI.

## Why the eight phases matter for the way you read this

Alame and Radovan's playbook is sequential on purpose: each phase builds on the one before it, and skipping ahead creates expensive gaps later. The three patterns below are not standalone tricks — they each *finish* the phase the playbook starts. Two-stage retrieval is the version of Phase 2 (Knowledge Base) that does not collapse on real customer text. Semantic caching is the version of Phase 3 (Tier 1 Agent) that does not pay full cost on traffic the system has already learned. Documentation rigor is the loop that lets Phase 6 (Documentation Flywheel) turn every resolution into a permanent reduction of future support load.

Anthropic's *Building Effective Agents* (Dec 2024) makes the same point in different language: the highest-leverage agent designs are simple compositions of well-known patterns, not novel architectures. Both the playbook and the Anthropic guide reward teams that finish the patterns properly, not teams that ship more of them shallowly.

## 1. Two-stage retrieval beats either stage alone (Phase 2)

A keyword index is fast and free. It is also wrong about a third of the time on real customer text, because customers do not write KB articles. They write *"the link the support team sent me yesterday won't work anymore"* when they mean *"my password reset link expired."* A pure keyword search over that sentence picks up "support team," "yesterday," and "won't work" — none of which point at the password-reset article.

A pure embedding index fixes that, but it spends an embedding call on every article in the corpus on every query, and it loses some of the strong signal that does live in keyword overlap (article IDs, error codes, product names, exact phrases that the customer copy-pasted from somewhere).

The right answer is well known in production RAG, even though almost nobody puts it in the diagram: do both. Keyword first, narrow to twenty candidates. Reranker second, cut to top three. Pinecone's reranker explainer ("Rerankers and Two-Stage Retrieval", Pinecone Learn) is the canonical reference for the pattern; Cohere's Rerank 3.5 documentation is the canonical reference for the cross-encoder you would actually call in production.

```typescript
const stageOne = searchKB(query, 20).filter((h) => h.score >= 1);
const reranked = await rerank(query, stageOne, 3);
return reranked;
```

The reranker can be a real cross-encoder (we use Cohere Rerank 3.5 when an API key is available), or a bi-encoder pattern using embedding cosine when only an OpenAI key is available. Both are real precision lifts over keyword-only. The Cohere path costs about a tenth of a cent per query; the embedding path costs essentially nothing because we already pay for embeddings for the cache layer below.

The non-obvious lesson: keep the gating threshold on the *keyword* score, not the reranked score. The reranker decides ordering; the keyword score decides whether the article is in the league at all. Conflating the two will let a 0.6-cosine match short-circuit your safety floor, and you will spend the next month chasing why the FAQ specialist drafted an answer for a question your KB does not cover.

This is what *finishing* Phase 2 looks like. The playbook says "treat the KB as a living knowledge base." A keyword index alone freezes the KB at the vocabulary the writer happened to pick. Two-stage retrieval lets the same KB serve a customer's vocabulary, which is the only vocabulary that matters once the system is live.

## 2. Semantic caching is the lowest-effort 30 percent cost cut you will ever ship (Phase 3)

Production support traffic is repetitive. In our 30-day mock corpus, roughly 30 percent of inbound tickets are near-duplicates of an issue we already resolved this month. The classifier sees them as "new ticket"; a human operator would say "I just answered this for someone else."

The fix is mechanical. After every successful resolution, embed the inbound ticket text and persist it alongside the resolution. On every new inbound ticket, embed the text and cosine-match against the cache. Above a conservative threshold (we use 0.93), serve the cached resolution verbatim with a citation back to the original ticket — at the cost of a single embedding call (about $0.000001 per query) and zero LLM tokens.

The threshold is the only knob that matters here, and it is a policy decision, not an engineering one. We measured 0.90, 0.93, 0.95 against our eval set. At 0.90 we got a 38 percent hit rate but introduced one wrong answer in twenty cases — unacceptable for customer-facing automation. At 0.95 we got a 22 percent hit rate with zero wrong answers but felt the precision was leaving cost on the table. At 0.93 we got 30 percent with zero wrong answers, so that became the deployment default.

The numbers compound nicely. On a 1,000-ticket day, 300 tickets cost $0.000001 each instead of $0.000180 each. On the same 300 tickets, average latency drops from 5 seconds to 180 milliseconds — which removes the perceptual gap between "AI replied" and "the system already knew." That second-order effect is worth more than the dollars.

This is what *finishing* Phase 3 looks like. The playbook says the Tier 1 agent must "make a decision on every inbound request — there is no dead end where a customer gets a generic response," and it sets a 60 percent deflection target by end of Phase 1. A semantic cache does not raise the ceiling on the dispatcher's accuracy — that is a Phase 2 KB problem — but it makes the Phase 3 agent *cheap enough that the rollout gate becomes a confidence question, not a budget question*.

The pattern that ties this into the rest of the stack: every successful resolution writes back to the cache. The cache is not just a read-through; it is the agent's memory. Combined with the existing flywheel (resolution log) and the KB itself, it forms a three-tier memory system. Long-term knowledge is in the KB. Medium-term, ticket-specific patterns are in the resolution log. Short-term, near-duplicate fast-path is in the semantic cache. Each tier is more specific and shorter-lived than the one above it. This is exactly the layering Phase 6 (Documentation Flywheel) is supposed to produce.

## 3. Documentation is part of the system, not commentary about it (Phase 6, indirectly)

This is the one I underestimated coming into the sprint. The team that overtook us at #1 this week (WSI, Brandon Wheeler and Adam Schultheis) did not ship more code than us. They documented better. Sage's note specifically credited the system as "well architected and meticulously documented" — the conjunction matters. Documentation rigor is itself a scoring lever, not a finishing touch.

The change in our workflow that made the biggest difference: every shipped feature gets a Verified Recipe in the same working session. Not in a backlog, not at the end of the week. The recipe and the code merge together. If the recipe is not done, the code is not done.

Each recipe is structured the same way:

1. **Problem.** What was happening before. Quoted in the language a support lead would use, not the language an engineer would use.
2. **Solution.** What we did, with the actual code excerpt that does it.
3. **ROI math.** A small table that shows the cost or latency or precision delta on real data. Vague claims do not earn this section.
4. **Adoption checklist.** What another business unit needs to do to lift the pattern. We have stopped writing recipes that other teams cannot use.
5. **Phase tag + stakeholder partnership note.** Which phase the pattern advances, who in the receiving business unit owns it in production, what they need to know, what they should not change. This section is the smallest and the most important.

The point of the stakeholder note is to encode something Sage said in this week's leaderboard message: the best practices for any agentified process live in the heads of the people who do the job. The recipe is how we hand control of those best practices back to the support lead, instead of holding them inside the model.

The phase tag is the second discipline. Every recipe title opens with "Phase N — …" so a judge or another business unit lead can see at a glance where the pattern fits in Alame and Radovan's sequence. Untagged recipes drift; phase-tagged recipes accumulate into a complete catalog by Phase 8.

## What we are doing next, in playbook order

Five phase advances in five working days, one per day:

- **Day 3 — Phase 6 (Documentation Flywheel).** Every successful resolution writes back to the KB. When a doc exists, the system updates it; when no doc exists, the system creates one. Conversation memory on reply threads ships in the same recipe so the dispatcher sees the prior resolution on a follow-up.
- **Day 4 — Phase 8 (Measure, Iterate, Expand).** All eight playbook KPIs as live dashboard tiles: AI resolution rate, repeat contact rate, escalation-to-fix time, proactive detection rate, KB growth, query adoption, CSAT proxy, cost per ticket.
- **Day 5 — Phase 5 (Proactive Error Detection).** Rolling ticket-cluster detector that fires an outage alarm when a category cluster crosses 5σ above baseline; auto-creates a parent incident that subsequent matching tickets attach to.
- **Day 6 — Phase 7 (Stakeholder Intelligence Layer).** Slack bot that answers natural-language queries over the live `/api/dashboard/stats` data; daily 8 AM digest with top clusters and the cost line.
- **Day 7 — Phase 4 (Automated Developer Escalation) + final submission.** When the dispatcher routes a ticket to technical+escalate, the system auto-creates a Linear/Jira ticket with full context and an AI coding agent (`gh` CLI driving Claude Code) opens a draft PR with reproduction steps and a candidate fix. The day closes with the final demo across all eight phases and the executive summary that opens with the phase-coverage table.

## A note on what is not in this article

Voice intake. Multilingual responses. Sentiment-driven escalation. OpenTelemetry tracing. They are all on the schedule for next week, and they will each be their own recipe.

The reason they are not in this article is the same reason this article exists. Three patterns that load-bear on trust are worth more space than ten patterns that demo well. If you only lift one thing from the work we have done so far, lift two-stage retrieval (Phase 2). If you can lift two, add the semantic cache (Phase 3). The third one — the documentation discipline — is not a pattern you can lift, but it is the one that decides whether the first two stick.

## Further reading

- **W. Alame and M. Radovan**, *Agentic Support Playbook* (Fluent Knowledge Base, February 2026). The eight-phase model that organizes everything in this article. Available to Fluent Agentic Games participants through the portal.
- **Anthropic**, *Building Effective Agents* (Dec 2024), available on the Anthropic engineering blog at `anthropic.com`. The canonical taxonomy of agent patterns — prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer. Our dispatcher → judge → specialists pipeline is "routing + orchestrator-workers" by their nomenclature. Recommended as the first read for any team starting Phase 3.
- **Pinecone Learn**, *Rerankers and Two-Stage Retrieval*, available on Pinecone's learning hub. The cleanest explanation of the bi-encoder/cross-encoder split that motivates pattern 1 above.
- **Cohere**, *Rerank 3.5* product documentation at `docs.cohere.com`. The reference for the cross-encoder API we call when `COHERE_API_KEY` is set; the documentation includes the relevance-score interpretation and the latency characteristics you need to plan a SLA around.
- **Sage Franch**, *Hallucination Mitigation Playbook* (Fluent Knowledge Base). The five-point production checklist (KB audit, ≥200-case benchmark, dual-model judge, escalation SLAs, monitoring + 15-min rollback) that gates every recipe in our catalog.
- **JBL Solutions internal**, Verified Recipe library at `.claude/reports/recipe/`. Three recipes published as of 2026-05-04: PHI-safe support automation, semantic caching, and two-stage retrieval. Five more land between now and the final submission.
