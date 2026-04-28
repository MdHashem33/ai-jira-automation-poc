import fs from 'node:fs';
import path from 'node:path';

export interface KBArticle {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  content: string;
  resolution: string;
}

export interface ResolutionRecord {
  id: string;
  ticketId: string;
  category: string;
  patternSummary: string;
  resolutionSteps: string;
  outcome: 'resolved_auto' | 'escalated_jira' | 'failed';
  createdAt: string;
}

const KB_PATH = path.join(process.cwd(), 'fixtures', 'kb', 'articles.jsonl');
const RESOLUTIONS_PATH = path.join(process.cwd(), 'fixtures', 'resolutions', 'log.jsonl');

let cached: KBArticle[] | null = null;

export function loadKB(): KBArticle[] {
  if (cached) return cached;
  const raw = fs.readFileSync(KB_PATH, 'utf-8').trim();
  cached = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return cached!;
}

export function getAll(): KBArticle[] {
  return loadKB();
}

export function byId(id: string): KBArticle | null {
  return loadKB().find((a) => a.id === id) ?? null;
}

export interface SearchHit {
  article: KBArticle;
  score: number;
  matchedKeywords: string[];
}

export function searchKB(query: string, limit = 3): SearchHit[] {
  const q = query.toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);

  const hits: SearchHit[] = [];
  for (const a of loadKB()) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of a.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += 4;
        matched.push(kw);
      }
    }
    for (const w of words) {
      if (a.title.toLowerCase().includes(w)) score += 1.5;
      if (a.content.toLowerCase().includes(w)) score += 0.75;
    }
    if (score > 0) hits.push({ article: a, score, matchedKeywords: matched });
  }
  hits.sort((x, y) => y.score - x.score);
  return hits.slice(0, limit);
}

export function topMatch(query: string, minScore = 3): SearchHit | null {
  const [first] = searchKB(query, 1);
  if (!first) return null;
  return first.score >= minScore ? first : null;
}

export function appendResolution(record: Omit<ResolutionRecord, 'id' | 'createdAt'>): ResolutionRecord {
  const full: ResolutionRecord = {
    ...record,
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(RESOLUTIONS_PATH), { recursive: true });
  fs.appendFileSync(RESOLUTIONS_PATH, JSON.stringify(full) + '\n');
  return full;
}

export function listResolutions(): ResolutionRecord[] {
  if (!fs.existsSync(RESOLUTIONS_PATH)) return [];
  const raw = fs.readFileSync(RESOLUTIONS_PATH, 'utf-8').trim();
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

/**
 * Flywheel: search the resolution log for prior tickets that look like the current
 * query. Returns the top N records with a simple keyword-overlap score. Specialists
 * can call this before drafting a reply to surface "we have resolved this before"
 * patterns to the LLM as additional grounding.
 */
export function searchResolutions(query: string, limit = 3): Array<{ record: ResolutionRecord; score: number }> {
  const records = listResolutions();
  if (!records.length) return [];
  const q = query.toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const hits = records
    .map((r) => {
      const hay = `${r.category} ${r.patternSummary} ${r.resolutionSteps}`.toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      return { record: r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export function flywheelSummary(): {
  total: number;
  byCategory: Record<string, number>;
  byOutcome: Record<string, number>;
  recent: ResolutionRecord[];
} {
  const records = listResolutions();
  const byCategory: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  for (const r of records) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
  }
  return {
    total: records.length,
    byCategory,
    byOutcome,
    recent: records.slice(-10).reverse(),
  };
}
