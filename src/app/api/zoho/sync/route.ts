import { NextResponse } from 'next/server';
import { getZohoSettings, fetchAllInvoices } from '@/lib/zoho';
import getDb from '@/lib/db';
import { requireOwner } from '@/lib/api-auth';
import type { ZohoInvoice } from '@/lib/types';

interface InvoiceWithGig {
  id: number;
  gig_id: number | null;
}

export async function POST() {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  const settings = getZohoSettings();
  if (!settings) {
    return NextResponse.json({ error: 'Zoho not configured' }, { status: 400 });
  }

  try {
    const zohoInvoices = await fetchAllInvoices(settings) as ZohoInvoice[];
    const db = getDb();
    let created = 0;
    let updated = 0;
    let paymentsRecorded = 0;

    for (const inv of zohoInvoices) {
      const amountPaid = inv.total - inv.balance;
      // For paid invoices, balance should always be 0
      const invoiceBalance = inv.status === 'paid' ? 0 : inv.balance;
      const invoiceAmountPaid = inv.status === 'paid' ? inv.total : amountPaid;
      const existing = db.prepare('SELECT id, gig_id FROM invoices WHERE zoho_invoice_id = ?').get(inv.zoho_id) as InvoiceWithGig | null;

      if (existing) {
        db.prepare(`
          UPDATE invoices SET
            invoice_number = ?, client_name = ?, amount = ?,
            total_amount = ?, amount_paid = ?, balance = ?,
            due_date = ?, status = ?
          WHERE zoho_invoice_id = ?
        `).run(inv.invoice_number, inv.customer_name, inv.total, inv.total, invoiceAmountPaid, invoiceBalance, inv.due_date || null, inv.status, inv.zoho_id);
        updated++;
      } else {
        db.prepare(`
          INSERT INTO invoices (invoice_number, client_name, amount, total_amount, amount_paid, balance, due_date, status, source, zoho_invoice_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'zoho', ?)
        `).run(inv.invoice_number, inv.customer_name, inv.total, inv.total, invoiceAmountPaid, invoiceBalance, inv.due_date || null, inv.status, inv.zoho_id);
        created++;
      }

      // Auto-record client payment if invoice has been paid or partially paid
      if (invoiceAmountPaid > 0) {
        const invoice = db.prepare('SELECT id, gig_id FROM invoices WHERE zoho_invoice_id = ?').get(inv.zoho_id) as InvoiceWithGig | null;
        if (invoice && invoice.gig_id) {
          // Check if payment already recorded for this invoice
          const existingPayment = db.prepare(
            'SELECT id FROM client_payments WHERE invoice_id = ?'
          ).get(invoice.id);

          if (!existingPayment) {
            // Record the payment
            db.prepare(`
              INSERT INTO client_payments (gig_id, invoice_id, amount, payment_date, payment_method, notes)
              VALUES (?, ?, ?, ?, 'bank_transfer', ?)
            `).run(
              invoice.gig_id,
              invoice.id,
              amountPaid,
              inv.date || new Date().toISOString().split('T')[0],
              `Auto-synced from Zoho Invoice ${inv.invoice_number}`
            );
            paymentsRecorded++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      total: zohoInvoices.length,
      paymentsRecorded,
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}