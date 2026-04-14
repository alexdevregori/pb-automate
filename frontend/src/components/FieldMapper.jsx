import React from 'react';

const entityOptions = ['Feature', 'Sub-feature', 'Component', 'Product'];
const fieldOptions = ['Status', 'Priority', 'Effort', 'Impact', 'Custom Score', 'Tags', 'Owner'];

export default function FieldMapper({ config, onChange }) {
  const update = (key, value) => onChange({ ...config, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Source Entity</label>
          <select
            value={config.sourceEntity}
            onChange={(e) => update('sourceEntity', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
          >
            {entityOptions.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Source Field</label>
          <select
            value={config.sourceField}
            onChange={(e) => update('sourceField', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
          >
            {fieldOptions.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="text-lg text-gray-400">↓</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Target Entity</label>
          <select
            value={config.targetEntity}
            onChange={(e) => update('targetEntity', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
          >
            {entityOptions.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Target Field</label>
          <select
            value={config.targetField}
            onChange={(e) => update('targetField', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
          >
            {fieldOptions.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
