import { ProcessedTicket, DashboardStats, Priority, Intent, Sentiment } from './types';

const tickets: ProcessedTicket[] = [];

export function addTicket(ticket: ProcessedTicket): void {
  tickets.push(ticket);
}

export function getTicket(id: string): ProcessedTicket | undefined {
  return tickets.find((t) => t.id === id);
}

export function updateTicket(id: string, updates: Partial<ProcessedTicket>): ProcessedTicket | undefined {
  const index = tickets.findIndex((t) => t.id === id);
  if (index === -1) return undefined;
  tickets[index] = { ...tickets[index], ...updates, updatedAt: new Date().toISOString() };
  return tickets[index];
}

export function getAllTickets(): ProcessedTicket[] {
  return [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getDashboardStats(): DashboardStats {
  const total = tickets.length;
  const autoResolved = tickets.filter((t) => t.status === 'resolved_auto').length;
  const escalated = tickets.filter((t) => t.status === 'escalated_jira').length;
  const failed = tickets.filter((t) => t.status === 'failed').length;

  const avgTime = total > 0
    ? tickets.reduce((sum, t) => sum + t.processingTimeMs, 0) / total
    : 0;

  const byPriority: Record<Priority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byIntent: Record<Intent, number> = {
    bug_report: 0, feature_request: 0, general_inquiry: 0, account_issue: 0,
    billing: 0, security_incident: 0, service_outage: 0, how_to_question: 0,
  };
  const bySentiment: Record<Sentiment, number> = {
    positive: 0, neutral: 0, negative: 0, frustrated: 0, urgent: 0,
  };

  for (const t of tickets) {
    if (t.aiAnalysis) {
      byPriority[t.aiAnalysis.priority]++;
      byIntent[t.aiAnalysis.intent]++;
      bySentiment[t.aiAnalysis.sentiment]++;
    }
  }

  const dateMap = new Map<string, { count: number; autoResolved: number }>();
  for (const t of tickets) {
    const date = t.createdAt.substring(0, 10);
    const entry = dateMap.get(date) || { count: 0, autoResolved: 0 };
    entry.count++;
    if (t.status === 'resolved_auto') entry.autoResolved++;
    dateMap.set(date, entry);
  }

  const processingTimeline = Array.from(dateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalCostUsd = tickets.reduce((sum, t) => sum + (t.cost?.totalUsd ?? 0), 0);
  const avgCostPerTicketUsd = total > 0 ? totalCostUsd / total : 0;

  const routedBy: Record<string, number> = {};
  for (const t of tickets) {
    const key = t.routedBy ?? 'unresolved';
    routedBy[key] = (routedBy[key] ?? 0) + 1;
  }

  return {
    totalProcessed: total,
    autoResolved,
    escalatedToJira: escalated,
    failed,
    avgProcessingTimeMs: Math.round(avgTime),
    byPriority,
    byIntent,
    bySentiment,
    autoResolveRate: total > 0 ? Math.round((autoResolved / total) * 100) : 0,
    recentTickets: getAllTickets().slice(0, 10),
    processingTimeline,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
    avgCostPerTicketUsd: Math.round(avgCostPerTicketUsd * 1_000_000) / 1_000_000,
    routedBy,
  };
}
