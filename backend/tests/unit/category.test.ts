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
