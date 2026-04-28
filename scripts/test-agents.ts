import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import fs from 'node:fs';
import path from 'node:path';
import { dispatch } from '../src/lib/agents/dispatcher';
import { verifyDispatch } from '../src/lib/agents/judge';
import { attemptFaqResolution } from '../src/lib/agents/faqSpecialist';
import { attemptAccountResolution } from '../src/lib/agents/accountSpecialist';
import { attemptBillingResolution } from '../src/lib/agents/billingSpecialist';
import type { ParsedEmail } from '../src/lib/types';

interface TestCase {
  id: string;
  kind: 'faq' | 'account' | 'billing' | 'compliance' | 'hostile' | 'phi';
  input: { subject: string; body: string };
  expect: { category: string; resolved: boolean; requires_human_review: boolean };
  forbid: string[];
}

interface RunResult {
  testId: string;
  run: number;
  pass: boolean;
  failures: string[];
  predictedCategory: string;
  resolved: boolean;
  requires_human_review: boolean;
  answer?: string;
}

const RUNS_PER_TEST = Number(process.env.RUNS_PER_TEST || 3);
const PASS_THRESHOLD = Number(process.env.PASS_THRESHOLD || 0.7);

function toEmail(t: TestCase): ParsedEmail {
  return {
    id: t.id,
    from: `Test <test+${t.id}@harness.example>`,
    fromName: 'Test User',
    to: 'support@fluent.example',
    subject: t.input.subject,
    cleanBody: t.input.body,
    originalBody: t.input.body,
    language: 'en',
    attachments: [],
    isReply: false,
    receivedAt: new Date().toISOString(),
  };
}

async function runOnce(t: TestCase, run: number): Promise<RunResult> {
  const email = toEmail(t);
  const dispatchResult = await dispatch(email);
  let answer: string | undefined;
  let resolved = false;

  // Only attempt specialist resolution when dispatcher confidence + judge agreement permits
  // — same gate the pipeline uses.
  const judge = await verifyDispatch(email, dispatchResult);
  const eligible =
    dispatchResult.confidence >= 0.75 &&
    !dispatchResult.requires_human_review &&
    judge.agrees &&
    judge.faithfulness >= 0.7;

  if (eligible) {
    if (dispatchResult.category === 'how_to') {
      const r = await attemptFaqResolution(email);
      resolved = r.resolved;
      answer = r.answer;
    } else if (dispatchResult.category === 'account') {
      const r = await attemptAccountResolution(email);
      resolved = r.resolved;
      answer = r.answer;
    } else if (dispatchResult.category === 'billing') {
      const r = await attemptBillingResolution(email);
      resolved = r.resolved;
      answer = r.answer;
    }
  }

  const failures: string[] = [];
  if (dispatchResult.category !== t.expect.category) {
    failures.push(`category=${dispatchResult.category} expected=${t.expect.category}`);
  }
  if (resolved !== t.expect.resolved) {
    failures.push(`resolved=${resolved} expected=${t.expect.resolved}`);
  }
  if (dispatchResult.requires_human_review !== t.expect.requires_human_review) {
    failures.push(
      `requires_human_review=${dispatchResult.requires_human_review} expected=${t.expect.requires_human_review}`,
    );
  }
  for (const forbidden of t.forbid) {
    if (answer && answer.toLowerCase().includes(forbidden.toLowerCase())) {
      failures.push(`forbidden phrase appeared in answer: "${forbidden}"`);
    }
  }

  return {
    testId: t.id,
    run,
    pass: failures.length === 0,
    failures,
    predictedCategory: dispatchResult.category,
    resolved,
    requires_human_review: dispatchResult.requires_human_review,
    answer,
  };
}

async function main() {
  const fixturesPath = process.env.AGENT_TESTS || 'fixtures/eval/agent-tests.jsonl';
  const tests: TestCase[] = fs
    .readFileSync(fixturesPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  console.log(`Agent test harness — ${tests.length} cases × ${RUNS_PER_TEST} runs (Talbench multi-run pattern)`);
  console.log(`Pass threshold: ${(PASS_THRESHOLD * 100).toFixed(0)}% per case\n`);

  const allRuns: RunResult[] = [];
  for (const t of tests) {
    for (let run = 1; run <= RUNS_PER_TEST; run++) {
      const r = await runOnce(t, run);
      allRuns.push(r);
      const status = r.pass ? 'PASS' : 'FAIL';
      process.stdout.write(`\r[${t.id}] run ${run}/${RUNS_PER_TEST}: ${status}      `);
    }
    process.stdout.write('\n');
  }

  // Aggregate per-test
  const perTest = tests.map((t) => {
    const runs = allRuns.filter((r) => r.testId === t.id);
    const passes = runs.filter((r) => r.pass).length;
    const passRate = passes / runs.length;
    const consistent = passRate >= PASS_THRESHOLD;
    const failureCounts: Record<string, number> = {};
    for (const r of runs) for (const f of r.failures) failureCounts[f] = (failureCounts[f] ?? 0) + 1;
    return { t, runs, passes, passRate, consistent, failureCounts };
  });

  const consistentCount = perTest.filter((x) => x.consistent).length;
  const overallConsistencyRate = consistentCount / perTest.length;

  // Write report
  const date = new Date().toISOString().slice(0, 10);
  const reportDir = '.claude/reports/eval';
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${date}-agent-test-harness.md`);
  const lines: string[] = [];
  lines.push(`# Agent test harness — ${date}`, '');
  lines.push(`Cases: **${tests.length}** × **${RUNS_PER_TEST} runs** each (Talbench 2024 multi-run consistency pattern)`);
  lines.push(`Pass threshold per case: **${(PASS_THRESHOLD * 100).toFixed(0)}%**`);
  lines.push(
    `Consistent cases: **${consistentCount}/${tests.length}** (${(overallConsistencyRate * 100).toFixed(1)}%)`,
    '',
  );
  lines.push('## Per-case results', '');
  lines.push('| Case | Kind | Runs passed | Rate | Consistent? |');
  lines.push('|---|---|---|---|---|');
  for (const x of perTest) {
    lines.push(
      `| \`${x.t.id}\` | ${x.t.kind} | ${x.passes}/${x.runs.length} | ${(x.passRate * 100).toFixed(0)}% | ${x.consistent ? 'YES' : 'NO'} |`,
    );
  }

  const failingCases = perTest.filter((x) => !x.consistent);
  if (failingCases.length) {
    lines.push('', '## Failing cases (below threshold)', '');
    for (const x of failingCases) {
      lines.push(`### \`${x.t.id}\` (${x.t.kind}) — ${(x.passRate * 100).toFixed(0)}%`, '');
      for (const [reason, count] of Object.entries(x.failureCounts)) {
        lines.push(`- ${reason} (×${count})`);
      }
      lines.push('');
    }
  }

  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log('');
  console.log(`Consistent: ${consistentCount}/${tests.length} (${(overallConsistencyRate * 100).toFixed(1)}%)`);
  console.log(`Report:     ${reportPath}`);
  console.log(overallConsistencyRate >= PASS_THRESHOLD ? 'STATUS: PASSED' : 'STATUS: BELOW threshold');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
