import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import fs from 'node:fs';
import path from 'node:path';
import { dispatch, type DispatchCategory } from '../src/lib/agents/dispatcher';
import type { ParsedEmail } from '../src/lib/types';

interface Fixture {
  id: string;
  subject: string;
  body: string;
  from_name: string;
  from_email: string;
  expected_category: DispatchCategory;
  expected_human_review: boolean;
}

function toEmail(f: Fixture): ParsedEmail {
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

const BINS = [
  { name: '[0.00, 0.50)', lo: 0.0, hi: 0.5 },
  { name: '[0.50, 0.70)', lo: 0.5, hi: 0.7 },
  { name: '[0.70, 0.85)', lo: 0.7, hi: 0.85 },
  { name: '[0.85, 0.95)', lo: 0.85, hi: 0.95 },
  { name: '[0.95, 1.00]', lo: 0.95, hi: 1.0001 },
];

async function main() {
  const fixturesPath = process.env.FIXTURES || 'fixtures/eval/dispatcher.jsonl';
  const fixtures: Fixture[] = fs.readFileSync(fixturesPath, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));

  console.log(`Running confidence calibration on ${fixtures.length} fixtures…`);
  const rows: Array<{ id: string; conf: number; correct: boolean; predicted: string; expected: string }> = [];
  for (const f of fixtures) {
    const r = await dispatch(toEmail(f));
    rows.push({
      id: f.id,
      conf: r.confidence,
      correct: r.category === f.expected_category,
      predicted: r.category,
      expected: f.expected_category,
    });
    process.stdout.write(`\r[${rows.length}/${fixtures.length}]      `);
  }
  process.stdout.write('\n');

  const binStats = BINS.map((b) => {
    const items = rows.filter((r) => r.conf >= b.lo && r.conf < b.hi);
    const correct = items.filter((r) => r.correct).length;
    const accuracy = items.length > 0 ? correct / items.length : null;
    const meanConf = items.length > 0 ? items.reduce((s, r) => s + r.conf, 0) / items.length : null;
    const ece = items.length > 0 && meanConf !== null && accuracy !== null ? Math.abs(meanConf - accuracy) : 0;
    return { ...b, count: items.length, correct, accuracy, meanConf, ece, weight: items.length / rows.length };
  });

  // Expected Calibration Error: weighted average of |conf - acc| across bins with samples
  const ece = binStats.reduce((s, b) => s + b.weight * b.ece, 0);

  // Recommended human-review threshold: highest conf at which accuracy is below 90%
  let recommendedThreshold = 0.7;
  for (const b of binStats) {
    if (b.accuracy !== null && b.accuracy < 0.9) recommendedThreshold = Math.max(recommendedThreshold, b.hi);
  }

  const date = new Date().toISOString().slice(0, 10);
  const reportPath = `.claude/reports/eval/${date}-calibration.md`;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines: string[] = [];
  lines.push(`# Dispatcher confidence calibration — ${date}`, '');
  lines.push(`Fixtures: **${fixtures.length}**`);
  lines.push(`Expected Calibration Error (ECE): **${ece.toFixed(3)}** — lower is better; under 0.05 is well-calibrated.`, '');
  lines.push('## Reliability table', '');
  lines.push('| Confidence bucket | Count | Mean confidence | Accuracy | |conf − acc| |');
  lines.push('|---|---|---|---|---|');
  for (const b of binStats) {
    if (b.count === 0) {
      lines.push(`| ${b.name} | 0 | — | — | — |`);
    } else {
      lines.push(
        `| ${b.name} | ${b.count} | ${(b.meanConf ?? 0).toFixed(3)} | ${(b.accuracy ?? 0).toFixed(3)} | ${b.ece.toFixed(3)} |`,
      );
    }
  }
  lines.push('', '## Recommended human-review threshold', '');
  lines.push(
    `Auto-demote any classification below confidence \`${recommendedThreshold.toFixed(2)}\` to \`escalate\`. ` +
      `Above this threshold the dispatcher is sufficiently calibrated for downstream specialists to act on the category without an additional human-review gate.`,
  );

  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`ECE = ${ece.toFixed(3)}, recommended threshold = ${recommendedThreshold.toFixed(2)}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
