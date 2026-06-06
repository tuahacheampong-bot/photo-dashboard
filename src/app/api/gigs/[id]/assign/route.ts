import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth, validateEnum } from '@/lib/api-auth';
import type { Gig, Worker, WorkerRole } from '@/lib/types';

interface RoleResult { role: WorkerRole; }

// POST /api/gigs/[id]/assign - Worker assigns themselves to a gig
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid gig ID' }, { status: 400 });
    }

    const body = await request.json() as { worker_id: number; role: WorkerRole };
    const { worker_id, role } = body;

    if (!worker_id || !role) {
      return NextResponse.json({ error: 'worker_id and role are required' }, { status: 400 });
    }

    const roleErr = validateEnum(role, ['photographer', 'retoucher'], 'role');
    if (roleErr) {
      return NextResponse.json({ error: roleErr }, { status: 400 });
    }

    // Check gig exists and is not cancelled
    const gig = await db.prepare("SELECT * FROM gigs WHERE id = ? AND status != 'cancelled'").get(id) as Gig | null;
    if (!gig) {
      return NextResponse.json({ error: 'Gig not found or cancelled' }, { status: 404 });
    }

    // Check worker exists
    const worker = await db.prepare('SELECT * FROM workers WHERE id = ?').get(worker_id) as Worker | null;
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Check if already assigned to this specific role
    const existing = await db.prepare(
      'SELECT id FROM gig_workers WHERE gig_id = ? AND worker_id = ? AND role = ?'
    ).get(id, worker_id, role);

    if (existing) {
      return NextResponse.json({ error: 'Already assigned to this role on this gig' }, { status: 400 });
    }

    // Assign worker to gig
    db.prepare(
      'INSERT INTO gig_workers (gig_id, worker_id, role) VALUES (?, ?, ?)'
    ).run(id, worker_id, role);

    // Check what roles they now have
    const allRoles = await db.prepare(
      'SELECT role FROM gig_workers WHERE gig_id = ? AND worker_id = ?'
    ).all(id, worker_id) as RoleResult[];

    const roleNames = allRoles.map((r) => r.role).join(' + ');

    return NextResponse.json({ message: `Assigned as ${role}. Worker now has: ${roleNames}` });
  } catch (error) {
    console.error('Error assigning worker:', error);
    return NextResponse.json({ error: 'Failed to assign worker' }, { status: 500 });
  }
}

// DELETE /api/gigs/[id]/assign - Worker removes themselves from a gig
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('worker_id');
    const role = searchParams.get('role');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid gig ID' }, { status: 400 });
    }

    if (!workerId) {
      return NextResponse.json({ error: 'worker_id is required' }, { status: 400 });
    }

    // Check if there are payments for this worker on this gig
    const payments = await db.prepare(
      'SELECT id FROM worker_payments WHERE gig_id = ? AND worker_id = ? LIMIT 1'
    ).get(id, workerId);

    if (payments) {
      return NextResponse.json(
        { error: 'Cannot remove worker — payments have been recorded. Delete payments first.' },
        { status: 400 }
      );
    }

    if (role) {
      await db.prepare('DELETE FROM gig_workers WHERE gig_id = ? AND worker_id = ? AND role = ?').run(id, workerId, role);
    } else {
      await db.prepare('DELETE FROM gig_workers WHERE gig_id = ? AND worker_id = ?').run(id, workerId);
    }

    return NextResponse.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Error removing assignment:', error);
    return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
  }
}
