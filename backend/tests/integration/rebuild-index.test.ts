import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { rebuildIndex } = await import('../../src/pipeline/rebuild-index.js');
const { putPublishedSnapshot } = await import('../../src/repository/publish-repository.js');
const { findOrCreateCategory } = await import('../../src/repository/category-repository.js');
const { createRecipe, updateRecipe } = await import('../../src/repository/recipe-repository.js');
const { ensureTable } = await import('./helpers.js');

describe('rebuildIndex (004, FR-013/SC-008)', () => {
  beforeAll(ensureTable);
  beforeEach(() => sendMock.mockClear());

  it('writes a browse-index.json per locale, built only from published snapshots', async () => {
    const category = await findOrCreateCategory('Desserts');
    await putPublishedSnapshot({
      recipeId: 'r-index-1',
      locale: 'en',
      title: "Grandma's Apple Tart",
      slug: 'grandmas-apple-tart',
      categoryId: category.categoryId,
      renderedAt: '2026-10-19T00:00:00Z',
    });

    await rebuildIndex();

    const calls = sendMock.mock.calls.map((call) => (call[0] as { input: Record<string, unknown> }).input);
    const enIndexCall = calls.find((c) => c.Key === 'en/browse-index.json');
    expect(enIndexCall).toBeDefined();
    const body = JSON.parse(enIndexCall!.Body as string) as { recipes: Array<Record<string, unknown>> };
    expect(body.recipes).toContainEqual({
      recipeId: 'r-index-1',
      slug: 'grandmas-apple-tart',
      title: "Grandma's Apple Tart",
      categoryId: category.categoryId,
      categorySlug: 'desserts',
    });
  });

  it('never reflects a live draft edit to a recipe not re-rendered this run (FR-013)', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Old Published Title' });
    await putPublishedSnapshot({
      recipeId: recipe.recipeId,
      locale: 'en',
      title: 'Old Published Title',
      slug: 'old-published-title',
      categoryId: null,
      renderedAt: '2026-10-19T00:00:00Z',
    });
    // Edit the draft WITHOUT republishing — the snapshot above is deliberately left stale.
    await updateRecipe(recipe.recipeId, { locale: 'en', name: 'Brand New Unpublished Name' });

    await rebuildIndex();

    const calls = sendMock.mock.calls.map((call) => (call[0] as { input: Record<string, unknown> }).input);
    const enIndexCall = calls.find((c) => c.Key === 'en/browse-index.json');
    const body = JSON.parse(enIndexCall!.Body as string) as { recipes: Array<Record<string, unknown>> };
    const entry = body.recipes.find((r) => r.recipeId === recipe.recipeId);
    // Must reflect the snapshot (what's actually rendered), never the live draft's new name.
    expect(entry?.title).toBe('Old Published Title');
  });
});
