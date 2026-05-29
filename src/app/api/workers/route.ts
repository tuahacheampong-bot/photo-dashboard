import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireAuth, requireOwner, validateRequired, validateEmail, validateLength, validateEnum, firstError } from '@/lib/api-auth';

// GET /api/workers - List all workers
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const skill = searchParams.get('skill');

    // Get basic worker info
    let query = `
      SELECT w.*
      FROM workers w
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(w.name LIKE ? OR w.email LIKE ? OR w.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (skill && skill !== 'all') {
      conditions.push('w.skills = ?');
      params.push(skill);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY w.name';

    const workers = db.prepare(query).all(...params) as any[];

    // Compute outstanding for each worker
    const enriched = workers.map((w: any) => {
      // Get all gigs this worker is assigned to
      const gigAssignments = db.prepare(`
        SELECT gw.gig_id, gw.role, gw.custom_split, g.total_amount, g.photographer_split, g.retoucher_split, g.status
        FROM gig_workers gw
        JOIN gigs g ON gw.gig_id = g.id
        WHERE gw.worker_id = ? AND g.status != 'cancelled'
      `).all(w.id) as any[];

      let totalOwed = 0;
      // Group by gig_id to count unique gigs and sum all roles per gig
      const gigMap = new Map<number, any[]>();
      for (const assignment of gigAssignments) {
        const existing = gigMap.get(assignment.gig_id);
        if (existing) {
          existing.push(assignment);
        } else {
          gigMap.set(assignment.gig_id, [assignment]);
        }
      }

      for (const [, roles] of gigMap) {
        for (const assignment of roles) {
          const split = assignment.custom_split
            ? assignment.custom_split
            : assignment.role === 'photographer'
              ? assignment.photographer_split
              : assignment.retoucher_split;

          const roleCount = db.prepare(
            'SELECT COUNT(*) as count FROM gig_workers WHERE gig_id = ? AND role = ?'
          ).get(assignment.gig_id, assignment.role) as any;

          totalOwed += (assignment.total_amount * split) / 100 / roleCount.count;
        }
      }

      // Total paid to this worker
      const paidResult = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM worker_payments WHERE worker_id = ? AND status = 'paid'"
      ).get(w.id) as any;

      const totalPaid = paidResult.total || 0;
      const outstanding = Math.max(0, totalOwed - totalPaid);
      const gigCount = gigMap.size;

      return {
        ...w,
        total_owed: totalOwed,
        total_paid: totalPaid,
        outstanding,
        gig_count: gigCount,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Error fetching workers:', error);
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });
  }
}

// POST /api/workers - Create a new worker
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const body = await request.json();
    const { name, email, phone, skills, rate_per_gig, create_account, password } = body;

    const err = firstError(
      validateRequired(body, ['name']),
      validateEmail(email, 'email'),
      validateLength(name, 'name', { min: 1, max: 200 }),
      validateEnum(skills, ['photographer', 'retoucher', 'both'], 'skills')
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    if (create_account && !password) {
      return NextResponse.json({ error: 'Password is required when creating an account' }, { status: 400 });
    }

    let userId = null;

    // Optionally create a user account for the worker
    if (create_account && email && password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare(
        'INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)'
      ).run(email, name, hashedPassword, 'worker');
      userId = result.lastInsertRowid;
    }

    const result = db.prepare(
      'INSERT INTO workers (user_id, name, email, phone, skills, rate_per_gig) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, name, email || null, phone || null, skills || 'photographer', rate_per_gig || 0);

    return NextResponse.json({ id: result.lastInsertRowid, message: 'Worker created successfully' });
  } catch (error: any) {
    console.error('Error creating worker:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Worker with this email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 });
  }
}
