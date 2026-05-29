import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth, requireOwner, validateRequired, validatePositiveNumber, validateDate, firstError } from '@/lib/api-auth';

// GET /api/expenses - List all expenses
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');

    let query = `
      SELECT e.*, ec.name as category_name, g.title as gig_title
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN gigs g ON e.gig_id = g.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (category && category !== 'all') {
      conditions.push('e.category_id = ?');
      params.push(category);
    }

    if (dateFrom) {
      conditions.push('e.expense_date >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('e.expense_date <= ?');
      params.push(dateTo);
    }

    if (search) {
      conditions.push('(e.description LIKE ? OR ec.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY e.expense_date DESC';

    const expenses = db.prepare(query).all(...params);

    // Get categories
    const categories = db.prepare('SELECT * FROM expense_categories ORDER BY name').all();

    // Get summary
    const totalExpenses = db.prepare(
      conditions.length > 0
        ? `SELECT COALESCE(SUM(amount), 0) as total FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE ${conditions.join(' AND ')}`
        : 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses'
    ).get(...params) as any;

    return NextResponse.json({ expenses, categories, total: totalExpenses.total });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses - Create a new expense
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const body = await request.json();
    const { category_id, description, amount, expense_date, gig_id, receipt_reference, notes } = body;

    const err = firstError(
      validateRequired(body, ['description', 'amount', 'expense_date']),
      validatePositiveNumber(amount, 'amount'),
      validateDate(expense_date, 'expense_date')
    );
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO expenses (category_id, description, amount, expense_date, gig_id, receipt_reference, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      category_id || null, description, amount, expense_date,
      gig_id || null, receipt_reference || null, notes || null
    );

    return NextResponse.json({ id: result.lastInsertRowid, message: 'Expense recorded successfully' });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to record expense' }, { status: 500 });
  }
}
