import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import type { ClientPayment, WorkerPayment } from '@/lib/types';

interface ClientPaymentDetail extends ClientPayment {
  gig_title: string;
  client_name: string;
}

interface WorkerPaymentDetail extends WorkerPayment {
  gig_title: string;
  worker_name: string;
}

// GET /api/payments - List all payments
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // client, worker, all
    const status = searchParams.get('status');

    let clientPayments: ClientPaymentDetail[] = [];
    let workerPayments: WorkerPaymentDetail[] = [];

    if (type === 'client' || type === 'all') {
      let query = `
        SELECT cp.*, g.title as gig_title, g.client_name
        FROM client_payments cp
        JOIN gigs g ON cp.gig_id = g.id
      `;
      const conditions: string[] = [];
      const params: (string | number | null)[] = [];

      if (status) {
        conditions.push('cp.status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY cp.payment_date DESC';

      clientPayments = db.prepare(query).all(...params) as ClientPaymentDetail[];
    }

    if (type === 'worker' || type === 'all') {
      let query = `
        SELECT wp.*, g.title as gig_title, w.name as worker_name
        FROM worker_payments wp
        JOIN gigs g ON wp.gig_id = g.id
        JOIN workers w ON wp.worker_id = w.id
      `;
      const conditions: string[] = [];
      const params: (string | number | null)[] = [];

      if (status) {
        conditions.push('wp.status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY wp.payment_date DESC';

      workerPayments = db.prepare(query).all(...params) as WorkerPaymentDetail[];
    }

    return NextResponse.json({ client_payments: clientPayments, worker_payments: workerPayments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}