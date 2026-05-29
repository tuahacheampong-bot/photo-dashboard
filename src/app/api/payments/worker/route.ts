import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireOwner, validateRequired, validatePositiveNumber, validateDate, validateEnum, firstError } from '@/lib/api-auth';

// POST /api/payments/worker - Record a worker payment
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const body = await request.json();
    const { gig_id, worker_id, amount, payment_date, payment_method, reference_number, notes } = body;

    const err = firstError(
      validateRequired(body, ['gig_id', 'worker_id', 'amount', 'payment_date']),
      validatePositiveNumber(amount, 'amount'),
      validateDate(payment_date, 'payment_date'),
      validateEnum(payment_method, ['cash', 'bank_transfer', 'mobile_money', 'card', 'other'], 'payment_method')
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(gig_id) as any;
    if (!gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Get ALL roles for this worker on this gig
    const workerRoles = db.prepare(
      'SELECT role FROM gig_workers WHERE gig_id = ? AND worker_id = ?'
    ).all(gig_id, worker_id) as any[];

    if (workerRoles.length === 0) {
      return NextResponse.json({ error: 'Worker not assigned to this gig' }, { status: 400 });
    }

    // Get full gig_worker rows to check for custom_split
    const workerAssignments = db.prepare(
      'SELECT role, custom_split FROM gig_workers WHERE gig_id = ? AND worker_id = ?'
    ).all(gig_id, worker_id) as any[];

    // Calculate expected amount for ALL roles combined
    let expectedPerWorker = 0;
    for (const wr of workerAssignments) {
      const split = wr.custom_split
        ? wr.custom_split
        : wr.role === 'photographer' ? gig.photographer_split : gig.retoucher_split;
      const roleCount = db.prepare(
        'SELECT COUNT(*) as count FROM gig_workers WHERE gig_id = ? AND role = ?'
      ).get(gig_id, wr.role) as any;
      expectedPerWorker += (gig.total_amount * split) / 100 / roleCount.count;
    }

    // Check existing payments for this worker on this gig
    const existingPayments = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM worker_payments WHERE gig_id = ? AND worker_id = ?'
    ).get(gig_id, worker_id) as any;

    if (existingPayments.total + amount > expectedPerWorker + 0.01) {
      return NextResponse.json(
        { error: `Payment exceeds expected. Expected: ${expectedPerWorker.toFixed(2)}, Already paid: ${existingPayments.total}` },
        { status: 400 }
      );
    }

    // Prevent duplicate payment for same date
    const existingSameDate = db.prepare(
      'SELECT id FROM worker_payments WHERE gig_id = ? AND worker_id = ? AND payment_date = ?'
    ).get(gig_id, worker_id, payment_date) as any;

    if (existingSameDate) {
      return NextResponse.json(
        { error: 'Payment already recorded for this worker on this date' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      INSERT INTO worker_payments (gig_id, worker_id, amount, payment_date, payment_method, reference_number, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
    `).run(
      gig_id, worker_id, amount, payment_date,
      payment_method || 'cash', reference_number || null, notes || null
    );

    return NextResponse.json({ id: result.lastInsertRowid, message: 'Worker payment recorded' });
  } catch (error) {
    console.error('Error recording worker payment:', error);
    return NextResponse.json({ error: 'Failed to record worker payment' }, { status: 500 });
  }
}

// DELETE /api/payments/worker?id=X - Delete a worker payment
export async function DELETE(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const payment = db.prepare('SELECT * FROM worker_payments WHERE id = ?').get(id) as any;
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM worker_payments WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting worker payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
