import { describe, expect, it } from 'vitest';
import { recipeSlug, slugify } from '../../src/lib/slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify("Grandma's Apple Tart")).toBe('grandmas-apple-tart');
  });

  it('strips accents', () => {
    expect(slugify('Entrée')).toBe('entree');
  });

  it('collapses repeated separators and trims leading/trailing hyphens', () => {
    expect(slugify('  Soup -- & Stew!! ')).toBe('soup-stew');
  });
});

describe('recipeSlug', () => {
  it('appends a short, lowercased suffix derived from the recipe id, so two recipes with the same name never collide', () => {
    const slugA = recipeSlug('Pancakes', '01M592GXK6EWMXG814YXQ7BVQ4');
    const slugB = recipeSlug('Pancakes', '01M592EAPTVHGXJ43EYA8TRD55');

    expect(slugA).not.toBe(slugB);
    expect(slugA).toMatch(/^pancakes-[0-9a-z]+$/);
  });

  it('is deterministic for the same name and id', () => {
    expect(recipeSlug('Pancakes', '01M592GXK6EWMXG814YXQ7BVQ4')).toBe(
      recipeSlug('Pancakes', '01M592GXK6EWMXG814YXQ7BVQ4'),
    );
  });

  it('never starts with a hyphen, even for a name that slugifies to empty', () => {
    expect(recipeSlug('!!!', '01M592GXK6EWMXG814YXQ7BVQ4')).not.toMatch(/^-/);
  });
});
