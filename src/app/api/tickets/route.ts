import { NextResponse } from 'next/server';
import { getAllTickets, getTicket } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const ticket = getTicket(id);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    return NextResponse.json({ ticket });
  }

  const tickets = getAllTickets();
  return NextResponse.json({ tickets, total: tickets.length });
}
