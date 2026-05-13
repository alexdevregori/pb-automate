import { runSyncField } from './syncField.js';
import { runPropagateTags } from './propagateTags.js';
import { runRollupScore } from './rollupScore.js';

export const SCRIPT_REGISTRY = {
  syncField: {
    runner: runSyncField,
    name: 'Sync Custom Field',
    description: 'Sync a custom field value from parent to child entities.',
  },
  propagateTags: {
    runner: runPropagateTags,
    name: 'Propagate Tags',
    description: 'Copy tags from parent features down to all child sub-features.',
  },
  rollupScore: {
    runner: runRollupScore,
    name: 'Roll Up Priority Score',
    description: 'Aggregate child priority scores to the parent feature level.',
  },
};
