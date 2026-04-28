import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { processEmail } from '@/lib/services/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface MonitorEvent {
  // The minimum a monitoring system needs to push: error class, count, time window,
  // and an example trace. In production this would be the body posted by Datadog,
  // Sentry, or Signoz. The handler turns the event into a synthetic ticket and
  // routes it through the standard dispatcher pipeline.
  source: 'datadog' | 'sentry' | 'signoz' | 'cloudwatch' | 'custom';
  error_class: string;
  message: string;
  count?: number;
  window_minutes?: number;
  affected_endpoint?: string;
  affected_users?: number;
  example_trace?: string;
  detected_at?: string;
}

export async function POST(request: NextRequest) {
  let event: MonitorEvent;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  if (!event.error_class || !event.message) {
    return NextResponse.json(
      { error: 'Missing required fields: error_class, message.' },
      { status: 400 },
    );
  }

  const subject = `[Auto-detected] ${event.error_class} on ${event.affected_endpoint || 'service'}`;
  const body = [
    `Source: ${event.source}`,
    `Error class: ${event.error_class}`,
    `Message: ${event.message}`,
    event.count !== undefined ? `Occurrences: ${event.count} in ${event.window_minutes ?? 'unknown'} minutes` : null,
    event.affected_endpoint ? `Affected endpoint: ${event.affected_endpoint}` : null,
    event.affected_users !== undefined ? `Estimated affected users: ${event.affected_users}` : null,
    event.example_trace ? `\nExample trace:\n${event.example_trace}` : null,
    event.detected_at ? `\nFirst detected: ${event.detected_at}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const ticket = await processEmail({
    id: uuidv4(),
    from: 'Production Monitoring <monitoring@internal.example>',
    to: 'support@fluent.example',
    subject,
    body,
    receivedAt: event.detected_at || new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    intake: {
      source: 'monitor',
      proactive: true,
      monitor_source: event.source,
      error_class: event.error_class,
    },
    ticket: {
      id: ticket.id,
      status: ticket.status,
      routedBy: ticket.routedBy,
      dispatcher: ticket.dispatcherShadow,
      jiraKey: ticket.jiraKey,
      cost: ticket.cost,
    },
  });
}
