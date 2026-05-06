import { useState } from 'react';
import { deployScript } from '../lib/api';

export default function Deploy({ scriptId, config, onSuccess }) {
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState(null);

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    try {
      const result = await deployScript({ scriptId, ...config });
      onSuccess(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  const rows =
    scriptId === 'countFeatures'
      ? [
          ['Script', 'Count Features (Smoke Test)'],
          ['Schedule', config?.schedule || 'manual'],
        ]
      : [
          ['Script', 'Sync Field'],
          ['From', config?.parentType || '(not set)'],
          ['To', (config?.childTypes || []).join(', ') || '(none selected)'],
          ['Field', config?.fieldName || '(not set)'],
          ['Mode', config?.dryRun ? 'Dry run (preview only)' : 'Live (writes to Productboard)'],
          ['Schedule', config?.schedule],
          ['Overwrite existing', config?.overwriteExisting ? 'Yes' : 'No'],
          ['Skip if parent empty', config?.skipIfEmpty ? 'Yes' : 'No'],
        ];

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-pb-dark">Review &amp; Deploy</h2>
      <p className="mb-6 text-sm text-gray-500">Confirm your configuration before deploying.</p>

      <div className="mb-6 overflow-hidden rounded-lg border border-gray-200">
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
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90 disabled:opacity-50"
      >
        {deploying ? 'Deploying...' : 'Deploy Script'}
      </button>
    </div>
  );
}
