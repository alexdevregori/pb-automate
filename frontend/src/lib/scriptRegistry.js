import SyncFieldConfigure from '../pages/configure/SyncFieldConfigure.jsx';

export const SCRIPT_REGISTRY = {
  syncField: {
    label: 'Sync Custom Field',
    description: 'Sync a custom field value from parent to child entities.',
    ConfigureComponent: SyncFieldConfigure,
  },
};
