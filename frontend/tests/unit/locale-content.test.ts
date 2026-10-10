import { describe, expect, it } from 'vitest';
import { toRecipeDetail, type RawRecipe } from '../../src/services/recipesApi.js';

function fixture(): RawRecipe {
  return {
    recipeId: 'r1',
    status: 'draft',
    categoryId: null,
    tags: [],
    ingredientGroups: [
      {
        groupId: 'g1',
        lines: [{ lineId: 'l1', quantity: 250, unit: 'g', approxEquivalent: null }],
      },
    ],
    stepsOrder: ['s1'],
    locales: {
      en: {
        name: 'Apple Tart',
        description: 'English description',
        groupNames: { g1: 'For the dough' },
        ingredientNames: { l1: 'flour' },
        steps: { s1: { type: 'doc', content: [{ type: 'text', text: 'English step' }] } },
      },
      fr: {
        name: 'Tarte aux pommes',
        description: 'Description française',
        groupNames: { g1: 'Pour la pâte' },
        ingredientNames: { l1: 'farine' },
        steps: { s1: { type: 'doc', content: [{ type: 'text', text: 'Étape française' }] } },
      },
    },
  };
}

describe('toRecipeDetail locale projection (US3, FR-009)', () => {
  it('shows only the requested locale\'s text', () => {
    const en = toRecipeDetail(fixture(), 'en');
    expect(en.name).toBe('Apple Tart');
    expect(en.ingredientGroups[0]?.name).toBe('For the dough');
    expect(en.ingredientGroups[0]?.lines[0]?.name).toBe('flour');

    const fr = toRecipeDetail(fixture(), 'fr');
    expect(fr.name).toBe('Tarte aux pommes');
    expect(fr.ingredientGroups[0]?.name).toBe('Pour la pâte');
    expect(fr.ingredientGroups[0]?.lines[0]?.name).toBe('farine');
  });

  it('never mixes text from one locale into another', () => {
    const en = toRecipeDetail(fixture(), 'en');
    const fr = toRecipeDetail(fixture(), 'fr');
    expect(en.name).not.toBe(fr.name);
    expect(en.ingredientGroups[0]?.lines[0]?.name).not.toBe(fr.ingredientGroups[0]?.lines[0]?.name);
  });

  it('keeps structural fields (quantity/unit) identical across locales', () => {
    const en = toRecipeDetail(fixture(), 'en');
    const fr = toRecipeDetail(fixture(), 'fr');
    expect(en.ingredientGroups[0]?.lines[0]?.quantity).toBe(fr.ingredientGroups[0]?.lines[0]?.quantity);
    expect(en.ingredientGroups[0]?.lines[0]?.unit).toBe(fr.ingredientGroups[0]?.lines[0]?.unit);
  });

  it('reports every available locale (for the locale tabs)', () => {
    const detail = toRecipeDetail(fixture(), 'en');
    expect(detail.availableLocales.sort()).toEqual(['en', 'fr']);
  });

  it('falls back to any available locale if the requested one has no content', () => {
    const detail = toRecipeDetail(fixture(), 'de');
    expect(['Apple Tart', 'Tarte aux pommes']).toContain(detail.name);
  });
});
