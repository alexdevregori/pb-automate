import { SCRIPT_REGISTRY } from '../lib/scriptRegistry';

export default function Configure({ scriptId, onContinue, initialConfig, submitLabel }) {
  const entry = SCRIPT_REGISTRY[scriptId];
  if (!entry) {
    return (
      <div className="rounded-lg border border-pb-err-bg bg-pb-err-bg/50 p-4 text-sm text-pb-err-text">
        Unknown script: {scriptId}
      </div>
    );
  }
  const { ConfigureComponent } = entry;
  return <ConfigureComponent onContinue={onContinue} initialConfig={initialConfig} submitLabel={submitLabel} />;
}
