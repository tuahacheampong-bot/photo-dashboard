import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth, requireOwner, validateRequired, validatePositiveNumber, validateEmail, validateDate, validateLength, firstError } from '@/lib/api-auth';
import type { Invoice, GigWorkerInput } from '@/lib/types';

interface InvoiceWithGig extends Invoice {
  gig_title?: string | null;
}

// GET /api/invoices - List all invoices
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const withoutGig = searchParams.get('without_gig');

    let query = `SELECT i.* FROM invoices i`;
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (status && status !== 'all') {
      conditions.push('i.status = ?');
      params.push(status);
    }
    if (source && source !== 'all') {
      conditions.push('i.source = ?');
      params.push(source);
    }
    if (search) {
      conditions.push('(i.invoice_number LIKE ? OR i.client_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (withoutGig === 'true') {
      conditions.push('i.gig_id IS NULL');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY i.created_at DESC';

    const invoices = await db.prepare(query).all(...params) as InvoiceWithGig[];
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

// POST /api/invoices - Create a new invoice or create gig from invoice
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const body = await request.json() as {
      action?: string;
      invoice_id?: number;
      title?: string;
      gig_date?: string;
      location?: string | null;
      description?: string | null;
      photographer_split?: number;
      retoucher_split?: number;
      workers?: GigWorkerInput[];
      gig_id?: number | null;
      invoice_number?: string;
      client_name?: string;
      client_email?: string | null;
      amount?: number;
      tax_amount?: number;
      total_amount?: number;
      due_date?: string | null;
      status?: string;
      source?: string;
      zoho_invoice_id?: string | null;
    };

    // Create gig from invoice
    if (body.action === 'create_gig_from_invoice') {
      const { invoice_id, title, gig_date, location, description, photographer_split, retoucher_split, workers } = body;

      if (!invoice_id) {
        return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
      }

      const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id) as Invoice | null;
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      // Check if invoice already has a gig linked
      if (invoice.gig_id) {
        return NextResponse.json({ error: 'This invoice already has a gig linked', gig_id: invoice.gig_id }, { status: 400 });
      }

      const err = firstError(
        validateDate(gig_date, 'gig_date'),
        validateLength(title, 'title', { max: 200 })
      );
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }

      // Create the gig
      const gigResult = db.prepare(`
        INSERT INTO gigs (title, client_name, client_email, client_phone, gig_date, location, description, total_amount, photographer_split, retoucher_split, invoice_reference, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title || `Gig - ${invoice.client_name}`,
        invoice.client_name,
        invoice.client_email || null,
        invoice.client_phone || null,
        gig_date || invoice.due_date || new Date().toISOString().split('T')[0],
        location || null,
        description || null,
        invoice.total_amount,
        photographer_split || 30,
        retoucher_split || 30,
        invoice.invoice_number,
        invoice.status === 'paid' ? 'completed' : 'pending'
      );

      const gigId = gigResult.lastInsertRowid;

      // Link invoice to gig
      await db.prepare('UPDATE invoices SET gig_id = ? WHERE id = ?').run(gigId, invoice_id);

      // Add workers if provided
      if (workers && workers.length > 0) {
        const insertWorker = db.prepare(
          'INSERT INTO gig_workers (gig_id, worker_id, role, custom_split) VALUES (?, ?, ?, ?)'
        );
        for (const worker of workers) {
          insertWorker.run(gigId, worker.worker_id, worker.role, worker.custom_split ?? null);
        }
      }

      // If invoice has been paid, record the payment
      if (invoice.amount_paid > 0) {
        // Check for existing payment for this gig
        const existingPayment = await db.prepare(
          'SELECT id FROM client_payments WHERE gig_id = ?'
        ).get(gigId);

        // Also check if payment amount is valid
        if (!existingPayment && invoice.amount_paid <= invoice.total_amount && invoice.amount_paid > 0) {
          const paymentDate = invoice.due_date || new Date().toISOString().split('T')[0];
          db.prepare(`
            INSERT INTO client_payments (gig_id, invoice_id, amount, payment_date, payment_method, notes)
            VALUES (?, ?, ?, ?, 'bank_transfer', ?)
          `).run(
            gigId,
            invoice_id,
            invoice.amount_paid,
            paymentDate,
            `Payment from Zoho Invoice ${invoice.invoice_number}`
          );
        }
      }

      return NextResponse.json({ gig_id: gigId, message: 'Gig created from invoice' });
    }

    // Link existing gig to invoice
    if (body.action === 'link_gig_to_invoice') {
      const { invoice_id, gig_id } = body;

      if (!invoice_id || !gig_id) {
        return NextResponse.json({ error: 'invoice_id and gig_id are required' }, { status: 400 });
      }

      const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id) as Invoice | null;
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      if (invoice.gig_id) {
        return NextResponse.json({ error: 'This invoice already has a gig linked', gig_id: invoice.gig_id }, { status: 400 });
      }

      const gig = await db.prepare('SELECT * FROM gigs WHERE id = ?').get(gig_id) as any | null;
      if (!gig) {
        return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
      }

      // Link invoice to gig
      await db.prepare('UPDATE invoices SET gig_id = ? WHERE id = ?').run(gig_id, invoice_id);

      // Update gig with invoice reference
      await db.prepare('UPDATE gigs SET invoice_reference = ? WHERE id = ?').run(invoice.invoice_number, gig_id);

      // If invoice has been paid, record the payment
      if (invoice.amount_paid > 0) {
        // Check for existing payment for this gig
        const existingPayment = await db.prepare(
          'SELECT id FROM client_payments WHERE gig_id = ?'
        ).get(gig_id);

        if (!existingPayment && invoice.amount_paid <= invoice.total_amount && invoice.amount_paid > 0) {
          const paymentDate = invoice.due_date || new Date().toISOString().split('T')[0];
          db.prepare(`
            INSERT INTO client_payments (gig_id, invoice_id, amount, payment_date, payment_method, notes)
            VALUES (?, ?, ?, ?, 'bank_transfer', ?)
          `).run(
            gig_id,
            invoice_id,
            invoice.amount_paid,
            invoice.due_date || new Date().toISOString().split('T')[0],
            `Payment from Zoho Invoice ${invoice.invoice_number}`
          );
        }
      }

      return NextResponse.json({ message: 'Gig linked to invoice successfully' });
    }

    // Regular invoice creation
    const {
      gig_id, invoice_number, client_name, amount, tax_amount,
      total_amount, due_date, status, source, zoho_invoice_id
    } = body;

    const err = firstError(
      validateRequired(body, ['invoice_number', 'client_name', 'total_amount']),
      validatePositiveNumber(total_amount, 'total_amount'),
      validateEmail(body.client_email, 'client_email'),
      validateDate(due_date, 'due_date'),
      validateLength(invoice_number, 'invoice_number', { min: 1, max: 100 }),
      validateLength(client_name, 'client_name', { min: 1, max: 200 })
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO invoices (gig_id, invoice_number, client_name, amount, tax_amount, total_amount, due_date, status, source, zoho_invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      gig_id ?? null, invoice_number, client_name, amount || total_amount,
      tax_amount || 0, total_amount, due_date ?? null,
      status || 'pending', source || 'manual', zoho_invoice_id ?? null
    );

    return NextResponse.json({ id: result.lastInsertRowid, message: 'Invoice created successfully' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE /api/invoices?id=X - Delete an invoice
export async function DELETE(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Unlink from gig if linked
    await db.prepare('UPDATE invoices SET gig_id = NULL WHERE id = ?').run(id);

    // Delete the invoice
    await db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

    return NextResponse.json({ ok: true, message: 'Invoice deleted' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}