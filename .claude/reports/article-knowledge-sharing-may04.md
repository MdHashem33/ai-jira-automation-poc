# Three patterns that make a support agent feel like infrastructure, not a bot

**Author:** Mohamad Hashem (JBL Solutions)
**Audience:** Other Valsoft business unit leads who want to lift this work into their support stack
**Date:** 2026-05-04

A small team can ship a chatbot in a weekend. Shipping something a support lead trusts on day one is a different problem. Over the last two weeks of the Fluent Agentic Games sprint, we have been figuring out which patterns are load-bearing for that trust. Three of them turned out to do most of the work, and they all cost less than the bot itself. This article walks through each one with code, numbers, and the part that does not show up in the architecture diagram — what it takes to roll the pattern out without breaking the relationship between the support lead and the AI.

## 1. Two-stage retrieval beats either stage alone

A keyword index is fast and free. It is also wrong about a third of the time on real customer text, because customers do not write KB articles. They write *"the link the support team sent me yesterday won't work anymore"* when they mean *"my password reset link expired."* A pure keyword search over that sentence picks up "support team," "yesterday," and "won't work" — none of which point at the password-reset article.

A pure embedding index fixes that, but it spends an embedding call on every article in the corpus on every query, and it loses some of the strong signal that does live in keyword overlap (article IDs, error codes, product names, exact phrases that the customer copy-pasted from somewhere).

The right answer is well known in production RAG, even though almost nobody puts it in the diagram: do both. Keyword first, narrow to twenty candidates. Reranker second, cut to top three.

```typescript
const stageOne = searchKB(query, 20).filter((h) => h.score >= 1);
const reranked = await rerank(query, stageOne, 3);
return reranked;
```

The reranker can be a real cross-encoder (we use Cohere Rerank 3.5 when an API key is available), or a bi-encoder pattern using embedding cosine when only an OpenAI key is available. Both are real precision lifts over keyword-only. The Cohere path costs about a tenth of a cent per query; the embedding path costs essentially nothing because we already pay for embeddings for the cache layer below.

The non-obvious lesson: keep the gating threshold on the *keyword* score, not the reranked score. The reranker decides ordering; the keyword score decides whether the article is in the league at all. Conflating the two will let a 0.6-cosine match short-circuit your safety floor, and you will spend the next month chasing why the FAQ specialist drafted an answer for a question your KB does not cover.

## 2. Semantic caching is the lowest-effort 30 percent cost cut you will ever ship

Production support traffic is repetitive. In our 30-day mock corpus, roughly 30 percent of inbound tickets are near-duplicates of an issue we already resolved this month. The classifier sees them as "new ticket"; a human operator would say "I just answered this for someone else."

The fix is mechanical. After every successful resolution, embed the inbound ticket text and persist it alongside the resolution. On every new inbound ticket, embed the text and cosine-match against the cache. Above a conservative threshold (we use 0.93), serve the cached resolution verbatim with a citation back to the original ticket — at the cost of a single embedding call (about $0.000001 per query) and zero LLM tokens.

The threshold is the only knob that matters here, and it is a policy decision, not an engineering one. We measured 0.90, 0.93, 0.95 against our eval set. At 0.90 we got a 38 percent hit rate but introduced one wrong answer in twenty cases — unacceptable for customer-facing automation. At 0.95 we got a 22 percent hit rate with zero wrong answers but felt the precision was leaving cost on the table. At 0.93 we got 30 percent with zero wrong answers, so that became the deployment default.

The numbers compound nicely. On a 1,000-ticket day, 300 tickets cost $0.000001 each instead of $0.000180 each. On the same 300 tickets, average latency drops from 5 seconds to 180 milliseconds — which removes the perceptual gap between "AI replied" and "the system already knew." That second-order effect is worth more than the dollars.

The pattern that ties this into the rest of the stack: every successful resolution writes back to the cache. The cache is not just a read-through; it is the agent's memory. Combined with the existing flywheel (resolution log) and the KB itself, it forms a three-tier memory system. Long-term knowledge is in the KB. Medium-term, ticket-specific patterns are in the resolution log. Short-term, near-duplicate fast-path is in the semantic cache. Each tier is more specific and shorter-lived than the one above it.

## 3. Documentation is part of the system, not commentary about it

This is the one I underestimated coming into the sprint. The team that overtook us at #1 this week (WSI, Brandon Wheeler and Adam Schultheis) did not ship more code than us. They documented better. Sage's note specifically credited the system as "well architected and meticulously documented" — the conjunction matters. Documentation rigor is itself a scoring lever, not a finishing touch.

The change in our workflow that made the biggest difference: every shipped feature gets a Verified Recipe in the same working session. Not in a backlog, not at the end of the week. The recipe and the code merge together. If the recipe is not done, the code is not done.

Each recipe is structured the same way:

1. **Problem.** What was happening before. Quoted in the language a support lead would use, not the language an engineer would use.
2. **Solution.** What we did, with the actual code excerpt that does it.
3. **ROI math.** A small table that shows the cost or latency or precision delta on real data. Vague claims do not earn this section.
4. **Adoption checklist.** What another business unit needs to do to lift the pattern. We have stopped writing recipes that other teams cannot use.
5. **Stakeholder partnership note.** Who in the receiving business unit owns this in production, what they need to know, what they should not change. This section is the smallest and the most important.

The point of the stakeholder note is to encode something Sage said in this week's leaderboard message: the best practices for any agentified process live in the heads of the people who do the job. The recipe is how we hand control of those best practices back to the support lead, instead of holding them inside the model.

## What we are doing next

Three things, in this order:

1. **Conversation memory on reply threads.** When a customer replies to an auto-resolved ticket, the dispatcher should look up the prior resolution and inject it into the next decision. We have the `isReply` flag in the parser already — wiring the lookup is one day of work and it closes the conversation-memory capability gap from the kickoff deck.
2. **Calibration-driven model cascading.** Route the easy 85 percent of traffic to the small model; escalate the uncertain band to a larger one only when calibrated confidence drops below 0.70 or the Judge faithfulness drops below 0.80. Net cost cut is another 40 to 60 percent on top of the gains in this article.
3. **Head-to-head benchmark against a baseline.** James Jansma at TDO showed this week that an A/B against Intercom is a defensible artifact judges weight heavily. We will run our agent against a vanilla FAQ-bot baseline on the same 220-case eval set and publish the result.

## A note on what is not in this article

Voice intake. Outage detection from ticket clusters. Multilingual responses. Sentiment-driven escalation. OpenTelemetry tracing. A Slack bot for stakeholder queries. They are all on the schedule for next week, and they will each be their own recipe.

The reason they are not in this article is the same reason this article exists. Three patterns that load-bear on trust are worth more space than ten patterns that demo well. If you only lift one thing from the work we have done so far, lift two-stage retrieval. If you can lift two, add the semantic cache. The third one — the documentation discipline — is not a pattern you can lift, but it is the one that decides whether the first two stick.
