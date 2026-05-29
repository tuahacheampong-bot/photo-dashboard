'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EditGigPage() {
  const params = useParams();
  const router = useRouter();
  const [workers, setWorkers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '', client_name: '', client_email: '', client_phone: '',
    gig_date: '', location: '', description: '', total_amount: '',
    photographer_split: '30', retoucher_split: '30',
    invoice_reference: '', status: 'pending',
  });
  const [assignedWorkers, setAssignedWorkers] = useState<{ worker_id: number; role: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/gigs/${params.id}`).then(r => r.json()),
      fetch('/api/workers').then(r => r.json()),
    ]).then(([gig, workersData]) => {
      setForm({
        title: gig.title, client_name: gig.client_name, client_email: gig.client_email || '',
        client_phone: gig.client_phone || '', gig_date: gig.gig_date, location: gig.location || '',
        description: gig.description || '', total_amount: gig.total_amount.toString(),
        photographer_split: gig.photographer_split.toString(), retoucher_split: gig.retoucher_split.toString(),
        invoice_reference: gig.invoice_reference || '', status: gig.status,
      });
      setAssignedWorkers(gig.workers.map((w: any) => ({ worker_id: w.worker_id, role: w.role })));
      setWorkers(workersData);
      setLoading(false);
    });
  }, [params.id]);

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
    const res = await fetch(`/api/gigs/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        total_amount: parseFloat(form.total_amount),
        photographer_split: parseFloat(form.photographer_split),
        retoucher_split: parseFloat(form.retoucher_split),
        workers: assignedWorkers,
      }),
    });
    if (res.ok) router.push(`/gigs/${params.id}`);
    else alert('Failed to update gig');
    setSaving(false);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={`/gigs/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Gig</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Edit Gig</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Gig Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input name="title" value={form.title} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
              <input name="client_name" value={form.client_name} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gig Date *</label>
              <input name="gig_date" type="date" value={form.gig_date} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
              <input name="client_email" type="email" value={form.client_email} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Phone</label>
              <input name="client_phone" value={form.client_phone} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input name="location" value={form.location} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Payment Splits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (GHS) *</label>
              <input name="total_amount" type="number" min="0" value={form.total_amount} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photographer %</label>
              <input name="photographer_split" type="number" min="0" max="100" value={form.photographer_split} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retoucher %</label>
              <input name="retoucher_split" type="number" min="0" max="100" value={form.retoucher_split} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Assign Workers</h2>
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
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/gigs/${params.id}`} className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
