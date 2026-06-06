'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface OpenGig {
  id: number;
  title: string;
  client_name: string;
  gig_date: string;
  location: string;
  total_amount: number;
  photographer_split: number;
  retoucher_split: number;
  description: string;
  status: string;
  outstanding: number;
}

interface Worker {
  id: number;
  name: string;
  email: string;
  skills: string;
}

export default function OpenGigsPage() {
  const [gigs, setGigs] = useState<OpenGig[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<number | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string[]>>({});
  const [selectedWorkers, setSelectedWorkers] = useState<Record<number, number[]>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadedRef = useRef(false);

  const fetchGigs = async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    const res = await fetch(`/api/gigs/open?${p}`);
    const data = await res.json();
    setGigs(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchGigs();
      fetch('/api/workers').then(r => r.json()).then(d => setWorkers(Array.isArray(d) ? d : []));
    }
  }, [search, fetchGigs]);

  const toggleWorker = (gigId: number, workerId: number) => {
    const current = selectedWorkers[gigId] || [];
    if (current.includes(workerId)) {
      setSelectedWorkers({ ...selectedWorkers, [gigId]: current.filter(id => id !== workerId) });
    } else {
      setSelectedWorkers({ ...selectedWorkers, [gigId]: [...current, workerId] });
    }
  };

  const toggleRole = (gigId: number, role: string) => {
    const current = selectedRoles[gigId] || [];
    if (current.includes(role)) {
      setSelectedRoles({ ...selectedRoles, [gigId]: current.filter(r => r !== role) });
    } else {
      setSelectedRoles({ ...selectedRoles, [gigId]: [...current, role] });
    }
  };

  const handleAssign = async (gigId: number) => {
    const workerIds = selectedWorkers[gigId] || [];
    const roles = selectedRoles[gigId] || [];
    if (workerIds.length === 0 || roles.length === 0) {
      setMsg({ type: 'err', text: 'Select at least one worker and one role' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    setAssigning(gigId);
    let assigned = 0;
    let failed = 0;

    for (const workerId of workerIds) {
      for (const role of roles) {
        const res = await fetch(`/api/gigs/${gigId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: workerId, role }),
        });
        if (res.ok) {
          assigned++;
        } else {
          failed++;
        }
      }
    }

    if (assigned > 0) {
      setMsg({ type: 'ok', text: `${assigned} assignment${assigned > 1 ? 's' : ''} created${failed > 0 ? ` (${failed} skipped)` : ''}` });
    } else {
      setMsg({ type: 'err', text: 'All assignments failed — workers may already be assigned to these roles' });
    }

    fetchGigs();
    setSelectedWorkers({ ...selectedWorkers, [gigId]: [] });
    setSelectedRoles({ ...selectedRoles, [gigId]: [] });
    setAssigning(null);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gigs" className="text-sm text-gray-500 pick-gray-700">&larr; Back to Gigs</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Open Gigs</h1>
        <p className="text-gray-600 mt-1">Gigs waiting for workers. Assign workers and roles below.</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 ${
          msg.type === 'ok' ? 'bg-green-50 text-green-800 border-green-300' : 'bg-red-50 text-red-800 border-red-300'
        }`}>
          {msg.text}
        </div>
      )}

      <div className="flex gap-3">
        <input type="text" placeholder="Search open gigs..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : gigs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
          <p className="text-gray-400 mb-2">No open gigs available</p>
          <p className="text-sm text-gray-500">All gigs have workers assigned, or no gigs exist yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gigs.map(gig => {
            const photoTotal = gig.total_amount * gig.photographer_split / 100;
            const retouchTotal = gig.total_amount * gig.retoucher_split / 100;
            const roles = selectedRoles[gig.id] || [];
            const workerIds = selectedWorkers[gig.id] || [];
            const canSubmit = roles.length > 0 && workerIds.length > 0;

            return (
              <div key={gig.id} className="bg-white rounded-2xl border-2 border-gray-200 p-5">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Gig info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link href={`/gigs/${gig.id}`} className="text-lg font-bold text-gray-900 hover:text-gray-600">
                        {gig.title}
                      </Link>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-yellow-100 text-yellow-800">
                        {gig.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-semibold">{gig.client_name} &bull; {gig.gig_date}</p>
                    {gig.location && <p className="text-sm text-gray-500 mt-1">Location: {gig.location}</p>}
                    {gig.description && <p className="text-sm text-gray-500 mt-1">{gig.description}</p>}

                    <div className="flex gap-4 mt-3 text-sm">
                      <span className="text-gray-600">Total: <span className="font-bold text-gray-900">{formatCurrency(gig.total_amount)}</span></span>
                      <span className="text-blue-600">📸 {gig.photographer_split}% = {formatCurrency(photoTotal)}</span>
                      <span className="text-purple-600">🎨 {gig.retoucher_split}% = {formatCurrency(retouchTotal)}</span>
                    </div>
                  </div>

                  {/* Assignment panel */}
                  <div className="lg:w-80 bg-gray-50 rounded-xl p-4 space-y-4">
                    <p className="text-sm font-bold text-gray-700">Assign Workers</p>

                    {/* Workers multi-select */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Workers</label>
                      <div className="max-h-40 overflow-y-auto space-y-1 border-2 border-gray-200 rounded-lg p-2">
                        {workers.length === 0 ? (
                          <p className="text-xs text-gray-400">No workers yet</p>
                        ) : (
                          workers.map(w => (
                            <label key={w.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition ${
                              workerIds.includes(w.id) ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-100'
                            }`}>
                              <input type="checkbox" checked={workerIds.includes(w.id)}
                                onChange={() => toggleWorker(gig.id, w.id)}
                                className="w-3.5 h-3.5 rounded" />
                              <span className="text-sm font-semibold text-gray-800">{w.name}</span>
                              <span className="text-xs text-gray-500 capitalize ml-auto">{w.skills}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {workerIds.length > 0 && (
                        <p className="text-xs text-blue-600 font-semibold mt-1">{workerIds.length} worker{workerIds.length > 1 ? 's' : ''} selected</p>
                      )}
                    </div>

                    {/* Roles multi-select */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Role(s)</label>
                      <div className="space-y-2">
                        <label className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition ${
                          roles.includes('photographer') ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                        }`}>
                          <input type="checkbox" checked={roles.includes('photographer')}
                            onChange={() => toggleRole(gig.id, 'photographer')}
                            className="w-4 h-4 rounded" />
                          <span className="text-sm font-bold text-gray-700">📸 Photographer ({gig.photographer_split}%)</span>
                          <span className="text-xs text-gray-500 ml-auto">{formatCurrency(photoTotal)}</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition ${
                          roles.includes('retoucher') ? 'border-purple-600 bg-purple-50' : 'border-gray-300 hover:border-gray-400'
                        }`}>
                          <input type="checkbox" checked={roles.includes('retoucher')}
                            onChange={() => toggleRole(gig.id, 'retoucher')}
                            className="w-4 h-4 rounded" />
                          <span className="text-sm font-bold text-gray-700">🎨 Retoucher ({gig.retoucher_split}%)</span>
                          <span className="text-xs text-gray-500 ml-auto">{formatCurrency(retouchTotal)}</span>
                        </label>
                      </div>
                    </div>

                    {/* Summary */}
                    {workerIds.length > 0 && roles.length > 0 && (
                      <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                        <p className="font-bold text-gray-700 mb-1">Summary</p>
                        {workerIds.map(wId => {
                          const w = workers.find(x => x.id === wId);
                          return roles.map(role => {
                            const pay = role === 'photographer' ? photoTotal : retouchTotal;
                            return (
                              <div key={`${wId}-${role}`} className="flex justify-between text-xs">
                                <span className="text-gray-600">{w?.name} — {role === 'photographer' ? '📸' : '🎨'} {role}</span>
                                <span className="font-bold text-green-700">{formatCurrency(pay)}</span>
                              </div>
                            );
                          });
                        })}
                        <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1">
                          <span className="text-gray-700">Total assignments: {workerIds.length * roles.length}</span>
                        </div>
                      </div>
                    )}

                    <button onClick={() => handleAssign(gig.id)} disabled={!canSubmit || assigning === gig.id}
                      className="w-full bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                      {assigning === gig.id ? 'Assigning...' : `Assign ${workerIds.length * roles.length || ''}`.trim() || 'Sign Up'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
