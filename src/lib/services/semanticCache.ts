import fs from 'node:fs';
import path from 'node:path';
import { embed, cosine, isEmbeddingConfigured } from './embeddings';

const CACHE_PATH = path.join(process.cwd(), 'fixtures', 'cache', 'semantic-cache.jsonl');
const DEFAULT_THRESHOLD = Number(process.env.SEMANTIC_CACHE_THRESHOLD || 0.93);

export interface SemanticCacheRecord {
  id: string;
  query: string;
  embedding: number[];
  resolution: string;
  source: string;
  citationTicketId: string;
  category?: string;
  kbArticleId?: string;
  createdAt: string;
  hitCount: number;
}

export interface SemanticCacheHit {
  record: SemanticCacheRecord;
  similarity: number;
}

let memoryStore: SemanticCacheRecord[] | null = null;

function ensureLoaded(): SemanticCacheRecord[] {
  if (memoryStore) return memoryStore;
  if (!fs.existsSync(CACHE_PATH)) {
    memoryStore = [];
    return memoryStore;
  }
  const raw = fs.readFileSync(CACHE_PATH, 'utf-8').trim();
  if (!raw) {
    memoryStore = [];
    return memoryStore;
  }
  memoryStore = raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SemanticCacheRecord);
  return memoryStore;
}

function persist(records: SemanticCacheRecord[]): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

export function isSemanticCacheConfigured(): boolean {
  return isEmbeddingConfigured() && process.env.SEMANTIC_CACHE_DISABLED !== 'true';
}

/**
 * Look up the inbound query against the semantic cache. Returns a hit only when
 * cosine similarity is at or above the configured threshold (default 0.93).
 *
 * Returns null when:
 *   - embeddings are not configured (graceful degrade)
 *   - the cache is empty
 *   - no record meets the threshold
 */
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

/**
 * Persist a successful resolution into the semantic cache. We embed the query
 * once at write time so reads are a single embedding call + N cosine ops.
 *
 * No-op when embeddings are not configured.
 */
export async function record(input: {
  query: string;
  resolution: string;
  source: string;
  citationTicketId: string;
  category?: string;
  kbArticleId?: string;
}): Promise<SemanticCacheRecord | null> {
  if (!isSemanticCacheConfigured()) return null;
  const vec = await embed(input.query);
  if (!vec) return null;

  const records = ensureLoaded();
  const fresh: SemanticCacheRecord = {
    id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query: input.query.slice(0, 500),
    embedding: vec,
    resolution: input.resolution,
    source: input.source,
    citationTicketId: input.citationTicketId,
    category: input.category,
    kbArticleId: input.kbArticleId,
    createdAt: new Date().toISOString(),
    hitCount: 0,
  };
  records.push(fresh);
  persist(records);
  return fresh;
}

export function summary(): {
  total: number;
  totalHits: number;
  byCategory: Record<string, number>;
  thresholdInUse: number;
} {
  const records = ensureLoaded();
  const byCategory: Record<string, number> = {};
  let totalHits = 0;
  for (const r of records) {
    byCategory[r.category ?? 'unknown'] = (byCategory[r.category ?? 'unknown'] ?? 0) + 1;
    totalHits += r.hitCount;
  }
  return { total: records.length, totalHits, byCategory, thresholdInUse: DEFAULT_THRESHOLD };
}

export function _resetForTests(): void {
  memoryStore = null;
}
