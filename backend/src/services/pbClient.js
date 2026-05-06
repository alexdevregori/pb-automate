import axios from 'axios';

const PB_API_BASE = 'https://api.productboard.com';

/**
 * Productboard V2 API client.
 *
 * V2 unifies what V1 had as separate /features, /sub-features, etc. into a single
 * /entities endpoint with type filtering. Custom fields are inline in each entity's
 * `fields` map (keyed by UUID for custom fields, slug for built-ins like `status`).
 */
export function createPBClient(accessToken) {
  const client = axios.create({
    baseURL: `${PB_API_BASE}/v2`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    /**
     * List entities of one or more types. Paginates internally — returns ALL
     * entities matching the type filter, walking pageCursor until exhausted.
     *
     * @param {string[]} types — e.g. ['feature', 'subfeature']
     * @returns {Promise<Array>} flat list of entity records
     */
    async listAllEntities(types) {
      if (!types?.length) return [];
      const params = new URLSearchParams();
      for (const t of types) params.append('type[]', t);

      let all = [];
      let cursor = null;
      let pages = 0;
      do {
        if (cursor) params.set('pageCursor', cursor);
        const res = await client.get(`/entities?${params.toString()}`);
        const data = res.data?.data || [];
        all = all.concat(data);
        // PB pagination: a `next` link in `links` or a top-level `pageCursor`.
        // Try both for resilience.
        const next = res.data?.links?.next;
        if (next) {
          // Extract pageCursor from the next URL.
          const m = /[?&]pageCursor=([^&]+)/.exec(next);
          cursor = m ? decodeURIComponent(m[1]) : null;
        } else {
          cursor = res.data?.pageCursor || null;
        }
        pages += 1;
        if (pages > 100) break; // safety
      } while (cursor);

      return all;
    },

    /**
     * Get a single entity with all configured fields and values.
     */
    async getEntity(id) {
      const res = await client.get(`/entities/${id}`);
      return res.data?.data;
    },

    /**
     * Patch an entity's fields. `fields` is a flat map of { fieldKey: value }
     * where fieldKey is either a UUID (custom field) or a slug (built-in).
     */
    async updateEntityFields(id, fields) {
      const res = await client.patch(`/entities/${id}`, { fields });
      return res.data?.data;
    },

    /**
     * Fetch the field schema for an entity type. Used to populate the field picker.
     */
    async getEntityConfiguration(entityType) {
      const res = await client.get(`/entities/configurations/${entityType}`);
      return res.data;
    },
  };
}
