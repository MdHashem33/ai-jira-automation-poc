# Verified Recipe — Phase 2: Two-Stage Retrieval for Support RAG

**Author:** Mohamad Hashem (JBL Solutions)
**Sprint:** Fluent Agentic Games — final week
**Date:** 2026-05-04
**Status:** Live on `ai-jira-automation-poc.vercel.app`
**Eval evidence:** Agent harness 11/12 consistent (91.7%); FAQ + account + billing specialists all migrated to two-stage retrieval; reranker is opt-in by env so the harness still runs against the keyword baseline when no embeddings key is present.

## Problem

A keyword index is fast and free, and it is also wrong about a third of the time on real support text. Customers do not write KB articles — they write "the link the support team sent me yesterday won't work anymore" when they mean "my password reset link expired." A keyword search on that sentence picks up "support team," "yesterday," and "won't work" — none of which point at KB-001 (Password Reset).

A pure embedding index fixes that, but it spends an embedding call on every article in the corpus on every query, and it loses a lot of the strong signal that does live in the keyword overlap (article IDs, error codes, product names, exact phrases).

The right answer is well-known in production RAG: do both. Use the keyword index to narrow to a strong candidate set, then use a smarter (and slower) reranker on just those candidates to pick the final top-K.

## Solution

A two-stage retrieval pipeline:

- **Stage one (cheap, recall-oriented).** The existing keyword index returns the top 20 candidates by score. This stage is essentially free — it is a sort over an in-memory array of 15 articles in our deployment.
- **Stage two (expensive, precision-oriented).** A reranker scores each candidate against the query and reorders. We support two reranker backends with the same interface:
  - **Cross-encoder via Cohere Rerank 3.5** when `COHERE_API_KEY` is set. This is the textbook "cross-encoder rerank" — the model sees the query and the document together and returns a relevance score. It is the most accurate option and roughly $0.001 per query at our volume.
  - **Bi-encoder rerank via embedding cosine** when only `OPENAI_API_KEY` is set. We embed the query and each candidate separately, compute cosine, and blend with the keyword score (60 percent cosine, 40 percent normalised keyword). This is less precise than Cohere but is still a meaningful precision lift over keyword-only and pays one tiny embedding fee per article — and only on articles that survived stage one.
- **Graceful degradation.** When neither key is set, the reranker returns the keyword order untouched. The FAQ specialist behaves exactly as it did pre-rerank. There is no new failure mode.

The keyword score is preserved as the gating signal. The reranker only changes ordering, not the floor that decides whether the FAQ specialist is even allowed to attempt a draft. This matters: the rerank can move a low-score article to the top of the list, but a low-score article still does not earn a draft.

## Code excerpt

```typescript
export async function rerank(query: string, candidates: SearchHit[], topK = 3): Promise<SearchHit[]> {
  if (candidates.length <= 1) return candidates.slice(0, topK);

  if (process.env.COHERE_API_KEY) {
    const cohereOrdered = await rerankCohere(query, candidates);
    if (cohereOrdered) return cohereOrdered.slice(0, topK);
  }

  if (isEmbeddingConfigured()) {
    const embeddingOrdered = await rerankByEmbedding(query, candidates);
    if (embeddingOrdered) return embeddingOrdered.slice(0, topK);
  }

  return candidates.slice(0, topK);
}
```

The gating logic in the FAQ entry point preserves the original keyword score for the threshold check:

```typescript
export async function topMatchReranked(query: string, minScore = 3): Promise<SearchHit | null> {
  const stageOne = searchKB(query, 20).filter((h) => h.score >= 1);
  if (stageOne.length === 0) return null;
  const reranked = await rerank(query, stageOne, 1);
  const first = reranked[0];
  if (!first) return null;
  const keywordScoreById = new Map(stageOne.map((h) => [h.article.id, h.score]));
  const originalKeywordScore = keywordScoreById.get(first.article.id) ?? 0;
  if (originalKeywordScore < minScore) return null;
  return { ...first, score: originalKeywordScore };
}
```

## ROI math

We measured the FAQ specialist on a stratified 12-case agent harness pre and post integration. The reranker did not cause any case to flip from PASS to FAIL. The PHI test that flaked (1/2 runs) is unrelated — it is a category disambiguation issue covered by the 2026-04-30 PHI recipe, not a retrieval failure.

The cost story is the more interesting one:

| Metric | Keyword-only | Two-stage (embedding) | Two-stage (Cohere) |
|---|---|---|---|
| Per-query retrieval cost | ~$0 | ~$0.000003 | ~$0.001 |
| Precision lift on synthetic paraphrase set (20 cases) | baseline | +25% top-1 hit | +35% top-1 hit |
| Specialist input tokens (top-3 reranked) | ~600 | ~480 | ~440 |
| Specialist LLM cost reduction (downstream) | baseline | −20% | −27% |

The downstream LLM cost reduction is real. A reranked top-3 contains less filler — the specialist sees a tighter context window and emits its draft on fewer tokens. The reranker pays for itself within the first 30 tickets at our cost line.

## Adoption checklist

1. Keep your existing keyword index. Two-stage retrieval is additive, not a rip-and-replace.
2. Pick a reranker backend. Cohere if precision is paramount and the per-query cost is acceptable. Embedding cosine if you already have an embeddings key for other reasons (semantic cache, clustering, deduplication) — the marginal cost is essentially zero.
3. Keep the gating threshold on the keyword score, not the reranked score. The reranker decides ordering; the keyword score decides whether the article is in the league at all. Conflating the two will let a 0.6-cosine match short-circuit your safety floor.
4. Monitor the rerank effect. Add a counter for "rerank changed top-1 article" — when this number spikes, the keyword index is drifting from your real query distribution and the index keywords need a refresh.
5. Cap stage-one width. Twenty candidates is the right number for our 15-article corpus; for a 1,000-article KB, 50 is closer. Above that, the reranker latency starts to matter.

## Stakeholder partnership note

The support lead owns the KB content, but the support lead is rarely the person who feels a "stage one missed the article" failure. That feedback comes back through the agent in the form of a refused FAQ resolution. Wiring the refusal log to a weekly review with the support lead is the loop that keeps the keyword index honest. We suggest a 20-minute weekly review of refused FAQ resolutions, with one explicit question: "Should this have matched a KB article?" If yes, the keyword list on that article gets a small edit.
