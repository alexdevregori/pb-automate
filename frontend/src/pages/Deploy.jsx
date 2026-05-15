import { useState } from 'react';
import { deployScript } from '../lib/api';
import { SCRIPT_REGISTRY } from '../lib/scriptRegistry';

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

  const rows = [
    ['Name',               config?.name || '(not set)'],
    ['Script', SCRIPT_REGISTRY[scriptId]?.label || scriptId],
    ['From',               config?.parentType || '(not set)'],
    ['To',                 (config?.childTypes || []).join(', ') || '(none selected)'],
    ['Field',              config?.fieldName || '(not set)'],
    ['Mode',               config?.dryRun ? 'Dry run (preview only)' : 'Live (writes to Productboard)'],
    ['Schedule',           config?.schedule],
    ['Overwrite existing', config?.overwriteExisting ? 'Yes' : 'No'],
    ['Skip if parent empty', config?.skipIfEmpty ? 'Yes' : 'No'],
  ];

  return (
    <div>
      <h2 className="mb-1 font-sans font-semibold text-2xl tracking-tight text-pb-dark">Review &amp; Deploy</h2>
      <p className="mb-6 text-[13.5px] text-pb-muted">Confirm your configuration before deploying.</p>

      <div className="mb-6 overflow-hidden rounded-xl border border-pb-dark/[0.08]">
        <table className="w-full text-[13.5px]">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-pb-dark/[0.06] last:border-0">
                <td className="px-4 py-3 font-medium text-pb-subtle">{label}</td>
                <td className="px-4 py-3 text-pb-dark">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-pb-err-bg px-4 py-3 text-[13px] text-pb-err-text">{error}</div>
      )}

      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="w-full rounded-lg bg-pb-dark px-4 py-2.5 text-sm font-medium text-pb-cream transition-colors hover:bg-pb-dark/90 disabled:opacity-50"
      >
        {deploying ? 'Deploying…' : 'Deploy script'}
      </button>
    </div>
  );
}
