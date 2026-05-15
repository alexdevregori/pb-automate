import { describe, it, expect } from 'vitest';
import { SCRIPT_REGISTRY } from './index.js';

describe('SCRIPT_REGISTRY', () => {
  it('exports an object', () => {
    expect(typeof SCRIPT_REGISTRY).toBe('object');
    expect(SCRIPT_REGISTRY).not.toBeNull();
  });

  it('has a runner function for every registered script', () => {
    for (const [id, entry] of Object.entries(SCRIPT_REGISTRY)) {
      expect(typeof entry.runner, `${id} is missing a runner function`).toBe('function');
    }
  });

  it('has name and description strings for every registered script', () => {
    for (const [id, entry] of Object.entries(SCRIPT_REGISTRY)) {
      expect(typeof entry.name, `${id} is missing name`).toBe('string');
      expect(typeof entry.description, `${id} is missing description`).toBe('string');
    }
  });

  it('includes syncField', () => {
    expect(SCRIPT_REGISTRY).toHaveProperty('syncField');
  });

  it('each runner returns { logs, summary } when called', async () => {
    for (const [id, entry] of Object.entries(SCRIPT_REGISTRY)) {
      const result = await entry.runner(null, {}, 'test');
      expect(Array.isArray(result.logs), `${id}.logs must be an array`).toBe(true);
      expect(typeof result.summary, `${id}.summary must be a string`).toBe('string');
    }
  });
});
