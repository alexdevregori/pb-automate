import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StepBar from '../components/StepBar';

export default function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const deployment = location.state?.deployment || {};

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <StepBar current={5} />
      <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
        <div className="mb-4 text-4xl">✅</div>
        <h2 className="mb-2 text-xl font-bold text-pb-dark">Script Deployed!</h2>
        <p className="mb-6 text-sm text-gray-500">
          Your automation is live and will run on the configured schedule.
        </p>

        <div className="mb-6 rounded-lg bg-pb-gray p-4 text-left text-sm">
          <div className="mb-2">
            <span className="font-medium text-gray-500">Job ID: </span>
            <span className="font-mono text-pb-dark">{deployment.jobId || 'N/A'}</span>
          </div>
          <div className="mb-2">
            <span className="font-medium text-gray-500">Next Run: </span>
            <span className="text-pb-dark">{deployment.nextRun || 'N/A'}</span>
          </div>
          {deployment.logs && deployment.logs.length > 0 && (
            <div>
              <span className="font-medium text-gray-500">First Sync Output:</span>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-pb-dark p-3 text-xs text-green-400">
                {deployment.logs.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </pre>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/picker')}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Deploy Another
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
