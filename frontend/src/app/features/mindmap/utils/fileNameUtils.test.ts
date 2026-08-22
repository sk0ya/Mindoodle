import { describe, expect, it } from 'vitest';
import {
  generateUniqueFileName,
  sanitizeAndEnsureUnique,
  sanitizeFileName,
} from './fileNameUtils';

describe('file name utilities', () => {
  it('removes platform-invalid characters and normalizes whitespace', () => {
    expect(sanitizeFileName('  project<>:"/\\|?*   name  ')).toBe('project name');
    expect(sanitizeFileName('   ')).toBe('新しいマップ');
    expect(sanitizeFileName('')).toBe('新しいマップ');
  });

  it('truncates long names without exceeding the limit', () => {
    expect(sanitizeFileName('a'.repeat(120))).toHaveLength(100);
  });

  it('generates the first available suffix', () => {
    const existing = new Set(['map', 'map_1', 'map_2']);
    expect(generateUniqueFileName('map', existing)).toBe('map_3');
    expect(generateUniqueFileName('new-map', existing)).toBe('new-map');
    expect(sanitizeAndEnsureUnique(' bad:/map ', existing)).toBe('badmap');
  });
});
