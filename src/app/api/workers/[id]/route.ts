import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth, requireOwner, validateRequired, validateEmail, validateLength, validateEnum, firstError } from '@/lib/api-auth';

// GET /api/workers/[id] - Get a single worker with full outstanding breakdown
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
      return NextResponse.json({ error: 'Invalid worker ID' }, { status: 400 });
    }

    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as any;
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Get all gig assignments with payment breakdown
    const gigAssignments = db.prepare(`
      SELECT gw.gig_id, gw.role, gw.custom_split,
             g.title, g.gig_date, g.total_amount, g.photographer_split, g.retoucher_split, g.status
      FROM gig_workers gw
      JOIN gigs g ON gw.gig_id = g.id
      WHERE gw.worker_id = ? AND g.status != 'cancelled'
      ORDER BY g.gig_date DESC
    `).all(id) as any[];

    // Compute per-gig breakdown (combine all roles for the same gig into one entry)
    let totalOwed = 0;
    let totalPaid = 0;

    // Group assignments by gig_id
    const gigMap = new Map<number, { roles: any[]; info: any }>();
    for (const assignment of gigAssignments) {
      const existing = gigMap.get(assignment.gig_id);
      if (existing) {
        existing.roles.push(assignment);
      } else {
        gigMap.set(assignment.gig_id, { roles: [assignment], info: assignment });
      }
    }

    const gigBreakdown = Array.from(gigMap.entries()).map(([gigId, { roles, info }]) => {
      // Sum owed across all roles for this gig
      let amountOwed = 0;
      for (const assignment of roles) {
        const split = assignment.custom_split
          ? assignment.custom_split
          : assignment.role === 'photographer'
            ? info.photographer_split
            : info.retoucher_split;

        const roleCount = db.prepare(
          'SELECT COUNT(*) as count FROM gig_workers WHERE gig_id = ? AND role = ?'
        ).get(gigId, assignment.role) as any;

        amountOwed += (info.total_amount * split) / 100 / roleCount.count;
      }

      // Sum payments for this worker on this gig (across all roles)
      const paymentResult = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM worker_payments WHERE gig_id = ? AND worker_id = ? AND status = 'paid'"
      ).get(gigId, id) as any;

      const amountPaid = paymentResult.total || 0;
      const outstanding = Math.max(0, amountOwed - amountPaid);

      totalOwed += amountOwed;
      totalPaid += amountPaid;

      // Build role labels
      const roleLabels = roles.map((r: any) => {
        const split = r.custom_split
          ? r.custom_split
          : r.role === 'photographer' ? info.photographer_split : info.retoucher_split;
        return `${r.role} (${split}%)`;
      });

      return {
        gig_id: gigId,
        title: info.title,
        gig_date: info.gig_date,
        gig_total: info.total_amount,
        role: roleLabels.join(' + '),
        split_percent: roles.reduce((sum: number, r: any) => {
          const s = r.custom_split
            ? r.custom_split
            : r.role === 'photographer' ? info.photographer_split : info.retoucher_split;
          return sum + s;
        }, 0),
        amount_owed: amountOwed,
        amount_paid: amountPaid,
        outstanding,
        status: info.status,
      };
    });

    // Get all individual payment records
    const paymentHistory = db.prepare(`
      SELECT wp.*, g.title as gig_title
      FROM worker_payments wp
      JOIN gigs g ON wp.gig_id = g.id
      WHERE wp.worker_id = ?
      ORDER BY wp.payment_date DESC
    `).all(id);

    return NextResponse.json({
      ...worker,
      total_owed: totalOwed,
      total_paid: totalPaid,
      outstanding: Math.max(0, totalOwed - totalPaid),
      gig_breakdown: gigBreakdown,
      payment_history: paymentHistory,
    });
  } catch (error) {
    console.error('Error fetching worker:', error);
    return NextResponse.json({ error: 'Failed to fetch worker' }, { status: 500 });
  }
}

// PUT /api/workers/[id] - Update a worker
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
      return NextResponse.json({ error: 'Invalid worker ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, email, phone, skills, rate_per_gig } = body;

    const err = firstError(
      validateRequired(body, ['name']),
      validateEmail(email, 'email'),
      validateLength(name, 'name', { min: 1, max: 200 }),
      validateEnum(skills, ['photographer', 'retoucher', 'both'], 'skills')
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    db.prepare(`
      UPDATE workers SET
        name = ?, email = ?, phone = ?, skills = ?, rate_per_gig = ?
      WHERE id = ?
    `).run(name, email || null, phone || null, skills || 'photographer', rate_per_gig || 0, id);

    return NextResponse.json({ message: 'Worker updated successfully' });
  } catch (error) {
    console.error('Error updating worker:', error);
    return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 });
  }
}

// DELETE /api/workers/[id] - Delete a worker
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
      return NextResponse.json({ error: 'Invalid worker ID' }, { status: 400 });
    }

    db.prepare('DELETE FROM workers WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Worker deleted successfully' });
  } catch (error) {
    console.error('Error deleting worker:', error);
    return NextResponse.json({ error: 'Failed to delete worker' }, { status: 500 });
  }
}
