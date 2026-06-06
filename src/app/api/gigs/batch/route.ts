import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireOwner, validateRequired, validatePositiveNumber, validateDate, validateLength, validateEnum, firstError } from '@/lib/api-auth';

interface GigInput {
  title?: string;
  client_name?: string;
  client_email?: string | null;
  client_phone?: string | null;
  gig_date?: string;
  location?: string | null;
  description?: string | null;
  total_amount?: string | number;
  photographer_split?: string | number;
  retoucher_split?: string | number;
  invoice_reference?: string | null;
  status?: string;
}

interface DefaultsInput {
  photographer_split?: string | number;
  retoucher_split?: string | number;
  status?: string;
}

interface EnrichedGig {
  title: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  gig_date: string;
  location: string | null;
  description: string | null;
  total_amount: number;
  photographer_split: number;
  retoucher_split: number;
  invoice_reference: string | null;
  status: string;
  [key: string]: unknown;
}

// POST /api/gigs/batch - Create multiple gigs at once
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const body = await request.json() as { gigs: GigInput[]; defaults?: DefaultsInput };
    const { gigs, defaults } = body;

    if (!Array.isArray(gigs) || gigs.length === 0) {
      return NextResponse.json({ error: 'At least one gig is required' }, { status: 400 });
    }

    if (gigs.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 gigs per batch' }, { status: 400 });
    }

    // Apply defaults to each gig
    const d = defaults || {};
    const enrichedGigs = gigs.map((g: GigInput, i: number): EnrichedGig => ({
      title: g.title || `Gig ${i + 1}`,
      client_name: g.client_name || '',
      client_email: g.client_email || null,
      client_phone: g.client_phone || null,
      gig_date: g.gig_date || new Date().toISOString().split('T')[0],
      location: g.location || null,
      description: g.description || null,
      total_amount: parseFloat(String(g.total_amount)) || 0,
      photographer_split: parseFloat(String(g.photographer_split ?? d.photographer_split ?? 30)),
      retoucher_split: parseFloat(String(g.retoucher_split ?? d.retoucher_split ?? 30)),
      invoice_reference: g.invoice_reference || null,
      status: g.status || d.status || 'pending',
    }));

    // Validate each gig
    const errors: { index: number; error: string }[] = [];
    for (let i = 0; i < enrichedGigs.length; i++) {
      const g = enrichedGigs[i];
      const err = firstError(
        validateRequired(g, ['title', 'client_name', 'gig_date', 'total_amount']),
        validatePositiveNumber(g.total_amount, 'total_amount'),
        validateDate(g.gig_date, 'gig_date'),
        validateLength(g.title, 'title', { min: 1, max: 200 }),
        validateLength(g.client_name, 'client_name', { min: 1, max: 200 }),
        validateEnum(g.status, ['pending', 'in_progress', 'completed'], 'status')
      );
      if (err) {
        errors.push({ index: i + 1, error: err });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation errors', details: errors }, { status: 400 });
    }

    // Insert all gigs in a transaction
    const insertGig = db.prepare(`
      INSERT INTO gigs (title, client_name, client_email, client_phone, gig_date, location, description, total_amount, photographer_split, retoucher_split, invoice_reference, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const created: { id: number; title: string }[] = [];

    const transaction = db.transaction(() => {
      for (const g of enrichedGigs) {
        const result = insertGig.run(
          g.title, g.client_name, g.client_email, g.client_phone,
          g.gig_date, g.location, g.description, g.total_amount,
          g.photographer_split, g.retoucher_split,
          g.invoice_reference, g.status
        );
        created.push({ id: Number(result.lastInsertRowid), title: g.title });
      }
    });

    transaction();

    return NextResponse.json({
      message: `${created.length} gig${created.length > 1 ? 's' : ''} created successfully`,
      created,
    });
  } catch (error) {
    console.error('Error batch creating gigs:', error);
    return NextResponse.json({ error: 'Failed to create gigs' }, { status: 500 });
  }
}