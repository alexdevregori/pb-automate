import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MiniStepBar from '../components/MiniStepBar';
import Configure from './Configure';
import Deploy from './Deploy';
import { SCRIPT_REGISTRY } from '../lib/scriptRegistry';

const SCRIPTS = Object.entries(SCRIPT_REGISTRY).map(([id, s]) => ({ id, label: s.label }));

export default function ScriptNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [scriptId, setScriptId] = useState(SCRIPTS[0]?.id);
  const [config, setConfig] = useState(null);

  return (
    <div className="mx-auto max-w-2xl">
      <MiniStepBar current={step} />

      {step === 1 && (
        <div className="rounded-2xl border border-pb-dark/[0.08] bg-white p-8 shadow-sm">
          {SCRIPTS.length > 1 && (
            <div className="mb-5">
              <label className="mb-2 block text-[12.5px] font-medium text-pb-dark">Script type</label>
              <div className="flex gap-2">
                {SCRIPTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScriptId(s.id)}
                    className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      scriptId === s.id
                        ? 'border-pb-dark bg-pb-dark text-pb-cream'
                        : 'border-pb-dark/[0.14] text-pb-muted hover:bg-pb-cream'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Configure
            scriptId={scriptId}
            onContinue={(c) => {
              setConfig(c.config);
              setStep(2);
            }}
          />
        </div>
      )}

      {step === 2 && config && (
        <div className="rounded-2xl border border-pb-dark/[0.08] bg-white p-8 shadow-sm">
          <Deploy
            scriptId={scriptId}
            config={config}
            onSuccess={(result) => {
              toast.success('Script deployed');
              navigate(`/scripts/${result.deployment.id}`);
            }}
          />
          <button
            onClick={() => setStep(1)}
            className="mt-3 w-full rounded-lg border border-pb-dark/[0.14] px-4 py-2.5 text-sm font-medium text-pb-muted transition-colors hover:bg-pb-cream"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
