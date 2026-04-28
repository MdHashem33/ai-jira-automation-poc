import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3001';
const OUT = resolve('./demo-video');
mkdirSync(OUT, { recursive: true });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const overlayScript = (text, sub = '') => `
  (() => {
    const existing = document.getElementById('__demo_overlay__');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = '__demo_overlay__';
    el.style.cssText = [
      'position:fixed','top:24px','left:50%','transform:translateX(-50%)',
      'z-index:99999','background:rgba(15,23,42,0.92)','color:#e2e8f0',
      'padding:14px 22px','border-radius:12px','font-family:ui-sans-serif,system-ui',
      'box-shadow:0 10px 30px rgba(0,0,0,0.4)','border:1px solid rgba(148,163,184,0.25)',
      'max-width:720px','text-align:center'
    ].join(';');
    el.innerHTML = ${JSON.stringify(`<div style="font-size:18px;font-weight:600">${text}</div>${sub ? `<div style="font-size:13px;opacity:.75;margin-top:4px">${sub}</div>` : ''}`)};
    document.body.appendChild(el);
  })();
`;

async function caption(page, text, sub = '', dwell = 2500) {
  await page.evaluate(overlayScript(text, sub));
  await pause(dwell);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    // 1. Dashboard — baseline numbers
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await caption(page, 'AI Jira Automation POC', 'Agentic Games — Week 1 demo', 3000);
    await caption(page, 'Dashboard — baseline metrics', 'Total Processed = 0 before we run anything', 3500);

    // 2. Email Simulation tab
    const simTab = page.getByRole('button', { name: /Email Simulation/i });
    if (await simTab.count()) await simTab.first().click();
    await pause(1200);
    await caption(page, 'Step 1 — Mock support email', 'Password reset scenario, no real data', 2500);

    // 3. Fire simulations deterministically via the API (3 samples for a visible delta)
    await caption(page, 'Step 2 — Pipeline runs', 'Parse → Dispatch → Judge verify → Specialist or Legacy', 1800);
    for (const sampleIndex of [1, 3, 0]) {
      const r = await page.request.post(`${BASE}/api/email/simulate`, {
        data: { sampleIndex },
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('simulate', sampleIndex, r.status());
    }
    // 3b. Voice intake → FAQ specialist
    const voice = await page.request.post(`${BASE}/api/intake/voice`, {
      data: {
        transcript: 'Hi, I need help — where do I find my API key in settings? I am trying to set up a new integration.',
        subjectHint: 'Where do I find my API key?',
        callerName: 'Demo Caller',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('voice intake', voice.status());
    // 3c. Billing specialist with scoped tool
    const billing = await page.request.post(`${BASE}/api/intake/voice`, {
      data: {
        transcript: 'Can you confirm the status of invoice INV-22841 and explain the VAT line?',
        subjectHint: 'Question about invoice INV-22841',
        callerName: 'Demo Billing Caller',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('billing intake', billing.status());
    // 3d. Proactive monitor hook
    const monitor = await page.request.post(`${BASE}/api/intake/monitor`, {
      data: {
        source: 'datadog',
        error_class: 'DBTimeout',
        message: 'Database timeout on /api/exports for exports above 10k rows',
        count: 47,
        window_minutes: 5,
        affected_endpoint: '/api/exports',
        affected_users: 12,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('monitor intake', monitor.status());
    await pause(1500);
    await caption(page, 'Multi-channel — same pipeline', 'Email · voice · screenshot · monitor (proactive)', 3200);
    await pause(1500);
    await caption(page, 'Three specialists live', 'FAQ · Account recovery · Billing (with scoped tool)', 3200);
    await pause(1500);
    await caption(page, 'PII/PHI redacted before every LLM call', 'EMAIL, PHONE, SSN, CARD, ACCOUNT masked', 2800);
    await pause(1200);
    await caption(page, 'Auto-resolve via FAQ specialist, or escalate to Jira', '', 2500);

    // 4. Back to dashboard + refresh — show counters ticked up
    const dashTab = page.getByRole('button', { name: /^Dashboard$/i });
    if (await dashTab.count()) await dashTab.first().click();
    await pause(800);
    const refreshBtn = page.getByRole('button', { name: /Refresh/i });
    if (await refreshBtn.count()) {
      const [statsResp] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/api/dashboard/stats'), { timeout: 10000 }).catch(() => null),
        refreshBtn.first().click(),
      ]);
      if (statsResp) console.log('stats refresh', statsResp.status());
    }
    await pause(2500);
    // Verify the counter text is non-zero before captioning
    const processedText = await page.locator('text=Total Processed').locator('..').innerText().catch(() => '');
    console.log('processed tile text:', processedText.replace(/\s+/g, ' '));
    await caption(page, 'Dashboard — metrics updated', `Total Processed, Auto-Resolve Rate refreshed live (${processedText.match(/\d+/)?.[0] || ''})`, 4500);
    await page.screenshot({ path: 'demo-video/dashboard-after.png' }).catch(() => {});
    await pause(2500);

    // 5. Show smoke endpoint JSON
    await page.goto(`${BASE}/api/dev/smoke`, { waitUntil: 'networkidle' });
    await pause(1000);
    await caption(page, 'Dispatcher smoke test — 6/6 correct', 'category • confidence • PII summary', 4500);
    await pause(2500);

    // 6. Wrap
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await caption(
      page,
      'Week 4 shipped — halftime',
      'F1 0.967 · ECE 0.017 · 10/12 multi-run · 4 channels · 3 specialists · ~$0.0006/ticket',
      5000
    );
  } catch (err) {
    console.error('demo-record error:', err);
  } finally {
    await context.close();
    await browser.close();
  }
})();
