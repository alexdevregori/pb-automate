import axios from 'axios';

const PB_API_BASE = 'https://api.productboard.com';

export function createPBClient(accessToken) {
  const client = axios.create({
    baseURL: PB_API_BASE,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Version': '1',
      'Content-Type': 'application/json',
    },
  });

  return {
    async getFeatures(cursor) {
      const params = cursor ? { pageCursor: cursor } : {};
      const res = await client.get('/features', { params });
      return res.data;
    },

    async getFeatureCustomFields(featureId) {
      const res = await client.get(`/features/${featureId}/custom-fields`);
      return res.data;
    },

    async updateCustomField(featureId, fieldId, value) {
      const res = await client.patch(`/features/${featureId}/custom-fields/${fieldId}`, {
        value,
      });
      return res.data;
    },

    async getFeature(featureId) {
      const res = await client.get(`/features/${featureId}`);
      return res.data;
    },
  };
}

// Mock client for local development without a real PB account
export function createMockPBClient() {
  const mockFeatures = [
    {
      id: 'feat-1',
      name: 'User Authentication',
      type: 'feature',
      parent: null,
      children: ['feat-2', 'feat-3'],
    },
    {
      id: 'feat-2',
      name: 'Login Flow',
      type: 'sub-feature',
      parent: 'feat-1',
      children: [],
    },
    {
      id: 'feat-3',
      name: 'Registration Flow',
      type: 'sub-feature',
      parent: 'feat-1',
      children: [],
    },
    {
      id: 'feat-4',
      name: 'Dashboard',
      type: 'feature',
      parent: null,
      children: ['feat-5'],
    },
    {
      id: 'feat-5',
      name: 'Analytics Widget',
      type: 'sub-feature',
      parent: 'feat-4',
      children: [],
    },
  ];

  const mockFields = {
    'feat-1': [
      { id: 'cf-status', name: 'Status', value: 'In Progress' },
      { id: 'cf-priority', name: 'Priority', value: 'High' },
      { id: 'cf-effort', name: 'Effort', value: 8 },
    ],
    'feat-2': [
      { id: 'cf-status', name: 'Status', value: 'Done' },
      { id: 'cf-priority', name: 'Priority', value: 'High' },
      { id: 'cf-effort', name: 'Effort', value: 3 },
    ],
    'feat-3': [
      { id: 'cf-status', name: 'Status', value: null },
      { id: 'cf-priority', name: 'Priority', value: 'Medium' },
      { id: 'cf-effort', name: 'Effort', value: 5 },
    ],
    'feat-4': [
      { id: 'cf-status', name: 'Status', value: 'Planning' },
      { id: 'cf-priority', name: 'Priority', value: 'Medium' },
      { id: 'cf-effort', name: 'Effort', value: 13 },
    ],
    'feat-5': [
      { id: 'cf-status', name: 'Status', value: null },
      { id: 'cf-priority', name: 'Priority', value: null },
      { id: 'cf-effort', name: 'Effort', value: 5 },
    ],
  };

  return {
    async getFeatures() {
      return { data: mockFeatures, totalResults: mockFeatures.length };
    },

    async getFeatureCustomFields(featureId) {
      return { data: mockFields[featureId] || [] };
    },

    async updateCustomField(featureId, fieldId, value) {
      const fields = mockFields[featureId];
      if (fields) {
        const field = fields.find((f) => f.id === fieldId);
        if (field) {
          const oldValue = field.value;
          field.value = value;
          return { data: { ...field, value }, oldValue };
        }
      }
      return { data: null };
    },

    async getFeature(featureId) {
      const feat = mockFeatures.find((f) => f.id === featureId);
      return { data: feat || null };
    },

    _mockFeatures: mockFeatures,
    _mockFields: mockFields,
  };
}
