import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import Configure from './Configure';
import { getScript, updateDeployment } from '../lib/api';

export default function ScriptEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getScript(id)
      .then((res) => setDeployment(res.deployment))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!deployment) return <div className="text-sm text-gray-500">Loading…</div>;

  const handleSave = async ({ config }) => {
    setSaving(true);
    try {
      await updateDeployment(id, {
        config,
        // Top-level schedule mirrors the one inside config — keep them in sync.
        schedule: config.schedule || deployment.schedule || 'manual',
      });
      toast.success('Saved');
      navigate(`/scripts/${id}`);
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 text-xs text-gray-500">
        <Link to="/dashboard" className="hover:text-pb-dark">Scripts</Link>
        <span className="px-1">›</span>
        <Link to={`/scripts/${id}`} className="hover:text-pb-dark">
          {deployment.scriptId}
        </Link>
        <span className="px-1">›</span>
        <span>Edit</span>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Configure
          scriptId={deployment.scriptId}
          initialConfig={deployment.config}
          onContinue={handleSave}
          submitLabel={saving ? 'Saving…' : 'Save changes'}
        />
        <button
          onClick={() => navigate(`/scripts/${id}`)}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
