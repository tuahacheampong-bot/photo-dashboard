import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireOwner, validateRequired, validatePositiveNumber, validateDate, validateEnum, firstError } from '@/lib/api-auth';
import type { Gig, ClientPayment, Invoice } from '@/lib/types';

interface SumResult { total: number; }

// POST /api/payments/client - Record a client payment
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const body = await request.json() as {
      gig_id: number;
      invoice_id?: number | null;
      amount: number;
      payment_date: string;
      payment_method?: string;
      reference_number?: string | null;
      notes?: string | null;
    };
    const { gig_id, invoice_id, amount, payment_date, payment_method, reference_number, notes } = body;

    const err = firstError(
      validateRequired(body, ['gig_id', 'amount', 'payment_date']),
      validatePositiveNumber(amount, 'amount'),
      validateDate(payment_date, 'payment_date'),
      validateEnum(payment_method, ['cash', 'bank_transfer', 'mobile_money', 'card', 'other'], 'payment_method')
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Check if payment exceeds gig total
    const gig = await db.prepare('SELECT total_amount FROM gigs WHERE id = ?').get(gig_id) as Gig | null;
    if (!gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    const existingPayments = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM client_payments WHERE gig_id = ?'
    ).get(gig_id) as SumResult;

    const remaining = gig.total_amount - existingPayments.total;

    if (amount > remaining + 0.01) {
      return NextResponse.json(
        { error: `Payment (GH₵ ${amount}) exceeds remaining balance (GH₵ ${remaining.toFixed(2)})` },
        { status: 400 }
      );
    }

    // Check for duplicate payment on same date with same amount
    const duplicate = await db.prepare(
      'SELECT id FROM client_payments WHERE gig_id = ? AND amount = ? AND payment_date = ?'
    ).get(gig_id, amount, payment_date) as ClientPayment | null;

    if (duplicate) {
      return NextResponse.json(
        { error: 'A payment of this amount already exists for this date' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      INSERT INTO client_payments (gig_id, invoice_id, amount, payment_date, payment_method, reference_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      gig_id, invoice_id ?? null, amount, payment_date,
      payment_method || 'cash', reference_number ?? null, notes ?? null
    );

    // Update invoice status if linked
    if (invoice_id) {
      const totalPaid = db.prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM client_payments WHERE invoice_id = ?'
      ).get(invoice_id) as SumResult;

      const invoice = await db.prepare('SELECT total_amount FROM invoices WHERE id = ?').get(invoice_id) as Invoice | null;

      let newStatus = 'partial';
      if (invoice && totalPaid.total >= invoice.total_amount) {
        newStatus = 'paid';
      }

      await db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, invoice_id);
    }

    return NextResponse.json({ id: result.lastInsertRowid, message: 'Client payment recorded' });
  } catch (error) {
    console.error('Error recording client payment:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}