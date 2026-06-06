'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [form, setForm] = useState({ client_id: '', client_secret: '', refresh_token: '', organization_id: '', region: 'com' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/zoho/settings').then(r => r.json()).then(d => {
      if (d.configured) {
        setForm({
          client_id: d.client_id, client_secret: d.client_secret,
          refresh_token: d.refresh_token, organization_id: d.organization_id,
          region: d.region || 'com',
        });
      }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/zoho/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Save failed: ${data.error || 'Unknown error'}`);
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(`Save failed: ${e}`);
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/zoho/settings', { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, message: data.error || 'Test failed' });
      } else {
        setTestResult(data);
      }
    } catch (e) {
      setTestResult({ ok: false, message: String(e) });
    }
    setTesting(false);
  };

  const regionUrls: Record<string, string> = {
    com: 'https://accounts.zoho.com',
    eu: 'https://accounts.zoho.eu',
    in: 'https://accounts.zoho.in',
    'com.au': 'https://accounts.zoho.com.au',
    jp: 'https://accounts.zoho.jp',
    ca: 'https://accounts.zoho.ca',
  };

  const authUrl = `${regionUrls[form.region] || regionUrls.com}/oauth/v2/auth?scope=ZohoInvoice.invoices.ALL,ZohoInvoice.contacts.ALL,ZohoInvoice.settings.READ&client_id=${form.client_id || 'YOUR_CLIENT_ID'}&response_type=code&access_type=offline&redirect_uri=https://photo-dashboard-nu.vercel.app/token&prompt=consent`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure your dashboard</p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Zoho Invoices Integration</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Region</label>
            <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900 font-semibold">
              <option value="com">US / Global (invoice.zoho.com)</option>
              <option value="eu">Europe (invoice.zoho.eu)</option>
              <option value="in">India (invoice.zoho.in)</option>
              <option value="com.au">Australia (invoice.zoho.com.au)</option>
              <option value="jp">Japan (invoice.zoho.jp)</option>
              <option value="ca">Canada (invoice.zoho.ca)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Organization ID</label>
            <input value={form.organization_id} onChange={e => setForm({ ...form, organization_id: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Client ID</label>
            <input value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900 font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Client Secret</label>
            <input type="password" value={form.client_secret} onChange={e => setForm({ ...form, client_secret: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-gray-800 mb-1">Refresh Token</label>
            <input type="password" value={form.refresh_token} onChange={e => setForm({ ...form, refresh_token: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900" />
          </div>
        </div>

        {testResult && (
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 ${testResult.ok ? 'bg-green-50 text-green-800 border-green-300' : 'bg-red-50 text-red-800 border-red-300'}`}>
            {testResult.message}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition">
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save'}
          </button>
          <button onClick={test} disabled={testing}
            className="px-6 py-2.5 border-2 border-gray-300 rounded-xl font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50 transition">
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-gray-900 rounded-2xl p-6 text-sm space-y-4 mt-6">
          <p className="font-bold text-white text-base">How to connect Zoho:</p>

          <div>
            <p className="text-gray-300 font-bold">Step 1: Create a Zoho API Client</p>
            <ol className="list-decimal list-inside text-gray-400 space-y-1 mt-1">
              <li>Go to <a href="https://api-console.zoho.com/" target="_blank" className="text-white underline font-bold" rel="noopener noreferrer">api-console.zoho.com</a></li>
              <li>Click <strong className="text-white">Add Client</strong> → <strong className="text-white">Server-based Application</strong></li>
              <li>Homepage URL: <code className="bg-gray-800 text-green-400 px-1.5 py-0.5 rounded">https://photo-dashboard-nu.vercel.app</code></li>
              <li>Redirect URI: <code className="bg-gray-800 text-green-400 px-1.5 py-0.5 rounded">https://photo-dashboard-nu.vercel.app/token</code></li>
              <li>Click Create, copy your <strong className="text-white">Client ID</strong> and <strong className="text-white">Client Secret</strong></li>
            </ol>
          </div>

          <div>
            <p className="text-gray-300 font-bold">Step 2: Save credentials above, then visit:</p>
            <div className="bg-gray-800 p-3 rounded-xl border border-gray-700 font-mono text-xs break-all mt-2 text-green-400 select-all">
              {authUrl}
            </div>
          </div>

          <div>
            <p className="text-gray-300 font-bold">Step 3: Get your Refresh Token</p>
            <ol className="list-decimal list-inside text-gray-400 space-y-1 mt-1">
              <li>Click <strong className="text-white">Accept</strong> when Zoho asks to authorize</li>
              <li>You&apos;ll land on a page with your refresh token</li>
              <li>Click <strong className="text-white">Copy</strong> → paste in <strong className="text-white">Refresh Token</strong> field → Save</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Default Payment Splits</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
            <p className="text-sm font-semibold text-gray-600">Photographer</p>
            <p className="text-2xl font-bold text-gray-900">30%</p>
          </div>
          <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
            <p className="text-sm font-semibold text-gray-600">Retoucher</p>
            <p className="text-2xl font-bold text-gray-900">30%</p>
          </div>
          <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
            <p className="text-sm font-semibold text-gray-600">Business</p>
            <p className="text-2xl font-bold text-gray-900">40%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
