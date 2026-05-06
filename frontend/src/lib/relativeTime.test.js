import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

describe('relativeTime', () => {
  const now = Date.parse('2026-05-04T12:00:00Z');

  it('handles seconds', () => {
    expect(relativeTime(now - 5_000, now)).toBe('5s ago');
  });
  it('handles minutes', () => {
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago');
  });
  it('handles hours', () => {
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
  });
  it('handles days', () => {
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
  it('returns dash for invalid input', () => {
    expect(relativeTime('garbage')).toBe('—');
  });
  it('handles ISO strings', () => {
    expect(relativeTime('2026-05-04T11:00:00Z', now)).toBe('1h ago');
  });
});
