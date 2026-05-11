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

  if (error) return <div className="text-sm text-pb-err-text">{error}</div>;
  if (!deployment) return <div className="text-sm text-pb-subtle">Loading…</div>;

  const handleSave = async ({ config }) => {
    setSaving(true);
    const { name, ...scriptConfig } = config;
    try {
      await updateDeployment(id, {
        name: name || deployment.scriptId,
        config: scriptConfig,
        schedule: scriptConfig.schedule || deployment.schedule || 'manual',
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
      <div className="mb-4 text-[12.5px] text-pb-subtle">
        <Link to="/dashboard" className="hover:text-pb-dark">Scripts</Link>
        <span className="px-1.5">›</span>
        <Link to={`/scripts/${id}`} className="hover:text-pb-dark">
          {deployment.name || deployment.scriptId}
        </Link>
        <span className="px-1.5">›</span>
        <span className="text-pb-dark">Edit</span>
      </div>

      <div className="rounded-2xl border border-pb-dark/[0.08] bg-white p-8 shadow-sm">
        <Configure
          scriptId={deployment.scriptId}
          initialConfig={{ name: deployment.name || '', ...deployment.config }}
          onContinue={handleSave}
          submitLabel={saving ? 'Saving…' : 'Save changes'}
        />
        <button
          onClick={() => navigate(`/scripts/${id}`)}
          className="mt-3 w-full rounded-lg border border-pb-dark/[0.14] px-4 py-2.5 text-sm font-medium text-pb-muted transition-colors hover:bg-pb-cream"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
