import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import { StatCard, MiniStat } from '@/components/dashboard';
import { getDashboardStats, getRecentGigs, getMonthlyRevenue, getMonthlyExpenses, getTopWorkerEarnings } from '@/lib/queries';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const stats = await getDashboardStats();
  const recentGigs = await getRecentGigs(5);
  const monthlyRevenue = await getMonthlyRevenue(6);
  const monthlyExpenses = await getMonthlyExpenses(6);
  const workerEarnings = await getTopWorkerEarnings(5);

  const outstandingBalance = stats.outstandingBalance;
  const netProfit = stats.netProfit;



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
          value={formatCurrency(stats.totalRevenue)}
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
          value={formatCurrency(stats.totalExpenses)}
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
        <MiniStat title="Total Gigs" value={stats.totalGigs} />
        <MiniStat title="Completed" value={stats.completedGigs} />
        <MiniStat title="Pending" value={stats.pendingGigs} />
        <MiniStat title="Worker Payments" value={formatCurrency(stats.totalWorkerPayments)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Expenses (6 months)</h2>
          <div className="space-y-3">
            {monthlyRevenue.map((item) => {
              const expense = monthlyExpenses.find((e) => e.month === item.month)?.expenses || 0;
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
            {recentGigs.map((gig) => (
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
          {workerEarnings.map((worker, i: number) => (
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
