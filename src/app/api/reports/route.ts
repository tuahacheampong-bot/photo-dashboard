import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth, validateEnum } from '@/lib/api-auth';

// GET /api/reports - Generate reports
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const period = searchParams.get('period') || 'month';
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const typeErr = validateEnum(type, ['summary', 'by_gig', 'by_worker', 'monthly', 'expense_by_category'], 'type');
    const periodErr = validateEnum(period, ['week', 'month', 'year'], 'period');
    if (typeErr || periodErr) {
      return NextResponse.json({ error: typeErr || periodErr }, { status: 400 });
    }

    // Default date range
    let dateFilter = '';
    let params: any[] = [];

    if (dateFrom && dateTo) {
      dateFilter = `AND gig_date BETWEEN ? AND ?`;
      params = [dateFrom, dateTo];
    } else if (period === 'month') {
      dateFilter = "AND gig_date >= date('now', 'start of month')";
    } else if (period === 'year') {
      dateFilter = "AND gig_date >= date('now', 'start of year')";
    } else if (period === 'week') {
      dateFilter = "AND gig_date >= date('now', '-7 days')";
    }

    if (type === 'summary') {
      const revenue = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM gigs WHERE status != 'cancelled' ${dateFilter}
      `).get(...params) as any;

      const expenses = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses WHERE 1=1 ${dateFilter.replace('gig_date', 'expense_date')}
      `).get(...params) as any;

      const clientPayments = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM client_payments WHERE 1=1 ${dateFilter.replace('gig_date', 'payment_date')}
      `).get(...params) as any;

      const workerPayments = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM worker_payments WHERE 1=1 ${dateFilter.replace('gig_date', 'payment_date')}
      `).get(...params) as any;

      const gigCount = db.prepare(`
        SELECT COUNT(*) as count FROM gigs WHERE status != 'cancelled' ${dateFilter}
      `).get(...params) as any;

      return NextResponse.json({
        revenue: revenue.total,
        expenses: expenses.total,
        client_payments: clientPayments.total,
        worker_payments: workerPayments.total,
        profit: clientPayments.total - expenses.total - workerPayments.total,
        outstanding: revenue.total - clientPayments.total,
        gig_count: gigCount.count,
      });
    }

    if (type === 'by_gig') {
      const gigs = db.prepare(`
        SELECT g.*,
          COALESCE(SUM(cp.amount), 0) as total_paid,
          g.total_amount - COALESCE(SUM(cp.amount), 0) as outstanding,
          (SELECT COALESCE(SUM(amount), 0) FROM worker_payments WHERE gig_id = g.id) as worker_cost
        FROM gigs g
        LEFT JOIN client_payments cp ON g.id = cp.gig_id
        WHERE g.status != 'cancelled' ${dateFilter}
        GROUP BY g.id
        ORDER BY g.gig_date DESC
      `).all(...params);

      return NextResponse.json(gigs);
    }

    if (type === 'by_worker') {
      const workers = db.prepare(`
        SELECT w.id, w.name, w.skills,
          COUNT(DISTINCT gw.gig_id) as gig_count,
          COALESCE(SUM(CASE WHEN wp.status = 'paid' THEN wp.amount ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN wp.status = 'pending' THEN wp.amount ELSE 0 END), 0) as pending_amount
        FROM workers w
        LEFT JOIN gig_workers gw ON w.id = gw.worker_id
        LEFT JOIN worker_payments wp ON w.id = wp.worker_id
        GROUP BY w.id
        ORDER BY total_earned DESC
      `).all();

      return NextResponse.json(workers);
    }

    if (type === 'monthly') {
      const months = db.prepare(`
        SELECT
          strftime('%Y-%m', gig_date) as month,
          SUM(total_amount) as revenue,
          COUNT(*) as gig_count
        FROM gigs
        WHERE status != 'cancelled'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `).all();

      const monthlyExpenses = db.prepare(`
        SELECT
          strftime('%Y-%m', expense_date) as month,
          SUM(amount) as expenses
        FROM expenses
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `).all();

      const monthlyWorkerPayments = db.prepare(`
        SELECT
          strftime('%Y-%m', payment_date) as month,
          SUM(amount) as worker_payments
        FROM worker_payments
        WHERE status = 'paid'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `).all();

      return NextResponse.json({ months, monthlyExpenses, monthlyWorkerPayments });
    }

    if (type === 'expense_by_category') {
      const categories = db.prepare(`
        SELECT ec.name, COALESCE(SUM(e.amount), 0) as total
        FROM expense_categories ec
        LEFT JOIN expenses e ON ec.id = e.category_id
        GROUP BY ec.id
        HAVING total > 0
        ORDER BY total DESC
      `).all();

      return NextResponse.json(categories);
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
