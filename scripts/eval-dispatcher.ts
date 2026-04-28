import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import fs from 'node:fs';
import path from 'node:path';
import { dispatch, type DispatchCategory } from '../src/lib/agents/dispatcher';
import type { ParsedEmail } from '../src/lib/types';

const CATEGORIES: DispatchCategory[] = [
  'billing', 'technical', 'account', 'compliance', 'feature_request', 'how_to', 'escalate',
];

interface Fixture {
  id: string;
  subject: string;
  body: string;
  from_name: string;
  from_email: string;
  expected_category: DispatchCategory;
  expected_human_review: boolean;
  pii_expected: boolean;
  notes: string;
}

interface Row {
  id: string;
  expected: DispatchCategory;
  predicted: DispatchCategory;
  ok: boolean;
  conf: number;
  human_review_pred: boolean;
  human_review_exp: boolean;
  pii_pred: boolean;
  pii_exp: boolean;
  source: string;
  notes: string;
}

function toParsedEmail(f: Fixture): ParsedEmail {
  return {
    id: f.id,
    from: `${f.from_name} <${f.from_email}>`,
    fromName: f.from_name,
    to: 'support@fluent.example',
    subject: f.subject,
    cleanBody: f.body,
    originalBody: f.body,
    language: 'en',
    attachments: [],
    isReply: false,
    receivedAt: new Date().toISOString(),
  };
}

async function main() {
  const fixturePath = process.env.FIXTURES || 'fixtures/eval/dispatcher.jsonl';
  const text = fs.readFileSync(fixturePath, 'utf-8').trim();
  const fixtures: Fixture[] = text.split('\n').map((l) => JSON.parse(l));

  const matrix: Record<string, Record<string, number>> = {};
  for (const a of CATEGORIES) {
    matrix[a] = {};
    for (const b of CATEGORIES) matrix[a][b] = 0;
  }

  const rows: Row[] = [];
  let piiCorrect = 0;
  let reviewCorrect = 0;
  let modelCalls = 0;
  let fallbackCalls = 0;

  const started = Date.now();
  for (const f of fixtures) {
    const email = toParsedEmail(f);
    const r = await dispatch(email);
    matrix[f.expected_category][r.category]++;
    if (r.pii_detected === f.pii_expected) piiCorrect++;
    if (r.requires_human_review === f.expected_human_review) reviewCorrect++;
    if (r.source === 'model') modelCalls++;
    else fallbackCalls++;
    rows.push({
      id: f.id,
      expected: f.expected_category,
      predicted: r.category,
      ok: r.category === f.expected_category,
      conf: r.confidence,
      human_review_pred: r.requires_human_review,
      human_review_exp: f.expected_human_review,
      pii_pred: r.pii_detected,
      pii_exp: f.pii_expected,
      source: r.source,
      notes: f.notes,
    });
    process.stdout.write(`\r[${rows.length.toString().padStart(3)}/${fixtures.length}] ${f.id}   `);
  }
  process.stdout.write('\n');

  const elapsedS = ((Date.now() - started) / 1000).toFixed(1);

  type CatStat = { category: DispatchCategory; support: number; precision: number; recall: number; f1: number };
  const perCat: CatStat[] = CATEGORIES.map((c) => {
    const tp = matrix[c][c];
    const fp = CATEGORIES.filter((o) => o !== c).reduce((s, o) => s + matrix[o][c], 0);
    const fn = CATEGORIES.filter((o) => o !== c).reduce((s, o) => s + matrix[c][o], 0);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return { category: c, support: tp + fn, precision, recall, f1 };
  });

  const macroF1 = perCat.reduce((s, x) => s + x.f1, 0) / perCat.length;
  const accuracy = rows.filter((r) => r.ok).length / rows.length;

  const date = new Date().toISOString().slice(0, 10);
  const reportDir = '.claude/reports/eval';
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${date}-dispatcher-baseline.md`);

  const misrows = rows.filter((r) => !r.ok);
  const humanReviewMisses = rows.filter((r) => r.human_review_exp && !r.human_review_pred);

  const lines: string[] = [];
  lines.push(`# Dispatcher evaluation — ${date}`, '');
  lines.push(`Fixtures: **${fixtures.length}** (${CATEGORIES.map((c) => `${c}=${perCat.find((p) => p.category === c)!.support}`).join(', ')})`);
  lines.push(`Elapsed: ${elapsedS}s — ${modelCalls} LLM calls, ${fallbackCalls} fallback`, '');
  lines.push(`Overall accuracy: **${(accuracy * 100).toFixed(1)}%**`);
  lines.push(`Macro F1: **${macroF1.toFixed(3)}** — target ≥ 0.80`);
  lines.push(`PII-detection accuracy: ${(piiCorrect / fixtures.length * 100).toFixed(1)}%`);
  lines.push(`Human-review flag accuracy: ${(reviewCorrect / fixtures.length * 100).toFixed(1)}%`, '');

  lines.push('## Per-category', '');
  lines.push('| Category | Support | Precision | Recall | F1 |');
  lines.push('|---|---|---|---|---|');
  for (const p of perCat) lines.push(`| ${p.category} | ${p.support} | ${p.precision.toFixed(3)} | ${p.recall.toFixed(3)} | ${p.f1.toFixed(3)} |`);

  lines.push('', '## Confusion matrix', '');
  lines.push('| actual \\ predicted | ' + CATEGORIES.join(' | ') + ' |');
  lines.push('|' + new Array(CATEGORIES.length + 1).fill('---').join('|') + '|');
  for (const a of CATEGORIES) lines.push(`| **${a}** | ${CATEGORIES.map((b) => matrix[a][b]).join(' | ')} |`);

  if (misrows.length) {
    lines.push('', '## Misclassifications', '');
    for (const r of misrows) lines.push(`- \`${r.id}\`: expected **${r.expected}** → predicted **${r.predicted}** (conf ${r.conf.toFixed(2)}, ${r.source}) — ${r.notes}`);
  }

  if (humanReviewMisses.length) {
    lines.push('', '## Human-review misses (required review but not flagged)', '');
    for (const r of humanReviewMisses) lines.push(`- \`${r.id}\` — ${r.notes}`);
  }

  fs.writeFileSync(reportPath, lines.join('\n'));

  console.log('');
  console.log(`accuracy:  ${(accuracy * 100).toFixed(1)}%`);
  console.log(`macro F1:  ${macroF1.toFixed(3)} (target 0.80)`);
  console.log(`pii acc:   ${(piiCorrect / fixtures.length * 100).toFixed(1)}%`);
  console.log(`review acc:${(reviewCorrect / fixtures.length * 100).toFixed(1)}%`);
  console.log(`report:    ${reportPath}`);
  console.log(macroF1 >= 0.80 ? 'STATUS: PASSED target' : 'STATUS: BELOW target');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
