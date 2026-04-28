import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { processEmail } from '@/lib/services/pipeline';
import { redact } from '@/lib/ai/redact';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface VoiceIntakePayload {
  // Real voice intake would accept an audio file URL or base64 and transcribe via
  // Azure Speech / Whisper. This endpoint accepts a pre-transcribed text body so the
  // full pipeline can be exercised without a speech service. When a transcription
  // service is wired up, the transcribe step slots in here before the redact call.
  transcript: string;
  callerName?: string;
  callerPhone?: string;
  subjectHint?: string;
}

export async function POST(request: NextRequest) {
  let body: VoiceIntakePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  if (!body.transcript || body.transcript.trim().length < 5) {
    return NextResponse.json({ error: 'Provide a transcript string (non-empty).' }, { status: 400 });
  }

  // Derive a subject from the first 80 chars if none supplied
  const subject = body.subjectHint?.slice(0, 120) || body.transcript.trim().slice(0, 80).replace(/\s+/g, ' ');
  const redacted = redact(`${subject}\n${body.transcript}`);

  const ticket = await processEmail({
    id: uuidv4(),
    from: `${body.callerName || 'Voice Caller'} <${
      body.callerPhone ? body.callerPhone.replace(/[^0-9+]/g, '') + '@voice.intake' : 'voice@intake.example'
    }>`,
    to: 'support@fluent.example',
    subject,
    body: body.transcript,
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    intake: {
      source: 'voice',
      channel_note: 'Transcript-based endpoint. Azure Speech integration slots in before redact.',
      pii_detected: redacted.piiDetected,
      pii_summary: redacted.entries.map((e) => e.kind).join(', ') || 'none',
    },
    ticket: {
      id: ticket.id,
      status: ticket.status,
      routedBy: ticket.routedBy,
      dispatcher: ticket.dispatcherShadow,
      faq: ticket.faqSpecialist,
      jiraKey: ticket.jiraKey,
      cost: ticket.cost,
    },
  });
}
