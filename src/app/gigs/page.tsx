'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface Gig {
  id: number;
  title: string;
  client_name: string;
  gig_date: string;
  total_amount: number;
  status: string;
  total_paid: number;
  outstanding: number;
  worker_paid: number;
  net_profit: number;
  worker_names: string;
}

interface BatchRow {
  title: string;
  client_name: string;
  gig_date: string;
  total_amount: string;
  status: string;
}

export default function GigsPage() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showBatch, setShowBatch] = useState(false);

  useEffect(() => { fetchGigs(); }, [statusFilter, search, dateFrom, dateTo]);

  const fetchGigs = async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (statusFilter !== 'all') p.set('status', statusFilter);
    if (search) p.set('search', search);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    const res = await fetch(`/api/gigs?${p}`);
    setGigs(await res.json());
    setLoading(false);
  };

  const deleteGig = async (id: number) => {
    if (!confirm('Delete this gig?')) return;
    await fetch(`/api/gigs/${id}`, { method: 'DELETE' });
    fetchGigs();
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.length} gigs?`)) return;
    for (const id of selected) {
      await fetch(`/api/gigs/${id}`, { method: 'DELETE' });
    }
    setSelected([]);
    fetchGigs();
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selected.length === gigs.length) {
      setSelected([]);
    } else {
      setSelected(gigs.map(g => g.id));
    }
  };

  const sc = (s: string) => ({
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
  }[s] || 'bg-gray-100 text-gray-700');

  const totalAmount = gigs.reduce((s, g) => s + g.total_amount, 0);
  const totalPaid = gigs.reduce((s, g) => s + (g.total_paid || 0), 0);
  const totalOutstanding = gigs.reduce((s, g) => s + (g.outstanding || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gigs</h1>
          <p className="text-gray-600 mt-1">{gigs.length} gig{gigs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button onClick={deleteSelected}
              className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-red-700 transition flex items-center gap-2">
              Delete ({selected.length})
            </button>
          )}
          <button onClick={() => setShowBatch(true)}
            className="bg-white border-2 border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition">
            Batch Create
          </button>
          <Link href="/gigs/new"
            className="bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition inline-flex items-center gap-2">
            + New Gig
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      {gigs.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase">Total</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase">Paid</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase">Outstanding</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Search gigs..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 font-semibold">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition">
          Date Filter
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-3 bg-white rounded-xl border-2 border-gray-200 p-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="self-end px-3 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition">
            Clear
          </button>
        </div>
      )}

      {/* Gigs Table */}
      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : gigs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
          <p className="text-gray-400 mb-4">No gigs found</p>
          <Link href="/gigs/new" className="text-gray-900 font-bold hover:underline">Create your first gig</Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selected.length === gigs.length && gigs.length > 0} onChange={toggleAll}
                      className="w-4 h-4 rounded" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase">Gig</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase hidden sm:table-cell">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase hidden lg:table-cell">Client Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase hidden lg:table-cell">Outstanding</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase hidden xl:table-cell">Workers Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase hidden xl:table-cell">Net Profit</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gigs.map(gig => (
                  <tr key={gig.id} className={`hover:bg-gray-50 ${selected.includes(gig.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(gig.id)} onChange={() => toggleSelect(gig.id)}
                        className="w-4 h-4 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/gigs/${gig.id}`} className="font-bold text-gray-900 hover:text-gray-600">{gig.title}</Link>
                      <p className="text-sm text-gray-500 sm:hidden">{gig.client_name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-semibold hidden sm:table-cell">{gig.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{gig.gig_date}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(gig.total_amount)}</td>
                    <td className="px-4 py-3 text-sm text-green-700 font-semibold hidden lg:table-cell">{formatCurrency(gig.total_paid || 0)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold hidden lg:table-cell">{formatCurrency(gig.outstanding || 0)}</td>
                    <td className="px-4 py-3 text-sm text-orange-600 font-semibold hidden xl:table-cell">{formatCurrency(gig.worker_paid || 0)}</td>
                    <td className={`px-4 py-3 text-sm font-semibold hidden xl:table-cell ${(gig.net_profit || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(gig.net_profit || 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${sc(gig.status)}`}>{gig.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/gigs/${gig.id}`} className="text-sm text-gray-600 hover:text-gray-900 font-semibold">View</Link>
                        <Link href={`/gigs/${gig.id}/edit`} className="text-sm text-blue-600 hover:text-blue-900 font-semibold">Edit</Link>
                        <button onClick={() => deleteGig(gig.id)} className="text-sm text-red-600 hover:text-red-900 font-semibold">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showBatch && <BatchCreateModal onClose={() => setShowBatch(false)} onComplete={() => { setShowBatch(false); fetchGigs(); }} />}
    </div>
  );
}

function BatchCreateModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [rows, setRows] = useState<BatchRow[]>([
    { title: '', client_name: '', gig_date: new Date().toISOString().split('T')[0], total_amount: '', status: 'pending' },
  ]);
  const [defaults, setDefaults] = useState({ photographer_split: '30', retoucher_split: '30' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number } | null>(null);

  const addRow = () => {
    setRows([...rows, { title: '', client_name: '', gig_date: new Date().toISOString().split('T')[0], total_amount: '', status: 'pending' }]);
  };

  const removeRow = (i: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== i));
  };

  const updateRow = (i: number, field: keyof BatchRow, value: string) => {
    const updated = [...rows];
    updated[i] = { ...updated[i], [field]: value };
    setRows(updated);
  };

  const copyDown = (field: keyof BatchRow) => {
    const lastVal = [...rows].reverse().find(r => r[field])?.[field] || '';
    setRows(rows.map(r => ({ ...r, [field]: r[field] || lastVal })));
  };

  const handleSubmit = async () => {
    const validRows = rows.filter(r => r.title.trim() || r.client_name.trim());
    if (validRows.length === 0) {
      setError('Add at least one gig with a title and client name');
      return;
    }

    setSubmitting(true);
    setError('');

    const res = await fetch('/api/gigs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gigs: validRows.map(r => ({
          title: r.title,
          client_name: r.client_name,
          gig_date: r.gig_date,
          total_amount: r.total_amount,
          status: r.status,
        })),
        defaults: {
          photographer_split: defaults.photographer_split,
          retoucher_split: defaults.retoucher_split,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult({ created: data.created.length });
    } else {
      const err = await res.json();
      if (err.details) {
        setError(err.details.map((d: any) => `Row ${d.index}: ${d.error}`).join('; '));
      } else {
        setError(err.error || 'Failed to create gigs');
      }
    }
    setSubmitting(false);
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Gigs Created!</h3>
          <p className="text-gray-600 mb-6">{result.created} gig{result.created > 1 ? 's' : ''} created successfully.</p>
          <button onClick={onComplete}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Batch Create Gigs</h3>
            <p className="text-sm text-gray-500">Add multiple gigs at once. Fill in at least title and client name per row.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
        </div>

        {/* Shared Defaults */}
        <div className="flex gap-4 mb-4 bg-gray-50 rounded-xl p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-semibold">Photo %</span>
            <input type="number" min="0" max="100" value={defaults.photographer_split}
              onChange={e => setDefaults({ ...defaults, photographer_split: e.target.value })}
              className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center font-bold" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-semibold">Retouch %</span>
            <input type="number" min="0" max="100" value={defaults.retoucher_split}
              onChange={e => setDefaults({ ...defaults, retoucher_split: e.target.value })}
              className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center font-bold" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-gray-600 font-semibold">Business %</span>
            <span className="font-bold text-gray-900">{100 - (parseFloat(defaults.photographer_split) || 0) - (parseFloat(defaults.retoucher_split) || 0)}</span>
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-auto space-y-2 mb-4">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_130px_120px_110px_36px] gap-2 px-1 text-xs font-bold text-gray-500 uppercase">
            <div>Title *</div>
            <div>Client Name *</div>
            <div>Date *</div>
            <div>Amount (GHS) *</div>
            <div>Status</div>
            <div></div>
          </div>

          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_130px_120px_110px_36px] gap-2 items-center">
              <input value={row.title} onChange={e => updateRow(i, 'title', e.target.value)}
                placeholder="e.g. Wedding Shoot"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              <input value={row.client_name} onChange={e => updateRow(i, 'client_name', e.target.value)}
                placeholder="e.g. John Doe"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              <input type="date" value={row.gig_date} onChange={e => updateRow(i, 'gig_date', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              <input type="number" min="0" value={row.total_amount} onChange={e => updateRow(i, 'total_amount', e.target.value)}
                placeholder="0.00"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none font-bold" />
              <select value={row.status} onChange={e => updateRow(i, 'status', e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none font-semibold">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <button onClick={() => removeRow(i)} disabled={rows.length <= 1}
                className="text-red-400 hover:text-red-600 font-bold text-lg disabled:opacity-30 transition">
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex gap-2">
            <button onClick={addRow}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition">
              + Add Row
            </button>
            <button onClick={() => copyDown('client_name')}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition"
              title="Copy last client name to empty rows">
              Fill Client
            </button>
            <button onClick={() => copyDown('gig_date')}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition"
              title="Copy last date to empty rows">
              Fill Date
            </button>
          </div>

          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-600 font-semibold max-w-md">{error}</p>}
            <button onClick={onClose}
              className="px-4 py-2.5 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition disabled:opacity-50">
              {submitting ? 'Creating...' : `Create ${rows.filter(r => r.title.trim() || r.client_name.trim()).length} Gig${rows.filter(r => r.title.trim() || r.client_name.trim()).length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
