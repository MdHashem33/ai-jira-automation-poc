import OpenAI, { AzureOpenAI } from 'openai';

let openaiClient: OpenAI | null = null;
let azureClient: OpenAI | null = null;

const inMemoryCache = new Map<string, number[]>();
const MAX_CACHE = 2000;

function isAzure(): boolean {
  return Boolean(process.env.AZURE_OPENAI_ENDPOINT);
}

function getEmbeddingsClient(): OpenAI | null {
  if (isAzure()) {
    const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
    if (!deployment || !process.env.OPENAI_API_KEY) return null;
    if (!azureClient) {
      azureClient = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.OPENAI_API_KEY,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
        deployment,
      });
    }
    return azureClient;
  }
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function cacheKey(text: string): string {
  return text.length > 256 ? text.slice(0, 256) + '#' + text.length : text;
}

export function isEmbeddingConfigured(): boolean {
  if (isAzure()) {
    return Boolean(process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT && process.env.OPENAI_API_KEY);
  }
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Embed a single string. Returns null if embeddings are not configured or the
 * call fails — callers must fall back to a non-embedding path so the pipeline
 * never hard-fails on a missing key.
 */
export async function embed(text: string): Promise<number[] | null> {
  const client = getEmbeddingsClient();
  if (!client) return null;
  const key = cacheKey(text);
  const hit = inMemoryCache.get(key);
  if (hit) return hit;

  const model = isAzure()
    ? (process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT as string)
    : (process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small');

  try {
    const response = await client.embeddings.create({ model, input: text });
    const vec = response.data[0]?.embedding;
    if (!vec) return null;
    if (inMemoryCache.size >= MAX_CACHE) {
      const firstKey = inMemoryCache.keys().next().value;
      if (firstKey) inMemoryCache.delete(firstKey);
    }
    inMemoryCache.set(key, vec);
    return vec;
  } catch (err) {
    console.warn('[embeddings] embed failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Batch-embed many strings. Same fall-back contract as embed().
 */
export async function embedMany(texts: string[]): Promise<Array<number[] | null>> {
  return Promise.all(texts.map(embed));
}
