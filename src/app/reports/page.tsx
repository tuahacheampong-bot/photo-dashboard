'use client';

import { useEffect, useState, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';

interface SummaryReport {
  revenue: number;
  expenses: number;
  client_payments: number;
  worker_payments: number;
  profit: number;
  outstanding: number;
  gig_count: number;
}

interface GigReport {
  id: number;
  title: string;
  client_name: string;
  gig_date: string;
  total_amount: number;
  status: string;
  total_paid: number;
  outstanding: number;
  worker_cost: number;
}

interface WorkerReport {
  id: number;
  name: string;
  skills: string;
  gig_count: number;
  total_earned: number;
  pending_amount: number;
}

interface MonthlyReport {
  month: string;
  revenue: number;
  gig_count: number;
}

interface MonthlyExpenseReport {
  month: string;
  expenses: number;
}

interface MonthlyWorkerPaymentReport {
  month: string;
  worker_payments: number;
}

interface MonthlyReportsResponse {
  months: MonthlyReport[];
  monthlyExpenses: MonthlyExpenseReport[];
  monthlyWorkerPayments: MonthlyWorkerPaymentReport[];
}

interface ExpenseCategoryReport {
  name: string;
  total: number;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [byGig, setByGig] = useState<GigReport[]>([]);
  const [byWorker, setByWorker] = useState<WorkerReport[]>([]);
  const [monthly, setMonthly] = useState<MonthlyReportsResponse | null>(null);
  const [expenseByCategory, setExpenseByCategory] = useState<ExpenseCategoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('summary');

  const loadedRef = useRef(false);

  const fetchReports = async () => {
    setLoading(true);
    const [summaryRes, gigRes, workerRes, monthlyRes, expenseRes] = await Promise.all([
      fetch(`/api/reports?type=summary&period=${period}`, { credentials: 'include' }),
      fetch(`/api/reports?type=by_gig&period=${period}`, { credentials: 'include' }),
      fetch(`/api/reports?type=by_worker`, { credentials: 'include' }),
      fetch(`/api/reports?type=monthly`, { credentials: 'include' }),
      fetch(`/api/reports?type=expense_by_category`, { credentials: 'include' }),
    ]);
    setSummary(await summaryRes.json());
    setByGig(await gigRes.json());
    setByWorker(await workerRes.json());
    setMonthly(await monthlyRes.json());
    setExpenseByCategory(await expenseRes.json());
    setLoading(false);
  };

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchReports();
    }
  }, [period, fetchReports]);

  const exportCSV = () => {
    let csv = '';
    if (activeTab === 'summary' && summary) {
      csv = 'Metric,Amount\n';
      csv += `Revenue,${summary.revenue}\n`;
      csv += `Expenses,${summary.expenses}\n`;
      csv += `Client Payments,${summary.client_payments}\n`;
      csv += `Worker Payments,${summary.worker_payments}\n`;
      csv += `Profit,${summary.profit}\n`;
      csv += `Outstanding,${summary.outstanding}\n`;
    } else if (activeTab === 'by_gig') {
      csv = 'Gig,Client,Date,Amount,Paid,Outstanding,Worker Cost\n';
      byGig.forEach((g: GigReport) => {
        csv += `"${g.title}","${g.client_name}",${g.gig_date},${g.total_amount},${g.total_paid},${g.outstanding},${g.worker_cost}\n`;
      });
    } else if (activeTab === 'by_worker') {
      csv = 'Worker,Skills,Gigs,Total Earned,Pending\n';
      byWorker.forEach((w: WorkerReport) => {
        csv += `"${w.name}",${w.skills},${w.gig_count},${w.total_earned},${w.pending_amount}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${activeTab}-${period}.csv`;
    a.click();
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading reports...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Business analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 font-semibold">
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <button onClick={exportCSV} className="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold hover:bg-gray-800 transition text-sm">
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {['summary', 'by_gig', 'by_worker', 'monthly', 'expense_by_category'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
            {tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-2xl p-5 border-2 border-green-200">
            <p className="text-sm font-bold text-green-700 uppercase">Revenue</p>
            <p className="text-2xl font-bold text-green-800">{formatCurrency(summary.revenue)}</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-5 border-2 border-red-200">
            <p className="text-sm font-bold text-red-700 uppercase">Expenses</p>
            <p className="text-2xl font-bold text-red-800">{formatCurrency(summary.expenses)}</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-5 border-2 border-blue-200">
            <p className="text-sm font-bold text-blue-700 uppercase">Worker Payments</p>
            <p className="text-2xl font-bold text-blue-800">{formatCurrency(summary.worker_payments)}</p>
          </div>
          <div className={`${summary.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} rounded-2xl p-5 border-2`}>
            <p className={`text-sm font-bold ${summary.profit >= 0 ? 'text-green-700' : 'text-red-700'} uppercase`}>Net Profit</p>
            <p className={`text-2xl font-bold ${summary.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>{formatCurrency(summary.profit)}</p>
          </div>
          <div className="bg-yellow-50 rounded-2xl p-5 border-2 border-yellow-200">
            <p className="text-sm font-bold text-yellow-700 uppercase">Outstanding</p>
            <p className="text-2xl font-bold text-yellow-800">{formatCurrency(summary.outstanding)}</p>
          </div>
          <div className="bg-purple-50 rounded-2xl p-5 border-2 border-purple-200">
            <p className="text-sm font-bold text-purple-700 uppercase">Gig Count</p>
            <p className="text-2xl font-bold text-purple-800">{summary.gig_count}</p>
          </div>
        </div>
      )}

      {activeTab === 'by_gig' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gig</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Outstanding</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Worker Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {byGig.map((g: GigReport) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{g.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{g.client_name}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(g.total_amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{formatCurrency(g.total_paid)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{formatCurrency(g.outstanding)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{formatCurrency(g.worker_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'by_worker' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Worker</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Skills</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gigs</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Earned</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {byWorker.map((w: WorkerReport) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{w.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{w.skills}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{w.gig_count}</td>
                    <td className="px-4 py-3 font-medium text-green-700">{formatCurrency(w.total_earned)}</td>
                    <td className="px-4 py-3 text-sm text-yellow-700 hidden sm:table-cell">{formatCurrency(w.pending_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'monthly' && monthly && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue</h3>
            <div className="space-y-3">
              {monthly.months?.map((m: MonthlyReport) => {
                const maxRev = Math.max(...monthly.months.map((x) => x.revenue), 1);
                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{m.month}</span>
                      <span className="font-medium">{formatCurrency(m.revenue)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full" style={{ width: `${(m.revenue / maxRev) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense by Category</h3>
            <div className="space-y-3">
              {expenseByCategory.map((c: ExpenseCategoryReport, i: number) => {
                const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500'];
                const maxVal = Math.max(...expenseByCategory.map((x) => x.total), 1);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{c.name}</span>
                      <span className="font-medium">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`${colors[i % colors.length]} h-3 rounded-full`} style={{ width: `${(c.total / maxVal) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {expenseByCategory.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No expenses recorded</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expense_by_category' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h3>
          {expenseByCategory.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No expenses recorded</p>
          ) : (
            <div className="space-y-4">
              {expenseByCategory.map((c: ExpenseCategoryReport, i: number) => {
                const total = expenseByCategory.reduce((s: number, x: ExpenseCategoryReport) => s + x.total, 0);
                const pct = total > 0 ? ((c.total / total) * 100).toFixed(1) : '0';
                const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-purple-400', 'bg-pink-400'];
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-900">{c.name}</span>
                        <span className="text-sm text-gray-600">{formatCurrency(c.total)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${colors[i % colors.length]} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
