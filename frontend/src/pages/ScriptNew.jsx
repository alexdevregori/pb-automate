import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MiniStepBar from '../components/MiniStepBar';
import Configure from './Configure';
import Deploy from './Deploy';

const SCRIPTS = [
  { id: 'countFeatures', label: 'Count Features (Smoke Test)' },
  { id: 'syncField', label: 'Sync Custom Field' },
];

export default function ScriptNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [scriptId, setScriptId] = useState('countFeatures');
  const [config, setConfig] = useState(null);

  return (
    <div className="mx-auto max-w-2xl">
      <MiniStepBar current={step} />

      {step === 1 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Script</label>
            <div className="flex gap-2">
              {SCRIPTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScriptId(s.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    scriptId === s.id
                      ? 'border-pb-blue bg-indigo-50 text-pb-blue'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
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
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Deploy
            scriptId={scriptId}
            config={config}
            onSuccess={(result) => {
              toast.success('Script deployed');
              navigate(`/scripts/${result.deployment.id}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
