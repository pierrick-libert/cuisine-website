import { describe, expect, it } from 'vitest';
import { validateIngredientLine } from '../../src/domain/ingredient.js';
import { ValidationError } from '../../src/domain/errors.js';

describe('validateIngredientLine (FR-004, FR-005)', () => {
  it('accepts a line with quantity, unit, and name', () => {
    expect(() =>
      validateIngredientLine({ quantity: 250, unit: 'g', name: 'flour' }),
    ).not.toThrow();
  });

  it('accepts a counted ingredient with no unit', () => {
    expect(() => validateIngredientLine({ quantity: 6, unit: null, name: 'apples' })).not.toThrow();
  });

  it('accepts an optional approximate volume equivalent', () => {
    expect(() =>
      validateIngredientLine({
        quantity: 250,
        unit: 'g',
        name: 'flour',
        approxEquivalent: { quantity: 16, unit: 'tbsp' },
      }),
    ).not.toThrow();
  });

  it('rejects a missing/non-numeric quantity', () => {
    expect(() =>
      validateIngredientLine({ quantity: Number.NaN, unit: 'g', name: 'flour' }),
    ).toThrow(ValidationError);
  });

  it('rejects an empty name', () => {
    expect(() => validateIngredientLine({ quantity: 1, unit: null, name: '' })).toThrow(
      ValidationError,
    );
  });
});
