'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function GigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [gig, setGig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWorkerPaymentModal, setShowWorkerPaymentModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);

  useEffect(() => {
    fetchGig();
  }, [params.id]);

  const fetchGig = async () => {
    const res = await fetch(`/api/gigs/${params.id}`);
    if (res.ok) {
      setGig(await res.json());
    }
    setLoading(false);
  };

  const handleRecordPayment = async (data: any) => {
    const res = await fetch('/api/payments/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gig_id: gig.id, ...data }),
    });
    if (res.ok) {
      setShowPaymentModal(false);
      fetchGig();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleRecordWorkerPayment = async (data: any) => {
    const res = await fetch('/api/payments/worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gig_id: gig.id, worker_id: selectedWorker.worker_id, ...data }),
    });
    if (res.ok) {
      setShowWorkerPaymentModal(false);
      setSelectedWorker(null);
      fetchGig();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this gig?')) return;
    await fetch(`/api/gigs/${params.id}`, { method: 'DELETE' });
    router.push('/gigs');
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!gig) return <div className="text-center py-12 text-gray-400">Gig not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/gigs" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Gigs</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{gig.title}</h1>
          <p className="text-gray-500">{gig.client_name} &bull; {gig.gig_date}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPaymentModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition text-sm">
            Record Payment
          </button>
          <Link href={`/gigs/${params.id}/edit`}
            className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition text-sm">
            Edit
          </Link>
          <button onClick={handleDelete}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition text-sm">
            Delete
          </button>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(gig.total_amount)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Client Paid</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(gig.total_paid)}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Client Outstanding</p>
            <p className="text-xl font-bold text-yellow-700">{formatCurrency(gig.outstanding)}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Workers Paid</p>
            <p className="text-xl font-bold text-orange-700">{formatCurrency(gig.worker_paid || 0)}</p>
          </div>
          <div className={`${(gig.net_profit || 0) >= 0 ? 'bg-blue-50' : 'bg-red-50'} rounded-lg p-4`}>
            <p className="text-sm text-gray-500">Net Profit</p>
            <p className={`text-xl font-bold ${(gig.net_profit || 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(gig.net_profit || 0)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Photographers ({gig.breakdown.photographer_split}%)</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(gig.breakdown.photographer_total)}</p>
            {gig.breakdown.photographers.map((p: any) => (
              <p key={p.worker_id} className="text-sm text-gray-600 mt-1">
                {p.worker_name}: {formatCurrency(p.amount)}
              </p>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Retouchers ({gig.breakdown.retoucher_split}%)</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(gig.breakdown.retoucher_total)}</p>
            {gig.breakdown.retouchers.map((r: any) => (
              <p key={r.worker_id} className="text-sm text-gray-600 mt-1">
                {r.worker_name}: {formatCurrency(r.amount)}
              </p>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Business ({gig.breakdown.business_split}%)</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(gig.breakdown.business_total)}</p>
          </div>
        </div>
      </div>

      {/* Workers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Assigned Workers</h2>
        {gig.workers.length === 0 ? (
          <p className="text-gray-400 text-sm">No workers assigned</p>
        ) : (() => {
          // Group workers by worker_id to combine roles
          const workerMap = new Map<number, { name: string; roles: string[]; worker: any }>();
          for (const w of gig.workers) {
            const existing = workerMap.get(w.worker_id);
            if (existing) {
              existing.roles.push(w.role);
            } else {
              workerMap.set(w.worker_id, { name: w.worker_name, roles: [w.role], worker: w });
            }
          }
          return (
            <div className="space-y-3">
              {Array.from(workerMap.entries()).map(([wid, data]) => (
                <div key={wid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{data.name}</p>
                    <p className="text-sm text-gray-500">{data.roles.map(r => r === 'photographer' ? '📸 Photographer' : '🎨 Retoucher').join(' + ')}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedWorker(data.worker); setShowWorkerPaymentModal(true); }}
                    className="text-sm text-gray-900 font-medium hover:underline"
                  >
                    Pay Worker
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Client Payments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Payments</h2>
        {gig.payments.length === 0 ? (
          <p className="text-gray-400 text-sm">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {gig.payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{formatCurrency(p.amount)}</p>
                  <p className="text-sm text-gray-500">{p.payment_date} &bull; {p.payment_method}</p>
                </div>
                {p.reference_number && <p className="text-xs text-gray-400">{p.reference_number}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Worker Payments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Worker Payments</h2>
        {gig.worker_payments.length === 0 ? (
          <p className="text-gray-400 text-sm">No worker payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {gig.worker_payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{p.worker_name}: {formatCurrency(p.amount)}</p>
                  <p className="text-sm text-gray-500">{p.payment_date} &bull; {p.payment_method} &bull; {p.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal onClose={() => setShowPaymentModal(false)} onSubmit={handleRecordPayment} gigTotal={gig.total_amount} paidSoFar={gig.total_paid} />
      )}

      {/* Worker Payment Modal */}
      {showWorkerPaymentModal && selectedWorker && (
        <WorkerPaymentModal
          onClose={() => { setShowWorkerPaymentModal(false); setSelectedWorker(null); }}
          onSubmit={handleRecordWorkerPayment}
          worker={selectedWorker}
          gig={gig}
        />
      )}
    </div>
  );
}

function PaymentModal({ onClose, onSubmit, gigTotal, paidSoFar }: any) {
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
    notes: '',
  });
  const remaining = gigTotal - paidSoFar;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, amount: parseFloat(form.amount) });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Record Client Payment</h3>
        <p className="text-sm text-gray-500 mb-4">Remaining: {formatCurrency(remaining)}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input type="number" min="0" max={remaining} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
            <input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition">Record</button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkerPaymentModal({ onClose, onSubmit, worker, gig }: any) {
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
    notes: '',
  });

  // Calculate expected amount for all roles
  let expectedAmount = 0;
  if (gig) {
    const roles = gig.workers
      .filter((w: any) => w.worker_id === worker.worker_id)
      .map((w: any) => w.role);
    for (const role of roles) {
      const split = role === 'photographer' ? gig.photographer_split : gig.retoucher_split;
      const roleCount = gig.workers.filter((w: any) => w.role === role).length;
      expectedAmount += (gig.total_amount * split / 100) / roleCount;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, amount: parseFloat(form.amount) });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Pay {worker.worker_name}</h3>
        {expectedAmount > 0 && (
          <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
            Expected payment: <span className="font-bold">{formatCurrency(expectedAmount)}</span>
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
            <input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition">Record Payment</button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
