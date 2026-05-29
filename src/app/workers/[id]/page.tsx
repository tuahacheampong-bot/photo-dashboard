'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

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
  status: string;
}

interface PaymentRecord {
  id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  gig_title: string;
  notes: string;
}

export default function WorkerDetailPage() {
  const params = useParams();
  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorker = () => {
    fetch(`/api/workers/${params.id}`)
      .then(r => r.json())
      .then(data => { setWorker(data); setLoading(false); });
  };

  useEffect(() => {
    fetchWorker();
  }, [params.id]);

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Delete this payment?')) return;
    const res = await fetch(`/api/payments/worker?id=${paymentId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchWorker();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to delete payment');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!worker) return <div className="text-center py-12 text-gray-400">Worker not found</div>;

  const outstandingGigs = worker.gig_breakdown?.filter((g: GigBreakdown) => g.outstanding > 0) || [];
  const fullyPaidGigs = worker.gig_breakdown?.filter((g: GigBreakdown) => g.outstanding <= 0) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/workers" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Workers</Link>
        <div className="flex items-center gap-4 mt-2">
          <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-xl font-bold text-gray-600">{worker.name.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{worker.name}</h1>
            <p className="text-gray-500 capitalize">{worker.skills}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase">Total Owed</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(worker.total_owed)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-xs font-bold text-green-600 uppercase">Total Paid</p>
          <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(worker.total_paid)}</p>
        </div>
        <div className={`${worker.outstanding > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} rounded-xl p-4 border`}>
          <p className={`text-xs font-bold uppercase ${worker.outstanding > 0 ? 'text-red-600' : 'text-blue-600'}`}>Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${worker.outstanding > 0 ? 'text-red-700' : 'text-blue-700'}`}>{formatCurrency(worker.outstanding)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-xs font-bold text-blue-600 uppercase">Total Gigs</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{worker.gig_breakdown?.length || 0}</p>
        </div>
      </div>

      {/* Outstanding Gigs - What needs to be paid */}
      {outstandingGigs.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-red-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Outstanding Payments ({outstandingGigs.length})</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">These gigs have work recorded but payment is still owed:</p>
          <div className="space-y-2">
            {outstandingGigs.map((g: GigBreakdown) => (
              <div key={g.gig_id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex-1">
                  <Link href={`/gigs/${g.gig_id}`} className="font-bold text-gray-900 hover:text-gray-600">{g.title}</Link>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    <span>{g.gig_date}</span>
                    <span className="capitalize">{g.role}</span>
                    <span>{g.split_percent}% split ({g.role_count} {g.role}{g.role_count > 1 ? 's' : ''})</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm">
                    <span className="text-gray-500">Owed: </span>
                    <span className="font-bold text-gray-900">{formatCurrency(g.amount_owed)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Paid: </span>
                    <span className="font-bold text-green-700">{formatCurrency(g.amount_paid)}</span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="text-red-600 font-bold">Balance: {formatCurrency(g.outstanding)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fully Paid Gigs */}
      {fullyPaidGigs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Fully Paid Gigs ({fullyPaidGigs.length})</h2>
          </div>
          <div className="space-y-2">
            {fullyPaidGigs.map((g: GigBreakdown) => (
              <div key={g.gig_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <Link href={`/gigs/${g.gig_id}`} className="font-medium text-gray-900 hover:text-gray-600">{g.title}</Link>
                  <p className="text-sm text-gray-500">{g.gig_date} &bull; <span className="capitalize">{g.role}</span> &bull; {g.split_percent}%</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-700">{formatCurrency(g.amount_paid)} paid</p>
                  <p className="text-xs text-gray-500">of {formatCurrency(g.amount_owed)} owed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
        {worker.payment_history?.length === 0 ? (
          <p className="text-gray-400 text-sm">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {worker.payment_history?.map((p: PaymentRecord) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{formatCurrency(p.amount)}</p>
                  <p className="text-sm text-gray-500">{p.gig_title} &bull; {p.payment_date} &bull; {p.payment_method}</p>
                  {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {p.status}
                  </span>
                  <button onClick={() => handleDeletePayment(p.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
