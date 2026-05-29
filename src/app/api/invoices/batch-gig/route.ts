import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireOwner, validateRequired, validateDate, validateLength, firstError } from '@/lib/api-auth';

// POST /api/invoices/batch-gig - Create gigs from multiple invoices
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const body = await request.json();
    const { invoice_ids, defaults } = body;

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json({ error: 'Select at least one invoice' }, { status: 400 });
    }

    if (invoice_ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 invoices per batch' }, { status: 400 });
    }

    const d = defaults || {};
    const photoSplit = parseFloat(d.photographer_split) || 30;
    const retouchSplit = parseFloat(d.retoucher_split) || 30;

    const created: { gig_id: number; invoice_id: number; title: string }[] = [];
    const errors: { invoice_id: number; error: string }[] = [];

    // Fetch all invoices
    const placeholders = invoice_ids.map(() => '?').join(',');
    const invoices = db.prepare(`SELECT * FROM invoices WHERE id IN (${placeholders})`).all(...invoice_ids) as any[];

    const invoiceMap = new Map<number, any>();
    for (const inv of invoices) {
      invoiceMap.set(inv.id, inv);
    }

    for (const invId of invoice_ids) {
      const invoice = invoiceMap.get(invId);
      if (!invoice) {
        errors.push({ invoice_id: invId, error: 'Invoice not found' });
        continue;
      }

      if (invoice.gig_id) {
        errors.push({ invoice_id: invId, error: 'Already has a gig linked' });
        continue;
      }

      const gigDate = invoice.due_date || new Date().toISOString().split('T')[0];
      const title = `Gig - ${invoice.client_name}`;

      const err = firstError(
        validateLength(title, 'title', { min: 1, max: 200 }),
        validateDate(gigDate, 'gig_date')
      );
      if (err) {
        errors.push({ invoice_id: invId, error: err });
        continue;
      }

      try {
        // Create the gig
        const gigResult = db.prepare(`
          INSERT INTO gigs (title, client_name, client_email, client_phone, gig_date, location, description, total_amount, photographer_split, retoucher_split, invoice_reference, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          title,
          invoice.client_name,
          invoice.client_email || null,
          invoice.client_phone || null,
          gigDate,
          null,
          null,
          invoice.total_amount,
          photoSplit,
          retouchSplit,
          invoice.invoice_number,
          invoice.status === 'paid' ? 'completed' : 'pending'
        );

        const gigId = Number(gigResult.lastInsertRowid);

        // Link invoice to gig
        db.prepare('UPDATE invoices SET gig_id = ? WHERE id = ?').run(gigId, invId);

        // If invoice has been paid, record the payment
        if (invoice.amount_paid > 0) {
          const paymentDate = invoice.due_date || new Date().toISOString().split('T')[0];
          db.prepare(`
            INSERT INTO client_payments (gig_id, invoice_id, amount, payment_date, payment_method, notes)
            VALUES (?, ?, ?, ?, 'bank_transfer', ?)
          `).run(
            gigId,
            invId,
            invoice.amount_paid,
            paymentDate,
            `Payment from Invoice ${invoice.invoice_number}`
          );
        }

        created.push({ gig_id: gigId, invoice_id: invId, title });
      } catch (e: any) {
        errors.push({ invoice_id: invId, error: e.message || 'Failed to create gig' });
      }
    }

    return NextResponse.json({
      message: `${created.length} gig${created.length !== 1 ? 's' : ''} created${errors.length > 0 ? `, ${errors.length} skipped` : ''}`,
      created,
      errors,
    });
  } catch (error) {
    console.error('Error batch creating gigs from invoices:', error);
    return NextResponse.json({ error: 'Failed to create gigs' }, { status: 500 });
  }
}
