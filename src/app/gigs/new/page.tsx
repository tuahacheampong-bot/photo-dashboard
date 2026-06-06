'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

// Generate placeholder once at module load time
const INVOICE_NUMBER_PLACEHOLDER = `INV-${Date.now().toString().slice(-6)}`;

interface Worker {
  id: number;
  name: string;
  skills: string;
}

export default function NewGigPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    gig_date: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
    total_amount: '',
    photographer_split: '30',
    retoucher_split: '30',
    invoice_reference: '',
    status: 'pending',
    create_invoice: true,
    invoice_number: '',
    invoice_due_date: '',
  });
  const [assignedWorkers, setAssignedWorkers] = useState<{ worker_id: number; role: string }[]>([]);

  useEffect(() => {
    fetch('/api/workers')
      .then(res => res.json())
      .then(data => setWorkers(data));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleWorkerRole = (workerId: number, role: string) => {
    const exists = assignedWorkers.find(w => w.worker_id === workerId && w.role === role);
    if (exists) {
      setAssignedWorkers(assignedWorkers.filter(w => !(w.worker_id === workerId && w.role === role)));
    } else {
      setAssignedWorkers([...assignedWorkers, { worker_id: workerId, role }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/gigs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        total_amount: parseFloat(form.total_amount),
        photographer_split: parseFloat(form.photographer_split),
        retoucher_split: parseFloat(form.retoucher_split),
        workers: assignedWorkers,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/gigs/${data.id}`);
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to create gig');
    }
    setSaving(false);
  };

  const total = parseFloat(form.total_amount) || 0;
  const photoSplit = parseFloat(form.photographer_split) || 0;
  const retouchSplit = parseFloat(form.retoucher_split) || 0;
  const businessSplit = 100 - photoSplit - retouchSplit;
  const photographers = assignedWorkers.filter(w => w.role === 'photographer');
  const retouchers = assignedWorkers.filter(w => w.role === 'retoucher');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/gigs" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Gigs</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New Gig</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Gig Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input name="title" value={form.title} onChange={handleChange} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
              <input name="client_name" value={form.client_name} onChange={handleChange} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gig Date *</label>
              <input name="gig_date" type="date" value={form.gig_date} onChange={handleChange} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
              <input name="client_email" type="email" value={form.client_email} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Phone</label>
              <input name="client_phone" value={form.client_phone} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input name="location" value={form.location} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Reference</label>
              <input name="invoice_reference" value={form.invoice_reference} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" value={form.status} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
          </div>
        </div>

        {/* Payment Splits */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Payment Splits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (GHS) *</label>
              <input name="total_amount" type="number" min="0" value={form.total_amount} onChange={handleChange} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photographer %</label>
              <input name="photographer_split" type="number" min="0" max="100" value={form.photographer_split} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retoucher %</label>
              <input name="retoucher_split" type="number" min="0" max="100" value={form.retoucher_split} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
            </div>
          </div>
          {total > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-600">Photographers ({photoSplit}%):</span><span className="font-medium">{formatCurrency(total * photoSplit / 100)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Retouchers ({retouchSplit}%):</span><span className="font-medium">{formatCurrency(total * retouchSplit / 100)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Business ({businessSplit}%):</span><span className="font-medium">{formatCurrency(total * businessSplit / 100)}</span></div>
            </div>
          )}
        </div>

        {/* Invoice Option */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Create Invoice</h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.create_invoice}
                onChange={e => setForm({ ...form, create_invoice: e.target.checked })}
                className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-gray-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
            </label>
          </div>
          {form.create_invoice && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
              <input name="invoice_number" value={form.invoice_number} onChange={handleChange}
                placeholder={INVOICE_NUMBER_PLACEHOLDER}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input name="invoice_due_date" type="date" value={form.invoice_due_date} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
              </div>
            </div>
          )}
        </div>

        {/* Worker Assignment */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Assign Workers</h2>
          {workers.length === 0 ? (
            <p className="text-gray-500 text-sm">No workers yet. <Link href="/workers" className="text-gray-900 underline">Add workers</Link> first.</p>
          ) : (
            <div className="space-y-3">
              {workers.map(worker => {
                const isPhotographer = assignedWorkers.some(w => w.worker_id === worker.id && w.role === 'photographer');
                const isRetoucher = assignedWorkers.some(w => w.worker_id === worker.id && w.role === 'retoucher');
                const isAssigned = isPhotographer || isRetoucher;
                return (
                  <div key={worker.id} className={`flex items-center justify-between p-3 rounded-lg border ${isAssigned ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                    <div>
                      <p className="font-medium text-gray-900">{worker.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{worker.skills}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={isPhotographer}
                          onChange={() => toggleWorkerRole(worker.id, 'photographer')}
                          className="w-4 h-4 text-gray-900 rounded" />
                        <span className="text-sm font-medium text-gray-700">📸 Photo</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={isRetoucher}
                          onChange={() => toggleWorkerRole(worker.id, 'retoucher')}
                          className="w-4 h-4 text-gray-900 rounded" />
                        <span className="text-sm font-medium text-gray-700">🎨 Retouch</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {assignedWorkers.length > 0 && total > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p className="font-medium text-gray-700 mb-2">Payment per worker:</p>
              {photographers.length > 0 && (
                <p className="text-gray-600">
                  Each photographer: {formatCurrency((total * photoSplit / 100) / photographers.length)} ({photographers.length} photographer{photographers.length > 1 ? 's' : ''})
                </p>
              )}
              {retouchers.length > 0 && (
                <p className="text-gray-600">
                  Each retoucher: {formatCurrency((total * retouchSplit / 100) / retouchers.length)} ({retouchers.length} retoucher{retouchers.length > 1 ? 's' : ''})
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Gig'}
          </button>
          <Link href="/gigs" className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
