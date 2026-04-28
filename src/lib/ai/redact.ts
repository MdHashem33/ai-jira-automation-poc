export type RedactionKind =
  | 'EMAIL'
  | 'PHONE'
  | 'CARD'
  | 'SSN'
  | 'ACCOUNT'
  | 'URL'
  | 'IP'
  | 'NAME';

export interface RedactionEntry {
  kind: RedactionKind;
  token: string;
  original: string;
}

export interface RedactedText {
  cleansed: string;
  entries: RedactionEntry[];
  piiDetected: boolean;
}

interface Pattern {
  kind: RedactionKind;
  regex: RegExp;
}

const PATTERNS: Pattern[] = [
  { kind: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'URL', regex: /\bhttps?:\/\/[^\s<>"']+/g },
  { kind: 'CARD', regex: /\b(?:\d[ -]?){13,19}\b/g },
  { kind: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'PHONE', regex: /\b(?:\+?\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?|\d{2,4}[ .-]?)\d{3}[ .-]?\d{3,4}\b/g },
  { kind: 'IP', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { kind: 'ACCOUNT', regex: /\b(?:acc(?:ount)?|customer|policy|member|mrn|patient)[-_ #:]*([A-Z0-9-]{5,})\b/gi },
];

export function redact(input: string): RedactedText {
  const entries: RedactionEntry[] = [];
  const counters: Partial<Record<RedactionKind, number>> = {};
  let cleansed = input;

  for (const { kind, regex } of PATTERNS) {
    cleansed = cleansed.replace(regex, (match) => {
      const existing = entries.find((e) => e.kind === kind && e.original === match);
      if (existing) return existing.token;
      counters[kind] = (counters[kind] ?? 0) + 1;
      const token = `[${kind}_${counters[kind]}]`;
      entries.push({ kind, token, original: match });
      return token;
    });
  }

  return {
    cleansed,
    entries,
    piiDetected: entries.length > 0,
  };
}

export function rehydrate(text: string, entries: RedactionEntry[]): string {
  let out = text;
  for (const e of entries) {
    out = out.split(e.token).join(e.original);
  }
  return out;
}

export function summarizePii(entries: RedactionEntry[]): string {
  if (entries.length === 0) return 'none';
  const counts: Partial<Record<RedactionKind, number>> = {};
  for (const e of entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  return Object.entries(counts)
    .map(([k, n]) => `${k}×${n}`)
    .join(', ');
}
