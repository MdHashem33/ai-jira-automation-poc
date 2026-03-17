import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { sampleEmails } from '@/lib/sampleEmails';
import { processEmail } from '@/lib/services/pipeline';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sampleIndex } = body;

    let emailInput;

    if (typeof sampleIndex === 'number' && sampleIndex >= 0 && sampleIndex < sampleEmails.length) {
      emailInput = { ...sampleEmails[sampleIndex], id: uuidv4(), receivedAt: new Date().toISOString() };
    } else {
      const randomIndex = Math.floor(Math.random() * sampleEmails.length);
      emailInput = { ...sampleEmails[randomIndex], id: uuidv4(), receivedAt: new Date().toISOString() };
    }

    const result = await processEmail(emailInput);

    return NextResponse.json({
      success: true,
      ticket: result,
    });
  } catch (error) {
    console.error('[API] Simulate error:', error);
    return NextResponse.json(
      { error: 'Simulation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    samples: sampleEmails.map((e, i) => ({
      index: i,
      from: e.from,
      subject: e.subject,
      hasAttachments: (e.attachments?.length || 0) > 0,
    })),
  });
}
