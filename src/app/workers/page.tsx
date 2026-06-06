'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface Worker {
  id: number;
  name: string;
  email: string;
  phone: string;
  skills: string;
  rate_per_gig: number;
  total_owed: number;
  total_paid: number;
  outstanding: number;
  gig_count: number;
}

interface GigBreakdown {
  gig_id: number;
  title: string;
  gig_date: string;
  gig_total: number;
  role: string;
  split_percent: number;
  role_count: number;
  amount_owed: number;
  amount_paid: number;
  outstanding: number;
}

interface WorkerFormData {
  name: string;
  email: string;
  phone: string;
  skills: string;
  rate_per_gig: number;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [payWorker, setPayWorker] = useState<Worker | null>(null);

  const loadedRef = useRef(false);

  const fetchWorkers = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (skillFilter !== 'all') params.set('skill', skillFilter);
    const res = await fetch(`/api/workers?${params}`);
    setWorkers(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchWorkers();
    }
  }, [search, skillFilter, fetchWorkers]);

  const handleCreate = async (data: WorkerFormData) => {
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowCreateModal(false); fetchWorkers(); }
    else { const err = await res.json(); alert(err.error); }
  };

  const handleUpdate = async (data: WorkerFormData) => {
    if (!editWorker) return;
    const res = await fetch(`/api/workers/${editWorker.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditWorker(null); fetchWorkers(); }
    else { const err = await res.json(); alert(err.error); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this worker?')) return;
    await fetch(`/api/workers/${id}`, { method: 'DELETE' });
    fetchWorkers();
  };

  // Summary totals
  const totalOutstanding = workers.reduce((s, w) => s + w.outstanding, 0);
  const totalOwed = workers.reduce((s, w) => s + w.total_owed, 0);
  const totalPaid = workers.reduce((s, w) => s + w.total_paid, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
          <p className="text-gray-600 mt-1">Manage your photographers and retouchers</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition">
          + Add Worker
        </button>
      </div>

      {/* Outstanding Summary */}
      {workers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase">Total Owed (All Workers)</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalOwed)}</p>
          </div>
          <div className="bg-green-50 rounded-xl border-2 border-green-200 p-4">
            <p className="text-xs font-bold text-green-600 uppercase">Total Paid</p>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totalPaid)}</p>
          </div>
          <div className={`${totalOutstanding > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} rounded-xl border-2 p-4`}>
            <p className={`text-xs font-bold uppercase ${totalOutstanding > 0 ? 'text-red-600' : 'text-gray-500'}`}>Outstanding Balance</p>
            <p className={`text-xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-red-700' : 'text-gray-900'}`}>{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Search workers..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900" />
        <select value={skillFilter} onChange={e => setSkillFilter(e.target.value)}
          className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 font-semibold">
          <option value="all">All Skills</option>
          <option value="photographer">Photographers</option>
          <option value="retoucher">Retouchers</option>
          <option value="both">Both</option>
        </select>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> :
        workers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
            <p className="text-gray-400 mb-4">No workers found</p>
            <button onClick={() => setShowCreateModal(true)} className="text-gray-900 font-bold hover:underline">Add your first worker</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map(worker => (
              <div key={worker.id} className="bg-white rounded-2xl border-2 border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="font-bold text-white">{worker.name.charAt(0)}</span>
                    </div>
                    <div>
                      <Link href={`/workers/${worker.id}`} className="font-bold text-gray-900 hover:text-gray-600">{worker.name}</Link>
                      <p className="text-xs text-gray-600 font-semibold capitalize">{worker.skills}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditWorker(worker)} className="text-gray-400 hover:text-blue-600 text-sm font-bold">Edit</button>
                    <button onClick={() => handleDelete(worker.id)} className="text-gray-400 hover:text-red-600 text-sm font-bold">Delete</button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-600 font-semibold">Gigs</span>
                    <span className="font-bold text-gray-900">{worker.gig_count}</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-600 font-semibold">Total Owed</span>
                    <span className="font-bold text-gray-900">{formatCurrency(worker.total_owed)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                    <span className="text-green-700 font-semibold">Paid</span>
                    <span className="font-bold text-green-700">{formatCurrency(worker.total_paid)}</span>
                  </div>
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${worker.outstanding > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <span className={`font-semibold ${worker.outstanding > 0 ? 'text-red-700' : 'text-gray-600'}`}>Outstanding</span>
                    <span className={`font-bold ${worker.outstanding > 0 ? 'text-red-700' : 'text-gray-900'}`}>{formatCurrency(worker.outstanding)}</span>
                  </div>
                </div>

                {worker.outstanding > 0 && (
                  <button onClick={() => setPayWorker(worker)}
                    className="w-full mt-3 bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-green-700 transition text-sm">
                    Record Payment
                  </button>
                )}

                {worker.phone && <p className="text-xs text-gray-600 mt-3 font-semibold">{worker.phone}</p>}
              </div>
            ))}
          </div>
        )}

      {showCreateModal && <WorkerModal title="Add Worker" onClose={() => setShowCreateModal(false)} onSubmit={handleCreate} />}
      {editWorker && <WorkerModal title="Edit Worker" worker={editWorker} onClose={() => setEditWorker(null)} onSubmit={handleUpdate} />}
      {payWorker && <PaymentModal worker={payWorker} onClose={() => setPayWorker(null)} onComplete={() => { setPayWorker(null); fetchWorkers(); }} />}
    </div>
  );
}

