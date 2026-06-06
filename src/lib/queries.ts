import getDb from './db';
import type { MonthlyData, WorkerEarnings, RecentGig, DashboardStats } from './types';

interface CountResult { count: number; }
interface SumResult { total: number; }

export function getDashboardStats(): DashboardStats {
  const db = getDb();

  const totalGigs = db.prepare('SELECT COUNT(*) as count FROM gigs').get() as CountResult;
  const completedGigs = db.prepare("SELECT COUNT(*) as count FROM gigs WHERE status = 'completed'").get() as CountResult;
  const pendingGigs = db.prepare("SELECT COUNT(*) as count FROM gigs WHERE status = 'pending'").get() as CountResult;

  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM gigs WHERE status != 'cancelled'").get() as SumResult;
  const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get() as SumResult;
  const totalClientPayments = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM client_payments').get() as SumResult;
  const totalWorkerPayments = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM worker_payments').get() as SumResult;

  const outstandingBalance = (totalRevenue.total || 0) - (totalClientPayments.total || 0);
  const netProfit = (totalClientPayments.total || 0) - (totalExpenses.total || 0) - (totalWorkerPayments.total || 0);

  return {
    totalGigs: totalGigs.count || 0,
    completedGigs: completedGigs.count || 0,
    pendingGigs: pendingGigs.count || 0,
    totalRevenue: totalRevenue.total || 0,
    totalExpenses: totalExpenses.total || 0,
    totalClientPayments: totalClientPayments.total || 0,
    totalWorkerPayments: totalWorkerPayments.total || 0,
    outstandingBalance,
    netProfit,
  };
}

export function getRecentGigs(limit = 5): RecentGig[] {
  const db = getDb();
  return db.prepare(`
    SELECT g.*, 
      GROUP_CONCAT(DISTINCT gw.worker_id) as worker_ids
    FROM gigs g
    LEFT JOIN gig_workers gw ON g.id = gw.gig_id
    GROUP BY g.id
    ORDER BY g.gig_date DESC
    LIMIT ?
  `).all(limit) as RecentGig[];
}

export function getMonthlyRevenue(months = 6): MonthlyData[] {
  const db = getDb();
  return db.prepare(`
    SELECT 
      strftime('%Y-%m', gig_date) as month,
      SUM(total_amount) as revenue
    FROM gigs
    WHERE gig_date >= date('now', ?) AND status != 'cancelled'
    GROUP BY month
    ORDER BY month
  `).all(`-${months} months`) as MonthlyData[];
}

export function getMonthlyExpenses(months = 6): MonthlyData[] {
  const db = getDb();
  return db.prepare(`
    SELECT 
      strftime('%Y-%m', expense_date) as month,
      SUM(amount) as expenses
    FROM expenses
    WHERE expense_date >= date('now', ?)
    GROUP BY month
    ORDER BY month
  `).all(`-${months} months`) as MonthlyData[];
}

export function getTopWorkerEarnings(limit = 5): WorkerEarnings[] {
  const db = getDb();
  return db.prepare(`
    SELECT w.name, COALESCE(SUM(wp.amount), 0) as total_earned
    FROM workers w
    LEFT JOIN worker_payments wp ON w.id = wp.worker_id AND wp.status = 'paid'
    GROUP BY w.id
    ORDER BY total_earned DESC
    LIMIT ?
  `).all(limit) as WorkerEarnings[];
}