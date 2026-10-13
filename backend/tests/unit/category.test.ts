import { describe, expect, it } from 'vitest';
import { normalizeCategoryName } from '../../src/domain/category.js';

describe('normalizeCategoryName (FR-008)', () => {
  it('treats different casing as the same category', () => {
    expect(normalizeCategoryName('Dessert')).toBe(normalizeCategoryName('dessert'));
    expect(normalizeCategoryName('DESSERT')).toBe(normalizeCategoryName('dessert'));
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCategoryName('  Dessert  ')).toBe('dessert');
  });
});

describe('deliberate CI-failure check (not a real test, reverted)', () => {
  it('should fail on purpose', () => {
    expect(1).toBe(2);
  });
});
