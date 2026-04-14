import React from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../lib/auth';
import StepBar from '../components/StepBar';

export default function Login() {
  const navigate = useNavigate();

  const handleOAuth = () => {
    window.location.href = '/api/auth/login';
  };

  const handleMock = async () => {
    const res = await fetch('/api/auth/mock', { method: 'POST' });
    const data = await res.json();
    setToken(data.token);
    navigate('/picker');
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <StepBar current={1} />
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
            <span className="bg-white px-2 text-gray-400">or</span>
          </div>
        </div>

        <button
          onClick={handleMock}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Use Mock Workspace (Local Dev)
        </button>
      </div>
    </div>
  );
}
