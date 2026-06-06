'use client';

import { useEffect, useState, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';

interface ClientPayment {
  id: number;
  gig_id: number;
  invoice_id: number | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  gig_title: string;
  client_name: string;
}

interface WorkerPayment {
  id: number;
  gig_id: number;
  worker_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  gig_title: string;
  worker_name: string;
}

interface PaymentsData {
  client_payments: ClientPayment[];
  worker_payments: WorkerPayment[];
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentsData>({ client_payments: [], worker_payments: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'client' | 'worker'>('client');

  const fetchPayments = async () => {
    const res = await fetch('/api/payments?type=all');
    setPayments(await res.json());
    setLoading(false);
  };

  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchPayments();
    }
  }, []);

  const totalClient = payments.client_payments.reduce((s: number, p: ClientPayment) => s + p.amount, 0);
  const totalWorker = payments.worker_payments.reduce((s: number, p: WorkerPayment) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-600 mt-1">Track all client and worker payments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-2xl p-5 border-2 border-green-200">
          <p className="text-sm font-bold text-green-700 uppercase">Total Client Payments</p>
          <p className="text-2xl font-bold text-green-800">{formatCurrency(totalClient)}</p>
        </div>
        <div className="bg-orange-50 rounded-2xl p-5 border-2 border-orange-200">
          <p className="text-sm font-bold text-orange-700 uppercase">Total Worker Payments</p>
          <p className="text-2xl font-bold text-orange-800">{formatCurrency(totalWorker)}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('client')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'client' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Client Payments ({payments.client_payments.length})
        </button>
        <button onClick={() => setTab('worker')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'worker' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Worker Payments ({payments.worker_payments.length})
        </button>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tab === 'client' ? (
            payments.client_payments.length === 0 ? (
              <p className="text-center py-12 text-gray-400">No client payments yet</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {payments.client_payments.map((p: ClientPayment) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{p.gig_title}</p>
                      <p className="text-sm text-gray-500">{p.client_name} &bull; {p.payment_date} &bull; {p.payment_method}</p>
                    </div>
                    <p className="font-semibold text-green-700">{formatCurrency(p.amount)}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            payments.worker_payments.length === 0 ? (
              <p className="text-center py-12 text-gray-400">No worker payments yet</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {payments.worker_payments.map((p: WorkerPayment) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{p.worker_name}</p>
                      <p className="text-sm text-gray-500">{p.gig_title} &bull; {p.payment_date} &bull; {p.payment_method}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-700">{formatCurrency(p.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}