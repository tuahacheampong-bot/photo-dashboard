'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

function Page() {
  const params = useSearchParams();
  const code = params.get('code');
  const error = params.get('error');

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  interface TokenResult {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    details?: string;
  }

  const [result, setResult] = useState<TokenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/zoho/settings').then(r => r.json()).then(d => {
      if (d.client_id) setClientId(d.client_id);
    });
  }, []);

  const exchange = async () => {
    if (!code || !clientId || !clientSecret) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/zoho/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: 'Network error' });
    }
    setLoading(false);
  };

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Get Zoho Refresh Token</h1>
          <p className="text-gray-500 mt-1 text-sm">Exchange your authorization code for tokens</p>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
            <p className="text-red-800 text-sm font-bold">Error: {error}</p>
          </div>
        )}

        {code ? (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 mb-6">
            <p className="text-green-800 text-sm font-bold">✅ Authorization code received</p>
            <p className="text-green-700 text-xs mt-1">Enter your client secret below and click the button</p>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6">
            <p className="text-amber-800 text-sm font-bold">No authorization code found</p>
            <a href="/settings" className="text-amber-900 text-sm underline font-bold mt-1 inline-block">Go to Settings to get the authorization link →</a>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Client ID</label>
            <input value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900 font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Client Secret</label>
            <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
              placeholder="Paste your client secret here" />
          </div>
          <button onClick={exchange} disabled={!code || loading}
            className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:opacity-40 transition">
            {loading ? 'Exchanging...' : '🔄 Exchange Code for Tokens'}
          </button>
        </div>

        {result && (
          <div className="mt-8">
            {result.error ? (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5">
                <p className="text-red-800 font-bold">Error: {result.error}</p>
                {result.details && <p className="text-red-600 text-sm mt-1">{result.details}</p>}
                <p className="text-red-700 text-sm mt-2">The authorization code may have already been used. Go back to Settings and get a new link.</p>
                <a href="/settings" className="inline-block mt-3 bg-red-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-900">Go to Settings</a>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ACCESS TOKEN */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Access Token</p>
                      <p className="text-xs text-gray-500">Expires in {result.expires_in}s — NOT the one you need</p>
                    </div>
                    <button onClick={() => copy(result.access_token || '', 'access')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        copiedField === 'access' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}>
                      {copiedField === 'access' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-200 font-mono text-xs break-all text-gray-600">
                    {result.access_token || ''}
                  </div>
                </div>

                {/* REFRESH TOKEN - THE ONE YOU NEED */}
                <div className="bg-green-50 border-3 border-green-500 rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-base font-bold text-green-900">⭐ Refresh Token</p>
                      <p className="text-sm text-green-700 font-semibold">Copy this and paste it in Settings</p>
                    </div>
                    <button onClick={() => copy(result.refresh_token || '', 'refresh')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        copiedField === 'refresh' ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}>
                      {copiedField === 'refresh' ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                  <div className="bg-white p-4 rounded-xl border-2 border-green-400 font-mono text-sm break-all text-gray-900 leading-relaxed select-all">
                    {result.refresh_token}
                  </div>
                </div>

                {/* Next steps */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <p className="text-blue-800 font-bold text-sm">Next steps:</p>
                  <ol className="list-decimal list-inside text-blue-700 text-sm mt-1 space-y-1">
                    <li>Click <strong>Copy</strong> above to copy the Refresh Token</li>
                    <li>Go to <a href="/settings" className="underline font-bold">Settings</a></li>
                    <li>Paste in the <strong>Refresh Token</strong> field</li>
                    <li>Enter your <strong>Organization ID</strong></li>
                    <li>Click <strong>Save</strong>, then <strong>Test Connection</strong></li>
                  </ol>
                </div>

                <a href="/settings" className="block text-center bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition">
                  Go to Settings →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TokenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    }>
      <Page />
    </Suspense>
  );
}
