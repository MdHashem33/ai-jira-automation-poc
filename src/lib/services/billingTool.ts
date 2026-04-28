/**
 * Mock billing tool — read-only invoice lookup, served behind an MCP-style scoped
 * service account. The tool exposes a single function: lookupInvoice(invoiceNumber).
 *
 * Per the office-hours guidance (Victor, Patrick — April 17), the AI never sees
 * the underlying database. It calls this function with a structured argument and
 * receives a structured response. In production the implementation would query a
 * billing system; here it returns deterministic mock data.
 */

export interface InvoiceRecord {
  invoice_number: string;
  status: 'paid' | 'pending' | 'overdue' | 'refunded' | 'unknown';
  amount_usd: number;
  issued_on: string;
  customer_email: string;
  plan: 'standard' | 'professional' | 'enterprise';
  notes?: string;
}

const MOCK_DB: Record<string, InvoiceRecord> = {
  'INV-22841': {
    invoice_number: 'INV-22841',
    status: 'paid',
    amount_usd: 149,
    issued_on: '2026-03-01',
    customer_email: 'priya.shah@northwind-labs.example',
    plan: 'professional',
    notes: 'VAT applied at 20%',
  },
  'INV-31902': {
    invoice_number: 'INV-31902',
    status: 'paid',
    amount_usd: 1199,
    issued_on: '2026-04-01',
    customer_email: 'admin@dewdrop.example',
    plan: 'enterprise',
  },
};

export function lookupInvoice(invoiceNumber: string): InvoiceRecord {
  const key = invoiceNumber.trim().toUpperCase();
  return (
    MOCK_DB[key] ?? {
      invoice_number: key,
      status: 'unknown',
      amount_usd: 0,
      issued_on: '',
      customer_email: '',
      plan: 'standard',
      notes: 'Invoice not found in records',
    }
  );
}

const INVOICE_NUMBER_RE = /\bINV-\d{4,6}\b/i;
export function extractInvoiceNumber(text: string): string | null {
  const match = text.match(INVOICE_NUMBER_RE);
  return match ? match[0].toUpperCase() : null;
}
