# Verified Recipe — Phase 3: Semantic Caching for Support Auto-Resolution

**Author:** Mohamad Hashem (JBL Solutions)
**Sprint:** Fluent Agentic Games — final week
**Date:** 2026-05-04
**Status:** Live on `ai-jira-automation-poc.vercel.app`
**Eval evidence:** 220-case dispatcher F1 0.937; agent harness 11/12 consistent; semantic-cache layer non-blocking, gracefully degrades when embeddings are not configured.

## Problem

A support automation pipeline that rebuilds the same answer from scratch for every inbound ticket is paying full LLM cost on traffic that is, in practice, repetitive. In our 30-day mock corpus, roughly 30 percent of inbound tickets are near-duplicates of an issue we already resolved this month — phrased differently, but asking for the same thing.

Three things go wrong when we treat each ticket as new:

1. **Cost compounds.** Even after prompt caching cut Day 1's input cost by 70 percent, every dispatch + judge + specialist run still costs about $0.000180. Over a year at 1,000 tickets per day, that is real money for a problem we already solved.
2. **Latency stays high.** A full pipeline pass is 4 to 8 seconds even on cached prompts. A semantic-cache hit returns in under 200 milliseconds.
3. **Answer drift.** Two near-identical tickets resolved by two different model invocations can produce two slightly different answers, undermining the consistency Sage emphasised in the April 24 office hours.

## Solution

Insert a semantic-cache layer immediately after email parsing and before the dispatcher. Every successful resolution is embedded once and persisted with the resolution text. Every inbound ticket is embedded once and matched against the cache by cosine similarity. When the best match clears a conservative threshold (cosine ≥ 0.93 in our deployment), the cached resolution is served verbatim with an audit citation back to the original ticket — at the cost of a single embedding call (about $0.000001) and zero LLM tokens.

Three design choices keep this safe in production:

- **Conservative threshold.** A cosine threshold of 0.93 admits almost no false positives in our eval set. Lowering to 0.90 raised the hit rate to 38 percent but introduced one wrong answer in twenty cases, which is unacceptable for customer-facing automation. We chose 0.93 deliberately and made it `SEMANTIC_CACHE_THRESHOLD` env-tunable.
- **Citation-based traceability.** Every cache hit records the source ticket ID it is citing, so a downstream auditor can trace any auto-reply back to the human-supervised answer it copied.
- **Graceful degradation.** When `OPENAI_API_KEY` is absent (or `SEMANTIC_CACHE_DISABLED=true`), the cache layer becomes a no-op — the pipeline runs exactly as before. No new failure mode is introduced.

## Code excerpt

The lookup is the entire hot path:

```typescript
export async function lookup(query: string, threshold = DEFAULT_THRESHOLD): Promise<SemanticCacheHit | null> {
  if (!isSemanticCacheConfigured()) return null;
  const records = ensureLoaded();
  if (records.length === 0) return null;

  const queryVec = await embed(query);
  if (!queryVec) return null;

  let best: SemanticCacheHit | null = null;
  for (const record of records) {
    const sim = cosine(queryVec, record.embedding);
    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { record, similarity: sim };
    }
  }
  if (best) {
    best.record.hitCount += 1;
    persist(records);
  }
  return best;
}
```

The pipeline integration is a single short-circuit branch placed right after parsing. On hit, every downstream step is marked `Skipped (semantic cache hit)` and the original ticket ID becomes the citation.

```typescript
const cacheHit = isSemanticCacheConfigured() ? await semanticCacheLookup(cacheQuery) : null;
if (cacheHit) {
  for (let i = 2; i < steps.length; i++) updateStep(steps, i, 'completed', 'Skipped (semantic cache hit)');
  ticket.status = 'resolved_auto';
  ticket.autoReplyContent = cacheHit.record.resolution;
  // ... persist citation, return
}
```

After a non-cached resolution succeeds, the same answer is written back to the cache so the next near-duplicate can be served at zero LLM cost.

## ROI math

Assumptions, derived from the 30-day mock corpus and the post-Day-1 cost line:

- 1,000 tickets per business day
- 30 percent semantic-cache hit rate at threshold 0.93
- Pre-cache resolution cost: $0.000180 per ticket (post Day 1 prompt caching)
- Cache hit cost: $0.000001 per ticket (one embedding call, no LLM)

| Metric | Without cache | With cache | Delta |
|---|---|---|---|
| Daily LLM cost | $0.180 | $0.126 | −30% |
| Annual LLM cost | $65.70 | $46.00 | −$19.70 |
| Avg latency (cached subset) | 5.0s | 0.18s | −96% |
| Hit-cost-to-LLM-cost ratio | n/a | 1:180 | — |

Cost is not the only payoff. Latency drops by 96 percent on the cached subset, which removes the perceptual gap between "AI replied" and "the system already knew." On a 1,000-ticket day, 300 of those replies arrive in under a second.

## Adoption checklist

For another Valsoft business unit lifting this pattern:

1. Provision an embeddings model. We use `text-embedding-3-small` against Azure OpenAI; any cosine-comparable embedding works (the same code runs against vanilla OpenAI when `AZURE_OPENAI_ENDPOINT` is unset).
2. Decide your storage. Our store is a JSONL file under `fixtures/cache/`; for higher-volume deployments swap in Vercel KV, SQLite + sqlite-vss, or Pinecone. The interface in `semanticCache.ts` is small enough to back with anything.
3. Set the threshold per category. Generic FAQ tickets tolerate 0.93 cleanly. Billing or compliance tickets warrant 0.95 or higher because a wrong answer is a refund or a compliance event.
4. Cite the source ticket on every cached reply. Auditing depends on it.
5. Wire the cache write into your resolution path. Every successful auto-resolution should call `record({...})`; missing the write turns the cache into a one-day artifact.
6. Add an opt-out env var (`SEMANTIC_CACHE_DISABLED=true`). When a regression is suspected, you must be able to disable the cache without redeploying.

## Stakeholder partnership note

In a Valsoft business unit, the support lead is the right owner for the threshold and the cache contents. The threshold is a policy decision, not an engineering one. We suggest the support lead reviews the cache weekly: how many hits, where the misses cluster, and whether any cached resolution is now stale (a product change has invalidated the answer). When a cached entry needs to be retired, deleting its row in the JSONL store removes it from circulation immediately — there is no model retraining step.
