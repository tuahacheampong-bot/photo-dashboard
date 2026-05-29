import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getZohoSettings, createZohoInvoice } from '@/lib/zoho';
import { requireAuth, requireOwner, validateRequired, validatePositiveNumber, validateEmail, validateDate, validateLength, validateEnum, firstError } from '@/lib/api-auth';

// GET /api/gigs - List all gigs
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let query = `
      SELECT g.*,
        GROUP_CONCAT(DISTINCT w.name) as worker_names,
        GROUP_CONCAT(DISTINCT gw.role || ':' || w.name) as worker_roles,
        COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) as total_paid,
        g.total_amount - COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) as outstanding,
        COALESCE((SELECT SUM(amount) FROM worker_payments WHERE gig_id = g.id AND status = 'paid'), 0) as worker_paid,
        COALESCE((SELECT SUM(amount) FROM client_payments WHERE gig_id = g.id), 0) - COALESCE((SELECT SUM(amount) FROM worker_payments WHERE gig_id = g.id AND status = 'paid'), 0) as net_profit
      FROM gigs g
      LEFT JOIN gig_workers gw ON g.id = gw.gig_id
      LEFT JOIN workers w ON gw.worker_id = w.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('g.status = ?');
      params.push(status);
    }

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
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY g.id ORDER BY g.gig_date DESC';

    const gigs = db.prepare(query).all(...params);
    return NextResponse.json(gigs);
  } catch (error) {
    console.error('Error fetching gigs:', error);
    return NextResponse.json({ error: 'Failed to fetch gigs' }, { status: 500 });
  }
}

// POST /api/gigs - Create a new gig
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const body = await request.json();
    const {
      title, client_name, client_email, client_phone,
      gig_date, location, description, total_amount,
      photographer_split, retoucher_split, invoice_reference,
      status, workers, create_invoice, invoice_number, invoice_due_date
    } = body;

    // Validate required fields
    const err = firstError(
      validateRequired(body, ['title', 'client_name', 'gig_date', 'total_amount']),
      validatePositiveNumber(total_amount, 'total_amount'),
      validateEmail(client_email, 'client_email'),
      validateDate(gig_date, 'gig_date'),
      validateLength(title, 'title', { min: 1, max: 200 }),
      validateLength(client_name, 'client_name', { min: 1, max: 200 }),
      validateEnum(status, ['pending', 'in_progress', 'completed'], 'status')
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO gigs (title, client_name, client_email, client_phone, gig_date, location, description, total_amount, photographer_split, retoucher_split, invoice_reference, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, client_name, client_email || null, client_phone || null,
      gig_date, location || null, description || null, total_amount,
      photographer_split || 30, retoucher_split || 30,
      invoice_reference || null, status || 'pending'
    );

    const gigId = result.lastInsertRowid;

    // Add workers to the gig
    if (workers && workers.length > 0) {
      const insertWorker = db.prepare(
        'INSERT INTO gig_workers (gig_id, worker_id, role, custom_split) VALUES (?, ?, ?, ?)'
      );
      for (const worker of workers) {
        insertWorker.run(gigId, worker.worker_id, worker.role, worker.custom_split || null);
      }
    }

    // Create invoice if requested
    let invoiceId = null;
    let zohoInvoiceId = null;
    if (create_invoice && total_amount > 0) {
      const invNumber = invoice_number || `INV-${Date.now().toString().slice(-6)}`;
      const invResult = db.prepare(`
        INSERT INTO invoices (gig_id, invoice_number, client_name, client_email, client_phone, amount, total_amount, due_date, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
      `).run(
        gigId, invNumber, client_name, client_email || null, client_phone || null,
        total_amount, total_amount, invoice_due_date || null,
        status === 'completed' ? 'paid' : 'pending'
      );
      invoiceId = invResult.lastInsertRowid;

      // Try to create invoice on Zoho
      const zohoSettings = getZohoSettings();
      if (zohoSettings) {
        try {
          const zohoResult = await createZohoInvoice(zohoSettings, {
            customer_name: client_name,
            customer_email: client_email || undefined,
            invoice_number: invNumber,
            date: gig_date,
            due_date: invoice_due_date || undefined,
            total: total_amount,
            description: title,
          });
          if (zohoResult) {
            zohoInvoiceId = zohoResult.invoice_id;
            db.prepare('UPDATE invoices SET source = ?, zoho_invoice_id = ? WHERE id = ?')
              .run('zoho', zohoInvoiceId, invoiceId);
          }
        } catch (e) {
          console.error('Failed to create Zoho invoice:', e);
        }
      }

      // Link invoice to gig
      db.prepare('UPDATE gigs SET invoice_reference = ? WHERE id = ?').run(invNumber, gigId);
    }

    return NextResponse.json({ id: gigId, invoice_id: invoiceId, message: 'Gig created successfully' });
  } catch (error) {
    console.error('Error creating gig:', error);
    return NextResponse.json({ error: 'Failed to create gig' }, { status: 500 });
  }
}
