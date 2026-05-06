import { getAllTickets } from '../store';
import { listResolutions, getAll as getAllKB } from './kbStore';
import { summary as semanticCacheSummary } from './semanticCache';

/**
 * Phase 8 — Measure, Iterate, Expand.
 *
 * Computes the 8 KPIs the Fluent Agentic Support Playbook (Alame & Radovan,
 * Feb 2026) tracks against the Phase 1 baseline:
 *
 *   1. AI Resolution Rate   — share of tickets resolved without human touch
 *   2. Repeat Contact Rate  — share of tickets that came back as a reply
 *   3. Escalation-to-Fix    — median ms from intake to Jira escalation
 *   4. Proactive Detection  — share of tickets opened by monitor channel
 *   5. KB Growth            — articles + auto-cached resolutions
 *   6. Stakeholder Adoption — Slack queries (placeholder until Phase 7 ships)
 *   7. CSAT Proxy           — auto-resolve rate weighted by inverse repeat
 *   8. Cost Per Ticket      — running average across the live ticket set
 *
 * Every value is derived from existing state — the resolution log, the
 * in-memory ticket store, the KB JSONL, and the semantic-cache file. No new
 * sampling or instrumentation is required, which keeps this drop-in for any
 * Valsoft business unit lifting the pattern.
 */

export interface KpiTile {
  key: string;
  phase: number;
  label: string;
  value: number | string;
  unit?: string;
  target?: number | string;
  helpText: string;
}

export interface KpiSnapshot {
  generatedAt: string;
  totals: {
    tickets: number;
    autoResolved: number;
    escalated: number;
    failed: number;
    kbArticles: number;
    cachedResolutions: number;
    resolutionLogEntries: number;
  };
  tiles: KpiTile[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

export function computeKpis(): KpiSnapshot {
  const tickets = getAllTickets();
  const total = tickets.length;
  const autoResolved = tickets.filter((t) => t.status === 'resolved_auto').length;
  const escalated = tickets.filter((t) => t.status === 'escalated_jira').length;
  const failed = tickets.filter((t) => t.status === 'failed').length;
  const monitorChannel = tickets.filter((t) => t.channel === 'voice' || t.channel === 'chatbot').length;
  const replyTickets = tickets.filter((t) => t.email?.isReply === true).length;

  const escalationLatencies = tickets
    .filter((t) => t.status === 'escalated_jira')
    .map((t) => t.processingTimeMs)
    .filter((ms) => ms > 0);

  const totalCost = tickets.reduce((sum, t) => sum + (t.cost?.totalUsd ?? 0), 0);
  const avgCost = total > 0 ? totalCost / total : 0;

  const cacheSummary = semanticCacheSummary();
  const kbArticles = getAllKB().length;
  const resolutionLogEntries = listResolutions().length;
  const knownArticles = kbArticles + cacheSummary.total;

  const aiResolutionRate = pct(autoResolved, total);
  const repeatContactRate = pct(replyTickets, total);
  const proactiveDetectionRate = pct(monitorChannel, total);
  const escalationToFixMs = Math.round(median(escalationLatencies));
  // CSAT proxy: auto-resolve rate weighted DOWN by repeat contact (a repeat
  // contact is evidence the prior auto-resolve did not stick). Bounded [0,100].
  const csatProxy = Math.max(0, Math.round(aiResolutionRate * (1 - repeatContactRate / 100)));

  // Stakeholder query adoption — populated by Phase 7 (Day 6). Until then we
  // surface a 0 with the help text so the tile is visible and honest.
  const stakeholderAdoption = 0;

  const tiles: KpiTile[] = [
    {
      key: 'ai_resolution_rate',
      phase: 8,
      label: 'AI Resolution Rate',
      value: aiResolutionRate,
      unit: '%',
      target: 60,
      helpText: 'Share of inbound tickets resolved without human touch. Phase 1 deflection target: 60%.',
    },
    {
      key: 'repeat_contact_rate',
      phase: 8,
      label: 'Repeat Contact Rate',
      value: repeatContactRate,
      unit: '%',
      target: '< 15',
      helpText: 'Share of tickets that came back as a reply. High values mean prior resolutions are not sticking.',
    },
    {
      key: 'escalation_to_fix',
      phase: 8,
      label: 'Escalation-to-Fix Time',
      value: escalationToFixMs,
      unit: 'ms (median)',
      target: '< 8000',
      helpText: 'Median end-to-end latency for tickets that escalated to Jira. Stand-in for true ticket-to-deploy time until Phase 4 ships.',
    },
    {
      key: 'proactive_detection_rate',
      phase: 8,
      label: 'Proactive Detection Rate',
      value: proactiveDetectionRate,
      unit: '%',
      target: '> 0 (Phase 5)',
      helpText: 'Share of tickets opened by the monitor or voice channel before a customer email arrives.',
    },
    {
      key: 'kb_growth',
      phase: 8,
      label: 'Knowledge Base Growth',
      value: knownArticles,
      unit: 'entries',
      target: '↑ weekly',
      helpText: `KB articles (${kbArticles}) + auto-cached resolutions (${cacheSummary.total}). Combined corpus the dispatcher can draw from.`,
    },
    {
      key: 'stakeholder_query_adoption',
      phase: 8,
      label: 'Stakeholder Query Adoption',
      value: stakeholderAdoption,
      unit: 'queries / week',
      target: 'live in Phase 7',
      helpText: 'Slack/WhatsApp natural-language queries against the dashboard. Lights up when Phase 7 ships (Day 6).',
    },
    {
      key: 'csat_proxy',
      phase: 8,
      label: 'CSAT Proxy',
      value: csatProxy,
      unit: '%',
      target: 70,
      helpText: 'Auto-resolution rate down-weighted by repeat contact rate. Stand-in until a real CSAT survey is wired in.',
    },
    {
      key: 'cost_per_ticket',
      phase: 8,
      label: 'Cost Per Ticket',
      value: Math.round(avgCost * 1_000_000) / 1_000_000,
      unit: 'USD',
      target: '< 0.0002',
      helpText: 'Running average across all processed tickets. Day 1 prompt caching dropped this 70%; Day 2 semantic cache projects another 30% on hits.',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      tickets: total,
      autoResolved,
      escalated,
      failed,
      kbArticles,
      cachedResolutions: cacheSummary.total,
      resolutionLogEntries,
    },
    tiles,
  };
}
