import { NextResponse } from 'next/server';
import { flywheelSummary } from '@/lib/services/kbStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(flywheelSummary());
}