function WorkerModal({ title, worker, onClose, onSubmit }: { title: string; worker?: Worker; onClose: () => void; onSubmit: (data: WorkerFormData) => void }) {
  const [form, setForm] = useState({
    name: worker?.name || '',
    email: worker?.email || '',
    phone: worker?.phone || '',
    skills: worker?.skills || 'photographer',
    rate_per_gig: worker?.rate_per_gig?.toString() || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, rate_per_gig: parseFloat(form.rate_per_gig) || 0 });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Skills</label>
            <select value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 font-semibold">
              <option value="photographer">Photographer</option>
              <option value="retoucher">Retoucher</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition">
              {worker ? 'Save Changes' : 'Add Worker'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ worker, onClose, onComplete }: { worker: Worker; onClose: () => void; onComplete: () => void }) {
  const [gigs, setGigs] = useState<GigBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGig, setSelectedGig] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/workers/${worker.id}`)
      .then(r => r.json())
      .then(data => {
        const outstanding = (data.gig_breakdown || []).filter((g: GigBreakdown) => g.outstanding > 0);
        setGigs(outstanding);
        setLoading(false);
      });
  }, [worker.id]);

  const handleGigSelect = (gigId: number) => {
    setSelectedGig(gigId);
    const gig = gigs.find(g => g.gig_id === gigId);
    if (gig) {
      setAmount(gig.outstanding.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGig) { setError('Please select a gig'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }

    setSubmitting(true);
    setError('');

    const res = await fetch('/api/payments/worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gig_id: selectedGig,
        worker_id: worker.id,
        amount: amt,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: reference || undefined,
        notes: notes || undefined,
      }),
    });

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => onComplete(), 1200);
    } else {
      const err = await res.json();
      setError(err.error || 'Failed to record payment');
    }
    setSubmitting(false);
  };

  const selectedGigData = gigs.find(g => g.gig_id === selectedGig);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Record Payment</h3>
            <p className="text-sm text-gray-500">Pay {worker.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-lg font-bold text-green-700">Payment Recorded!</p>
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-gray-400">Loading outstanding gigs...</div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">No outstanding payments for {worker.name}</p>
            <button onClick={onClose} className="text-gray-900 font-bold hover:underline">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Select Gig */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Select Gig to Pay *</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {gigs.map(gig => (
                  <div key={gig.gig_id}
                    onClick={() => handleGigSelect(gig.gig_id)}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition ${
                      selectedGig === gig.gig_id ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-400'
                    }`}>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{gig.title}</p>
                      <p className="text-xs text-gray-500">{gig.gig_date} &bull; {gig.role} &bull; {gig.split_percent}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">Owed: {formatCurrency(gig.outstanding)}</p>
                      <p className="text-xs text-gray-500">Paid: {formatCurrency(gig.amount_paid)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Amount *</label>
              <div className="flex gap-2">
                <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-gray-900 font-bold text-lg" />
                {selectedGigData && (
                  <button type="button" onClick={() => setAmount(selectedGigData.outstanding.toFixed(2))}
                    className="px-4 py-3 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200 transition whitespace-nowrap">
                    Pay Full
                  </button>
                )}
              </div>
              {selectedGigData && (
                <p className="text-xs text-gray-500 mt-1">Maximum: {formatCurrency(selectedGigData.outstanding)}</p>
              )}
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Payment Date *</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-gray-900" />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-gray-900 font-semibold">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Reference Number</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-gray-900" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-gray-900" />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>
            )}

            {/* Summary */}
            {selectedGigData && amount && parseFloat(amount) > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gig:</span>
                  <span className="font-bold text-gray-900">{selectedGigData.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Worker:</span>
                  <span className="font-bold text-gray-900">{worker.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Paying:</span>
                  <span className="font-bold text-green-700 text-lg">{formatCurrency(parseFloat(amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining after payment:</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(Math.max(0, selectedGigData.outstanding - parseFloat(amount)))}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting}
                className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-50">
                {submitting ? 'Recording...' : 'Record Payment'}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
