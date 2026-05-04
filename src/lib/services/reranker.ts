import { embed, cosine, isEmbeddingConfigured } from './embeddings';
import type { KBArticle, SearchHit } from './kbStore';

/**
 * Two-stage retrieval. Stage 1 is the existing keyword search (caller passes
 * the candidate set in). Stage 2 reranks with a cross-encoder when
 * COHERE_API_KEY is set, else with embedding-cosine (bi-encoder rerank). Both
 * are precision lifts over keyword-only and let the FAQ specialist consume a
 * smaller, higher-quality top-K — which also reduces input tokens to the LLM.
 *
 * Falls back to the input order untouched when neither reranker is available
 * so the pipeline never hard-fails on a missing key.
 */
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

function articleText(a: KBArticle): string {
  return `${a.title}. ${a.keywords.join(', ')}. ${a.content}`;
}

async function rerankByEmbedding(query: string, candidates: SearchHit[]): Promise<SearchHit[] | null> {
  const queryVec = await embed(query);
  if (!queryVec) return null;
  const docVecs = await Promise.all(candidates.map((c) => embed(articleText(c.article))));
  if (docVecs.some((v) => v === null)) return null;

  const maxKeyword = Math.max(...candidates.map((c) => c.score), 1);
  return candidates
    .map((hit, i) => {
      const sim = cosine(queryVec, docVecs[i] as number[]);
      const blended = 0.4 * (hit.score / maxKeyword) + 0.6 * sim;
      return { ...hit, score: blended };
    })
    .sort((a, b) => b.score - a.score);
}

interface CohereRerankResponse {
  results: Array<{ index: number; relevance_score: number }>;
}

async function rerankCohere(query: string, candidates: SearchHit[]): Promise<SearchHit[] | null> {
  try {
    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.COHERE_RERANK_MODEL || 'rerank-v3.5',
        query,
        documents: candidates.map((c) => articleText(c.article)),
        top_n: candidates.length,
      }),
    });
    if (!response.ok) {
      console.warn('[reranker] Cohere rerank failed:', response.status, response.statusText);
      return null;
    }
    const data = (await response.json()) as CohereRerankResponse;
    return data.results.map((r) => ({
      ...candidates[r.index],
      score: r.relevance_score,
    }));
  } catch (err) {
    console.warn('[reranker] Cohere call errored:', err instanceof Error ? err.message : err);
    return null;
  }
}
