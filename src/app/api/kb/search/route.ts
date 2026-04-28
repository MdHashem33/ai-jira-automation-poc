import { NextRequest, NextResponse } from 'next/server';
import { searchKB } from '@/lib/services/kbStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) {
    return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
  }
  const hits = searchKB(q, 5);
  return NextResponse.json({
    query: q,
    hits: hits.map((h) => ({
      id: h.article.id,
      title: h.article.title,
      category: h.article.category,
      score: Math.round(h.score * 100) / 100,
      matched_keywords: h.matchedKeywords,
    })),
  });
}
