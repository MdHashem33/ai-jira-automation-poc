import { NextResponse } from 'next/server';
import { computeKpis } from '@/lib/services/kpis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = computeKpis();
  return NextResponse.json(snapshot);
}
