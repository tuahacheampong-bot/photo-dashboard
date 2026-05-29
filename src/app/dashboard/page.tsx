import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import getDb from '@/lib/db';
import { formatCurrency } from '@/lib/utils';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const db = getDb();

  // Get stats
  const totalGigs = db.prepare('SELECT COUNT(*) as count FROM gigs').get() as any;
  const completedGigs = db.prepare("SELECT COUNT(*) as count FROM gigs WHERE status = 'completed'").get() as any;
  const pendingGigs = db.prepare("SELECT COUNT(*) as count FROM gigs WHERE status = 'pending'").get() as any;

  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM gigs WHERE status != 'cancelled'").get() as any;
  const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get() as any;
  const totalClientPayments = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM client_payments').get() as any;
  const totalWorkerPayments = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM worker_payments').get() as any;

  const outstandingBalance = (totalRevenue.total || 0) - (totalClientPayments.total || 0);
  const netProfit = (totalClientPayments.total || 0) - (totalExpenses.total || 0) - (totalWorkerPayments.total || 0);

  // Recent gigs
  const recentGigs = db.prepare(`
    SELECT g.*, 
      GROUP_CONCAT(DISTINCT gw.worker_id) as worker_ids
    FROM gigs g
    LEFT JOIN gig_workers gw ON g.id = gw.gig_id
    GROUP BY g.id
    ORDER BY g.gig_date DESC
    LIMIT 5
  `).all() as any[];

  // Monthly revenue (last 6 months)
  const monthlyRevenue = db.prepare(`
    SELECT 
      strftime('%Y-%m', gig_date) as month,
      SUM(total_amount) as revenue
    FROM gigs
    WHERE gig_date >= date('now', '-6 months') AND status != 'cancelled'
    GROUP BY month
    ORDER BY month
  `).all() as any[];

  // Monthly expenses (last 6 months)
  const monthlyExpenses = db.prepare(`
    SELECT 
      strftime('%Y-%m', expense_date) as month,
      SUM(amount) as expenses
    FROM expenses
    WHERE expense_date >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `).all() as any[];

  // Worker earnings summary
  const workerEarnings = db.prepare(`
    SELECT w.name, COALESCE(SUM(wp.amount), 0) as total_earned
    FROM workers w
    LEFT JOIN worker_payments wp ON w.id = wp.worker_id AND wp.status = 'paid'
    GROUP BY w.id
    ORDER BY total_earned DESC
    LIMIT 5
  `).all() as any[];



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {session.user?.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue.total || 0)}
          icon="💰"
          color="bg-green-50"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(outstandingBalance)}
          icon="⏳"
          color="bg-yellow-50"
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses.total || 0)}
          icon="📋"
          color="bg-red-50"
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(netProfit)}
          icon="📈"
          color={netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat title="Total Gigs" value={totalGigs.count || 0} />
        <MiniStat title="Completed" value={completedGigs.count || 0} />
        <MiniStat title="Pending" value={pendingGigs.count || 0} />
        <MiniStat title="Worker Payments" value={formatCurrency(totalWorkerPayments.total || 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Expenses (6 months)</h2>
          <div className="space-y-3">
            {monthlyRevenue.map((item: any) => {
              const expense = monthlyExpenses.find((e: any) => e.month === item.month)?.expenses || 0;
              const maxVal = Math.max(item.revenue, expense, 1);
              return (
                <div key={item.month} className="space-y-1">
                  <div className="text-sm text-gray-500">{item.month}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(item.revenue / maxVal) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-24 text-right">{formatCurrency(item.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full"
                        style={{ width: `${(expense / maxVal) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-24 text-right">{formatCurrency(expense)}</span>
                  </div>
                </div>
              );
            })}
            {monthlyRevenue.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">No data yet. Start adding gigs!</p>
            )}
          </div>
        </div>

        {/* Recent Gigs */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Gigs</h2>
          <div className="space-y-3">
            {recentGigs.map((gig: any) => (
              <div key={gig.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{gig.title}</p>
                  <p className="text-sm text-gray-500">{gig.client_name} • {gig.gig_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatCurrency(gig.total_amount)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    gig.status === 'completed' ? 'bg-green-100 text-green-700' :
                    gig.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {gig.status}
                  </span>
                </div>
              </div>
            ))}
            {recentGigs.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">No gigs yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Worker Earnings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Workers by Earnings</h2>
        <div className="space-y-3">
          {workerEarnings.map((worker: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">{worker.name.charAt(0)}</span>
                </div>
                <span className="font-medium text-gray-900">{worker.name}</span>
              </div>
              <span className="font-medium text-gray-900">{formatCurrency(worker.total_earned)}</span>
            </div>
          ))}
          {workerEarnings.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">No workers yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div className={`${color} rounded-2xl p-5 border-2 border-gray-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-700 uppercase">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
      <p className="text-sm font-bold text-gray-600 uppercase">{title}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
