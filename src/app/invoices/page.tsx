'use client';

import { useEffect, useState, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface Invoice {
  id: number;
  invoice_number: string;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  due_date?: string | null;
  status: string;
  source: string;
  zoho_invoice_id?: string | null;
  gig_id?: number | null;
  created_at: string;
}

interface ZohoSettings {
  configured: boolean;
  refresh_token: string;
}

interface CreateGigData {
  invoice_id: number;
  title?: string;
  gig_date?: string;
  location?: string;
  description?: string;
  photographer_split?: number;
  retoucher_split?: number;
  workers?: Array<{ worker_id: number; role: string }>;
}

interface CreateGigResult {
  gig_id?: number;
  error?: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState(true);
  const [zohoReady, setZohoReady] = useState(false);
  const [showGigModal, setShowGigModal] = useState<Invoice | null>(null);
  const [showLinkGigModal, setShowLinkGigModal] = useState<Invoice | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const loadedRef = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [sortBy, setSortBy] = useState('invoice_number');
  const [sortOrder, setSortOrder] = useState('asc');
  const [totalPages, setTotalPages] = useState(1);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (statusFilter !== 'all') p.set('status', statusFilter);
      if (search) p.set('search', search);
      p.set('page', currentPage.toString());
      p.set('limit', itemsPerPage.toString());
      p.set('sort', sortBy);
      p.set('order', sortOrder);
      const res = await fetch(`/api/invoices?${p}&_=${refreshKey}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Handle both array response and paginated response
      if (Array.isArray(data)) {
        setInvoices(data);
        setTotalPages(1);
      } else if (data.invoices) {
        setInvoices(data.invoices);
        setTotalPages(data.totalPages || 1);
      } else {
        setInvoices([]);
        setTotalPages(1);
      }
    } catch {
      setInvoices([]);
      setTotalPages(1);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchInvoices();
      fetch('/api/zoho/settings')
        .then(r => r.json())
        .then((d: ZohoSettings) => setZohoReady(d.configured && d.refresh_token !== '***'))
        .catch(() => {});
    }
  }, [statusFilter, search, refreshKey, fetchInvoices, currentPage, sortBy, sortOrder]);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/zoho/sync', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        setSyncOk(true);
        setSyncMsg(`Synced: ${d.created} new, ${d.updated} updated, ${d.paymentsRecorded} payments recorded`);
        refreshInvoices();
      } else {
        setSyncOk(false);
        setSyncMsg(d.error || 'Sync failed');
      }
    } catch {
      setSyncOk(false);
      setSyncMsg('Network error');
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 5000);
  };

  const refreshInvoices = () => setRefreshKey(k => k + 1);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const createGigFromInvoice = async (data: CreateGigData) => {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_gig_from_invoice', ...data }),
    });
    const result = await res.json() as CreateGigResult;
    if (res.ok) {
      setShowGigModal(null);
      refreshInvoices();
      window.location.href = `/gigs/${result.gig_id}`;
    } else if (result.gig_id) {
      window.location.href = `/gigs/${result.gig_id}`;
    } else {
      alert(result.error || 'Failed to create gig');
    }
  };

  const sc = (s: string) => ({
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    pending: 'bg-blue-100 text-blue-800',
  }[s] || 'bg-gray-100 text-gray-700');

  const deleteInvoice = async (id: number) => {
    if (!confirm('Delete this invoice?')) return;
    const res = await fetch(`/api/invoices?id=${id}`, { method: 'DELETE' });
    if (res.ok) refreshInvoices();
  };

  const linkGigToInvoice = async (data: LinkGigData) => {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link_gig_to_invoice', ...data }),
    });
    const result = await res.json();
    if (res.ok) {
      refreshInvoices();
    } else {
      alert(result.error || 'Failed to link gig');
    }
  };

  // Invoices eligible for gig creation (no gig linked)
  const linkable = invoices.filter(inv => !inv.gig_id);
  const selectedLinkable = invoices.filter(inv => selected.includes(inv.id) && !inv.gig_id);

  const toggleSelect = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const linkableIds = linkable.map(inv => inv.id);
    if (selected.length === linkableIds.length) {
      setSelected([]);
    } else {
      setSelected(linkableIds);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {selectedLinkable.length > 0 && (
            <button onClick={() => setShowBatchModal(true)}
              className="bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-green-700 transition flex items-center gap-2">
              Create Gigs ({selectedLinkable.length})
            </button>
          )}
          <button onClick={sync} disabled={syncing}
            className={`${zohoReady ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-400 cursor-not-allowed'} text-white px-4 py-2.5 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2 transition`}>
            {syncing ? <><span className="animate-spin">⟳</span> Syncing...</> : <>🔄 Sync Zoho</>}
          </button>
          <button onClick={() => setShowModal(true)} className="bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800">
            + Add Invoice
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 ${syncOk ? 'bg-green-50 text-green-800 border-green-300' : 'bg-red-50 text-red-800 border-red-300'}`}>
          {syncMsg}
        </div>
      )}

      {!zohoReady && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-lg">🔗</span>
          <p className="text-sm text-orange-800">
            <a href="/settings" className="font-bold underline">Connect Zoho</a> to enable sync.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 font-semibold">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : invoices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
          <p className="text-gray-400 mb-4">No invoices found</p>
          <button onClick={() => setShowModal(true)} className="text-gray-900 font-bold hover:underline">Add your first invoice</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    {linkable.length > 0 && (
                      <input type="checkbox" checked={selected.length === linkable.length && linkable.length > 0} onChange={toggleAll}
                        className="w-4 h-4 rounded" />
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('invoice_number')}>
                    Invoice #
                    {sortBy === 'invoice_number' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none hidden sm:table-cell"
                    onClick={() => handleSort('client_name')}>
                    Client
                    {sortBy === 'client_name' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none hidden sm:table-cell"
                    onClick={() => handleSort('total_amount')}>
                    Amount
                    {sortBy === 'total_amount' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell"
                    onClick={() => handleSort('amount_paid')}>
                    Paid
                    {sortBy === 'amount_paid' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell"
                    onClick={() => handleSort('balance')}>
                    Balance
                    {sortBy === 'balance' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('status')}>
                    Status
                    {sortBy === 'status' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv: Invoice) => {
                  const hasGig = !!inv.gig_id;
                  return (
                    <tr key={inv.id} className={`hover:bg-gray-50 ${selected.includes(inv.id) ? 'bg-green-50' : ''} ${hasGig ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        {!hasGig && (
                          <input type="checkbox" checked={selected.includes(inv.id)} onChange={() => toggleSelect(inv.id)}
                            className="w-4 h-4 rounded" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-semibold">{inv.client_name}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 hidden sm:table-cell">{formatCurrency(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-sm text-green-700 font-semibold hidden md:table-cell">{formatCurrency(inv.amount_paid || 0)}</td>
                      <td className="px-4 py-3 text-sm text-red-600 font-semibold hidden md:table-cell">{formatCurrency(inv.balance || 0)}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${sc(inv.status)}`}>{inv.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {hasGig ? (
                            <>
                              <Link href={`/gigs/${inv.gig_id}`} className="text-sm text-gray-600 hover:text-gray-900 font-semibold">
                                View Gig →
                              </Link>
                              <button onClick={() => setShowLinkGigModal(inv)}
                                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition">
                                Link Gig
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setShowGigModal(inv)}
                              className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-gray-800 transition">
                              + Create Gig
                            </button>
                          )}
                          <button onClick={() => deleteInvoice(inv.id)}
                            className="text-sm text-red-600 hover:text-red-900 font-semibold">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && <CreateModal onClose={() => setShowModal(false)} />}
      {showGigModal && <GigFromInvoiceModal invoice={showGigModal} onClose={() => setShowGigModal(null)} onSubmit={createGigFromInvoice} />}
      {showLinkGigModal && <LinkGigToInvoiceModal invoice={showLinkGigModal} onClose={() => setShowLinkGigModal(null)} onSubmit={linkGigToInvoice} />}
      {showBatchModal && (
        <BatchGigFromInvoiceModal
          invoices={selectedLinkable}
          onClose={() => setShowBatchModal(false)}
          onComplete={() => { setShowBatchModal(false); setSelected([]); fetchInvoices(); }}
        />
      )}
    </div>
  );
}

interface CreateInvoiceForm {
  invoice_number: string;
  client_name: string;
  total_amount: string;
  due_date: string;
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<CreateInvoiceForm>({ invoice_number: '', client_name: '', total_amount: '', due_date: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, amount: parseFloat(f.total_amount), total_amount: parseFloat(f.total_amount), source: 'manual' }),
    });
    onClose();
    window.location.reload();
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Add Invoice</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Invoice # *</label>
            <input value={f.invoice_number} onChange={e => setF({ ...f, invoice_number: e.target.value })} required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Client *</label>
            <input value={f.client_name} onChange={e => setF({ ...f, client_name: e.target.value })} required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Amount (GHS) *</label>
            <input type="number" min="0" value={f.total_amount} onChange={e => setF({ ...f, total_amount: e.target.value })} required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-gray-800">Add</button>
            <button type="button" onClick={onClose} className="px-4 py-2 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface Worker {
  id: number;
  name: string;
  skills: string;
}

interface AssignedWorker {
  worker_id: number;
  role: string;
}

interface GigFormData {
  title: string;
  gig_date: string;
  location: string;
  description: string;
  photographer_split: string;
  retoucher_split: string;
}

function GigFromInvoiceModal({ invoice, onClose, onSubmit }: { invoice: Invoice; onClose: () => void; onSubmit: (data: CreateGigData) => void }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [assignedWorkers, setAssignedWorkers] = useState<AssignedWorker[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<GigFormData>({
    title: `Gig - ${invoice.client_name}`,
    gig_date: invoice.due_date || new Date().toISOString().split('T')[0],
    location: '',
    description: '',
    photographer_split: '30',
    retoucher_split: '30',
  });

  useEffect(() => {
    fetch('/api/workers')
      .then(r => r.json())
      .then((d: Worker[]) => {
        setWorkers(d);
        setWorkersLoaded(true);
      })
      .catch(() => setWorkersLoaded(true));
  }, []);

  const toggleWorkerRole = (workerId: number, role: string) => {
    const exists = assignedWorkers.find(w => w.worker_id === workerId && w.role === role);
    if (exists) {
      setAssignedWorkers(assignedWorkers.filter(w => !(w.worker_id === workerId && w.role === role)));
    } else {
      setAssignedWorkers([...assignedWorkers, { worker_id: workerId, role }]);
    }
  };

  const total = invoice.total_amount;
  const photoSplit = parseFloat(form.photographer_split) || 0;
  const retouchSplit = parseFloat(form.retoucher_split) || 0;
  const businessSplit = 100 - photoSplit - retouchSplit;
  const photoTotal = total * photoSplit / 100;
  const retouchTotal = total * retouchSplit / 100;
  const businessTotal = total * businessSplit / 100;
  const photographers = assignedWorkers.filter(w => w.role === 'photographer');
  const retouchers = assignedWorkers.filter(w => w.role === 'retoucher');
  const perPhotographer = photographers.length > 0 ? photoTotal / photographers.length : 0;
  const perRetoucher = retouchers.length > 0 ? retouchTotal / retouchers.length : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ 
      invoice_id: invoice.id, 
      ...form, 
      photographer_split: parseFloat(form.photographer_split) || 30,
      retoucher_split: parseFloat(form.retoucher_split) || 30,
      workers: assignedWorkers 
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-1">Create Gig from Invoice</h3>
        <p className="text-sm text-gray-600 font-semibold mb-4">{invoice.invoice_number} • {invoice.client_name} • {formatCurrency(total)}</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Gig Title</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Gig Date</label>
              <input type="date" value={form.gig_date} onChange={e => setForm({ ...form, gig_date: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Location</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <p className="text-white font-bold text-sm">Payment Splits</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">📸 Photo %</label>
                <input type="number" min="0" max="100" value={form.photographer_split}
                  onChange={e => setForm({ ...form, photographer_split: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-700 rounded-lg bg-gray-800 text-white font-bold focus:ring-2 focus:ring-white outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">🎨 Retouch %</label>
                <input type="number" min="0" max="100" value={form.retoucher_split}
                  onChange={e => setForm({ ...form, retoucher_split: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-700 rounded-lg bg-gray-800 text-white font-bold focus:ring-2 focus:ring-white outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">💼 Business %</label>
                <div className="px-3 py-2 border-2 border-gray-700 rounded-lg bg-gray-800 text-gray-400 font-bold">{businessSplit}%</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-xs text-gray-400">📸 Total</p>
                <p className="text-white font-bold">{formatCurrency(photoTotal)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-xs text-gray-400">🎨 Total</p>
                <p className="text-white font-bold">{formatCurrency(retouchTotal)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-xs text-gray-400">💼 Total</p>
                <p className="text-green-400 font-bold">{formatCurrency(businessTotal)}</p>
              </div>
            </div>
          </div>

          {workers.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Assign Workers</label>
              <div className="space-y-2">
                {workers.map(w => {
                  const isPhotographer = assignedWorkers.some(a => a.worker_id === w.id && a.role === 'photographer');
                  const isRetoucher = assignedWorkers.some(a => a.worker_id === w.id && a.role === 'retoucher');
                  const isAssigned = isPhotographer || isRetoucher;
                  let workerPay = 0;
                  if (isPhotographer) workerPay += perPhotographer;
                  if (isRetoucher) workerPay += perRetoucher;
                  return (
                    <div key={w.id} className={`flex items-center justify-between p-3 rounded-xl border-2 ${isAssigned ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{w.name.charAt(0)}</span>
                        </div>
                        <div>
                          <span className="font-bold text-sm text-gray-900">{w.name}</span>
                          {isAssigned && (
                            <p className="text-xs text-green-700 font-bold">{formatCurrency(workerPay)} to be paid</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={isPhotographer}
                            onChange={() => toggleWorkerRole(w.id, 'photographer')}
                            className="w-4 h-4" />
                          <span className="text-sm font-bold">📸 Photo</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={isRetoucher}
                            onChange={() => toggleWorkerRole(w.id, 'retoucher')}
                            className="w-4 h-4" />
                          <span className="text-sm font-bold">🎨 Retouch</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {assignedWorkers.length > 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 space-y-2">
              <p className="font-bold text-green-800 text-sm">Payment Summary</p>
              {photographers.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-700 font-semibold">📸 {photographers.length} Photographer{photographers.length > 1 ? 's' : ''} ({formatCurrency(perPhotographer)} each)</span>
                  <span className="font-bold text-green-800">{formatCurrency(photoTotal)}</span>
                </div>
              )}
              {retouchers.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-700 font-semibold">🎨 {retouchers.length} Retoucher{retouchers.length > 1 ? 's' : ''} ({formatCurrency(perRetoucher)} each)</span>
                  <span className="font-bold text-green-800">{formatCurrency(retouchTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-green-300 pt-2">
                <span className="text-green-700 font-semibold">💼 Business keeps</span>
                <span className="font-bold text-green-800">{formatCurrency(businessTotal)}</span>
              </div>
            </div>
          )}

          {invoice.amount_paid > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
              <p className="text-blue-800 text-sm font-bold">💰 Invoice Payment: {formatCurrency(invoice.amount_paid)} already paid</p>
              <p className="text-blue-600 text-xs mt-1">This will be recorded as a client payment for the gig</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting || !workersLoaded}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50">
              {submitting ? 'Creating...' : !workersLoaded ? 'Loading...' : 'Create Gig'}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2.5 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface LinkGigData {
  invoice_id: number;
  gig_id: number;
}

function LinkGigToInvoiceModal({ invoice, onClose, onSubmit }: { invoice: Invoice; onClose: () => void; onSubmit: (data: LinkGigData) => void }) {
  const [gigs, setGigs] = useState<{ id: number; title: string; client_name: string; gig_date: string; invoice_reference?: string | null }[]>([]);
  const [gigsLoaded, setGigsLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ gig_id: '' });

  useEffect(() => {
    fetch('/api/gigs')
      .then(r => r.json())
      .then((d: { id: number; title: string; client_name: string; gig_date: string; invoice_reference?: string | null }[]) => {
        setGigs(d);
        setGigsLoaded(true);
      })
      .catch(() => setGigsLoaded(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    await onSubmit({ invoice_id: invoice.id, gig_id: Number(form.gig_id) });
    setSubmitting(false);
  };

  // Find gigs that don't already have this invoice linked (or any invoice linked)
  const availableGigs = gigs.filter(g => !g.invoice_reference || g.invoice_reference === invoice.invoice_number);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-1">Link Existing Gig to Invoice</h3>
        <p className="text-sm text-gray-600 font-semibold mb-4">{invoice.invoice_number} • {invoice.client_name} • {formatCurrency(invoice.total_amount)}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {availableGigs.length === 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <p className="text-yellow-800 text-sm font-bold">No available gigs to link.</p>
              <p className="text-yellow-700 text-xs mt-1">All gigs are already linked to invoices, or you need to create a new gig first.</p>
            </div>
          )}

          {availableGigs.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Select Gig to Link</label>
              <div className="space-y-2 max-h-60 overflow-y-auto border-2 border-gray-200 rounded-xl p-2">
                {availableGigs.map(gig => (
                  <label key={gig.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 cursor-pointer transition hover:border-blue-500 hover:bg-blue-50">
                    <input type="radio" name="gig_id" value={gig.id}
                      onChange={e => setForm({ ...form, gig_id: e.target.value })}
                      className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500" />
                    <div>
                      <p className="font-bold text-sm text-gray-900">{gig.title}</p>
                      <p className="text-xs text-gray-500">{gig.client_name} • {gig.gig_date}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting || !gigsLoaded}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50">
              {submitting ? 'Linking...' : !gigsLoaded ? 'Loading...' : 'Link Gig'}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2.5 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BatchInvoice {
  id: number;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  status: string;
}

function BatchGigFromInvoiceModal({ invoices, onClose, onComplete }: { invoices: BatchInvoice[]; onClose: () => void; onComplete: () => void }) {
  const [photographerSplit, setPhotographerSplit] = useState('30');
  const [retoucherSplit, setRetoucherSplit] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    const res = await fetch('/api/invoices/batch-gig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_ids: invoices.map(inv => inv.id),
        defaults: {
          photographer_split: photographerSplit,
          retoucher_split: retoucherSplit,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult({ created: data.created.length, errors: data.errors?.length || 0 });
    } else {
      const err = await res.json();
      setError(err.error || 'Failed to create gigs');
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
          <p className="text-gray-600 mb-1">{result.created} gig{result.created !== 1 ? 's' : ''} created successfully.</p>
          {result.errors > 0 && (
            <p className="text-orange-600 text-sm font-semibold">{result.errors} invoice{result.errors !== 1 ? 's' : ''} skipped (already linked or not found).</p>
          )}
          <button onClick={onComplete}
            className="mt-6 bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition">
            Done
          </button>
        </div>
      </div>
    );
  }

  const businessSplit = 100 - (parseFloat(photographerSplit) || 0) - (parseFloat(retoucherSplit) || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Batch Create Gigs from Invoices</h3>
            <p className="text-sm text-gray-500">Create {invoices.length} gig{invoices.length !== 1 ? 's' : ''} from selected invoices.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
        </div>

        {/* Shared Splits */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-sm font-bold text-gray-700">Shared Payment Splits</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">📸 Photo %</label>
              <input type="number" min="0" max="100" value={photographerSplit}
                onChange={e => setPhotographerSplit(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">🎨 Retouch %</label>
              <input type="number" min="0" max="100" value={retoucherSplit}
                onChange={e => setRetoucherSplit(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">💼 Business %</label>
              <div className="px-3 py-2 border-2 border-gray-200 rounded-lg text-center font-bold text-gray-700">{businessSplit}%</div>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {invoices.map(inv => (
            <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-bold text-sm text-gray-900">{inv.invoice_number}</p>
                <p className="text-xs text-gray-500">{inv.client_name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-gray-900">{formatCurrency(inv.total_amount)}</p>
                <p className="text-xs text-gray-500">{inv.status}</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-semibold mb-4">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-50">
            {submitting ? 'Creating...' : `Create ${invoices.length} Gig${invoices.length !== 1 ? 's' : ''}`}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
