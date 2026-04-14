import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { deployScript } from '../lib/api';
import StepBar from '../components/StepBar';

export default function Deploy() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scriptId, config } = location.state || {};
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState(null);

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    try {
      const result = await deployScript({ scriptId, ...config });
      navigate('/success', { state: { deployment: result } });
    } catch (err) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  const rows = [
    ['Script', scriptId],
    ['Source', `${config?.sourceEntity} → ${config?.sourceField}`],
    ['Target', `${config?.targetEntity} → ${config?.targetField}`],
    ['Direction', config?.direction],
    ['Schedule', config?.schedule],
    ['Overwrite existing', config?.overwriteExisting ? 'Yes' : 'No'],
    ['Skip if empty', config?.skipIfEmpty ? 'Yes' : 'No'],
    ['Log changes', config?.logChanges ? 'Yes' : 'No'],
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <StepBar current={4} />
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="mb-1 text-xl font-bold text-pb-dark">Review & Deploy</h2>
        <p className="mb-6 text-sm text-gray-500">
          Confirm your configuration before deploying.
        </p>

        <div className="mb-6 rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-500">{label}</td>
                  <td className="px-4 py-2.5 text-pb-dark">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90 disabled:opacity-50"
        >
          {deploying ? 'Deploying...' : 'Deploy Script'}
        </button>
      </div>
    </div>
  );
}
