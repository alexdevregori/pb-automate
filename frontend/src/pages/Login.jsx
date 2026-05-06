import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../lib/auth';

export default function Login() {
  const navigate = useNavigate();
  const [pbToken, setPbToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleOAuth = () => {
    window.location.href = '/api/auth/login';
  };

  const handleTokenSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pbToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to authenticate');
      setToken(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-pb-dark">PB Automate</h1>
        <p className="mb-6 text-sm text-gray-500">
          Deploy field-sync automation scripts to your Productboard workspace.
        </p>

        <button
          onClick={handleOAuth}
          className="mb-3 w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90"
        >
          Connect with Productboard
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-400">or use a PB API token</span>
          </div>
        </div>

        <form onSubmit={handleTokenSubmit}>
          <input
            type="password"
            value={pbToken}
            onChange={(e) => setPbToken(e.target.value)}
            placeholder="Paste your Productboard API token"
            className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !pbToken.trim()}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Continue with API token'}
          </button>
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
          <p className="mt-3 text-xs text-gray-500">
            Find your token in Productboard → Settings → Integrations → Public API.
          </p>
        </form>
      </div>
    </div>
  );
}
