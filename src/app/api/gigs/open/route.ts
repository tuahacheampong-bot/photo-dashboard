import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import type { Gig } from '@/lib/types';

interface OpenGig extends Gig {
  total_paid: number;
  outstanding: number;
  worker_count: number;
  assigned_workers: string | null;
}

// GET /api/gigs/open - List gigs without workers assigned (for workers to pick)
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let query = `
      SELECT g.*,
        COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) as total_paid,
        g.total_amount - COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) as outstanding,
        (SELECT COUNT(*) FROM gig_workers WHERE gig_id = g.id) as worker_count,
        GROUP_CONCAT(DISTINCT w.name) as assigned_workers
      FROM gigs g
      LEFT JOIN gig_workers gw ON g.id = gw.gig_id
      LEFT JOIN workers w ON gw.worker_id = w.id
      WHERE g.status != 'cancelled'
        AND g.id NOT IN (SELECT gig_id FROM gig_workers)
    `;

    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (search) {
      conditions.push('(g.title LIKE ? OR g.client_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (dateFrom) {
      conditions.push('g.gig_date >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('g.gig_date <= ?');
      params.push(dateTo);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' GROUP BY g.id ORDER BY g.gig_date ASC';

    const gigs = db.prepare(query).all(...params) as OpenGig[];
    return NextResponse.json(gigs);
  } catch (error) {
    console.error('Error fetching open gigs:', error);
    return NextResponse.json({ error: 'Failed to fetch open gigs' }, { status: 500 });
  }
}