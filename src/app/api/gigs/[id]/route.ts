import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth, requireOwner, validateRequired, validatePositiveNumber, validateEmail, validateDate, validateLength, validateEnum, firstError } from '@/lib/api-auth';

// GET /api/gigs/[id] - Get a single gig
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid gig ID' }, { status: 400 });
    }

    const gig = db.prepare(`
      SELECT g.*,
        COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) as total_paid,
        g.total_amount - COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) as outstanding,
        COALESCE((SELECT SUM(amount) FROM worker_payments WHERE gig_id = g.id AND status = 'paid'), 0) as worker_paid,
        COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) - COALESCE((SELECT SUM(amount) FROM worker_payments WHERE gig_id = g.id AND status = 'paid'), 0) as net_profit
      FROM gigs g
      WHERE g.id = ?
    `).get(id) as any;

    if (!gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Get workers assigned to this gig
    const workers = db.prepare(`
      SELECT gw.*, w.name as worker_name, w.skills, w.phone, w.email
      FROM gig_workers gw
      JOIN workers w ON gw.worker_id = w.id
      WHERE gw.gig_id = ?
    `).all(id);

    // Get client payments for this gig
    const payments = db.prepare(`
      SELECT * FROM client_payments WHERE gig_id = ? ORDER BY payment_date DESC
    `).all(id);

    // Get worker payments for this gig
    const workerPayments = db.prepare(`
      SELECT wp.*, w.name as worker_name
      FROM worker_payments wp
      JOIN workers w ON wp.worker_id = w.id
      WHERE wp.gig_id = ?
      ORDER BY wp.payment_date DESC
    `).all(id);

    // Calculate payment breakdown
    const photographerSplit = gig.photographer_split || 30;
    const retoucherSplit = gig.retoucher_split || 30;
    const businessSplit = 100 - photographerSplit - retoucherSplit;

    const photographers = workers.filter((w: any) => w.role === 'photographer');
    const retouchers = workers.filter((w: any) => w.role === 'retoucher');

    const photographerTotal = (gig.total_amount * photographerSplit) / 100;
    const retoucherTotal = (gig.total_amount * retoucherSplit) / 100;
    const businessTotal = (gig.total_amount * businessSplit) / 100;

    const perPhotographer = photographers.length > 0 ? photographerTotal / photographers.length : 0;
    const perRetoucher = retouchers.length > 0 ? retoucherTotal / retouchers.length : 0;

    return NextResponse.json({
      ...gig,
      workers,
      payments,
      worker_payments: workerPayments,
      breakdown: {
        photographer_split: photographerSplit,
        retoucher_split: retoucherSplit,
        business_split: businessSplit,
        photographer_total: photographerTotal,
        retoucher_total: retoucherTotal,
        business_total: businessTotal,
        per_photographer: perPhotographer,
        per_retoucher: perRetoucher,
        photographers: photographers.map((p: any) => ({
          ...p,
          amount: perPhotographer,
        })),
        retouchers: retouchers.map((r: any) => ({
          ...r,
          amount: perRetoucher,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching gig:', error);
    return NextResponse.json({ error: 'Failed to fetch gig' }, { status: 500 });
  }
}

// PUT /api/gigs/[id] - Update a gig
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid gig ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      title, client_name, client_email, client_phone,
      gig_date, location, description, total_amount,
      photographer_split, retoucher_split, invoice_reference,
      status, workers
    } = body;

    // Validate required fields
    const err = firstError(
      validateRequired(body, ['title', 'client_name', 'gig_date', 'total_amount']),
      validatePositiveNumber(total_amount, 'total_amount'),
      validateEmail(client_email, 'client_email'),
      validateDate(gig_date, 'gig_date'),
      validateLength(title, 'title', { min: 1, max: 200 }),
      validateLength(client_name, 'client_name', { min: 1, max: 200 }),
      validateEnum(status, ['pending', 'in_progress', 'completed', 'cancelled'], 'status')
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    db.prepare(`
      UPDATE gigs SET
        title = ?, client_name = ?, client_email = ?, client_phone = ?,
        gig_date = ?, location = ?, description = ?, total_amount = ?,
        photographer_split = ?, retoucher_split = ?,
        invoice_reference = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, client_name, client_email || null, client_phone || null,
      gig_date, location || null, description || null, total_amount,
      photographer_split || 30, retoucher_split || 30,
      invoice_reference || null, status || 'pending', id
    );

    // Update workers if provided
    if (workers !== undefined) {
      db.prepare('DELETE FROM gig_workers WHERE gig_id = ?').run(id);
      if (workers && workers.length > 0) {
        const insertWorker = db.prepare(
          'INSERT INTO gig_workers (gig_id, worker_id, role, custom_split) VALUES (?, ?, ?, ?)'
        );
        for (const worker of workers) {
          insertWorker.run(id, worker.worker_id, worker.role, worker.custom_split || null);
        }
      }
    }

    return NextResponse.json({ message: 'Gig updated successfully' });
  } catch (error) {
    console.error('Error updating gig:', error);
    return NextResponse.json({ error: 'Failed to update gig' }, { status: 500 });
  }
}

// DELETE /api/gigs/[id] - Delete a gig
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid gig ID' }, { status: 400 });
    }

    db.prepare('DELETE FROM gigs WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Gig deleted successfully' });
  } catch (error) {
    console.error('Error deleting gig:', error);
    return NextResponse.json({ error: 'Failed to delete gig' }, { status: 500 });
  }
}
