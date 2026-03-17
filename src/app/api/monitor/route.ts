import { NextResponse } from 'next/server';
import { startMonitor, stopMonitor, getMonitorStatus } from '@/lib/services/emailMonitor';

export async function GET() {
  const status = getMonitorStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'start') {
      const result = await startMonitor();
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === 'stop') {
      const result = await stopMonitor();
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action. Use "start" or "stop".' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error: ${error}` },
      { status: 500 }
    );
  }
}
