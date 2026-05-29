'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function CallbackContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [exchangeResult, setExchangeResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleExchange = async () => {
    if (!code || !clientId || !clientSecret) {
      alert('Please fill in Client ID and Client Secret');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/zoho/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret }),
      });
      const data = await res.json();
      setExchangeResult(data);
    } catch (err) {
      setExchangeResult({ error: 'Network error' });
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Authorization Failed</h1>
          <p className="text-gray-500">{error}</p>
          <a href="/settings" className="mt-4 inline-block text-gray-900 font-medium hover:underline">
            Back to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🔑</div>
          <h1 className="text-xl font-bold text-gray-900">Exchange Authorization Code</h1>
          <p className="text-gray-500 mt-1">Enter your Zoho app credentials to get a refresh token</p>
        </div>

        {code && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-700">
              <span className="font-medium">Authorization Code:</span> {code.substring(0, 20)}...
            </p>
          </div>
        )}

        {!code && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-700">
              No authorization code found. Make sure you visit the Zoho authorization URL first.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
              placeholder="1000.XXXXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
            <input
              type="password"
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
              placeholder="abc123def456"
            />
          </div>

          <button
            onClick={handleExchange}
            disabled={!code || loading}
            className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? 'Exchanging...' : 'Get Refresh Token'}
          </button>
        </div>

        {exchangeResult && (
          <div className="mt-6">
            {exchangeResult.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium">Error: {exchangeResult.error}</p>
                {exchangeResult.details && (
                  <p className="text-xs text-red-600 mt-1">{exchangeResult.details}</p>
                )}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-green-700 font-medium">✅ Success! Copy these values to Settings:</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-green-600">Refresh Token:</label>
                    <div className="bg-white p-2 rounded border border-green-200 text-sm font-mono break-all">
                      {exchangeResult.refresh_token}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Access Token (expires in {exchangeResult.expires_in}s):</label>
                    <div className="bg-white p-2 rounded border border-green-200 text-sm font-mono break-all">
                      {exchangeResult.access_token}
                    </div>
                  </div>
                </div>
                <a
                  href="/settings"
                  className="block w-full text-center bg-green-700 text-white py-2 rounded-lg font-medium hover:bg-green-800 transition"
                >
                  Go to Settings →
                </a>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Settings
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ZohoCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
