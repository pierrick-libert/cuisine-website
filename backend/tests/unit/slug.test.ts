import { describe, expect, it } from 'vitest';
import { slugify } from '../../src/lib/slug.js';

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
