import { chromium } from 'playwright';
import { marked } from 'marked';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const MD = process.argv[2] || '.claude/reports/weekly/2026-04-18-week-1.md';
const WEBM = process.argv[3] || 'demo-video/' + (
  spawnSync('ls', ['demo-video']).stdout.toString().split('\n').find((f) => f.endsWith('.webm')) || ''
);
const OUT_DIR = resolve(process.env.HOME, 'Downloads');
mkdirSync(OUT_DIR, { recursive: true });

const stem = basename(MD, '.md');

// 1. Markdown → PDF via Playwright
const md = readFileSync(MD, 'utf-8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;max-width:720px;margin:40px auto;padding:0 24px}
  h1{font-size:26px;margin-top:0;border-bottom:2px solid #e2e8f0;padding-bottom:8px}
  h2{font-size:18px;margin-top:28px;color:#1e293b}
  h3{font-size:15px}
  code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12.5px}
  pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:6px;overflow-x:auto;font-size:12px}
  pre code{background:transparent;padding:0;color:inherit}
  table{border-collapse:collapse;width:100%;margin:12px 0;font-size:12.5px}
  th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left;vertical-align:top}
  th{background:#f8fafc;font-weight:600}
  blockquote{border-left:3px solid #94a3b8;margin:12px 0;padding:0 14px;color:#475569}
  hr{border:0;border-top:1px solid #e2e8f0;margin:24px 0}
  ul,ol{padding-left:22px}
  li{margin:3px 0}
  a{color:#1d4ed8}
</style></head><body>${marked.parse(md)}</body></html>`;

const pdfPath = resolve(OUT_DIR, `${stem}.pdf`);
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: pdfPath, format: 'Letter', margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' }, printBackground: true });
await browser.close();
console.log('wrote', pdfPath);

// 2. .webm → .mp4 via ffmpeg-static
if (WEBM && WEBM.endsWith('.webm')) {
  const mp4Path = resolve(OUT_DIR, `${stem}-demo.mp4`);
  const args = ['-y', '-i', WEBM, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path];
  const r = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
  console.log('wrote', mp4Path);
}
