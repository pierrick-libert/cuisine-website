import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { rebuildIndex } = await import('../../src/pipeline/rebuild-index.js');
const { putPublishedSnapshot, deletePublishedSnapshot } = await import('../../src/repository/publish-repository.js');
const { findOrCreateCategory } = await import('../../src/repository/category-repository.js');
const { createRecipe, updateRecipe } = await import('../../src/repository/recipe-repository.js');
const { ensureTable } = await import('./helpers.js');

function s3Calls() {
  return sendMock.mock.calls.map((call) => (call[0] as { input: Record<string, unknown> }).input);
}

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

  it('creates a category shell for a category with a live recipe in this locale', async () => {
    const category = await findOrCreateCategory('Shell Category Live');
    await putPublishedSnapshot({
      recipeId: 'r-shell-live',
      locale: 'en',
      title: 'Shell Recipe',
      slug: 'shell-recipe',
      categoryId: category.categoryId,
      renderedAt: '2026-10-19T00:00:00Z',
    });

    await rebuildIndex();

    const calls = s3Calls();
    const shellCall = calls.find((c) => c.Key === 'en/categories/shell-category-live.html');
    expect(shellCall).toBeDefined();
    expect(shellCall!.Body).toContain('Shell Category Live');
  });

  it('removes a category shell once that category has no live recipe left in a locale that is otherwise still live', async () => {
    const liveCategory = await findOrCreateCategory('Keeps This Locale Live');
    const emptyCategory = await findOrCreateCategory('Now Empty Category');
    await putPublishedSnapshot({
      recipeId: 'r-keeps-locale-live',
      locale: 'en',
      title: 'Keeps Locale Live Recipe',
      slug: 'keeps-locale-live-recipe',
      categoryId: liveCategory.categoryId,
      renderedAt: '2026-10-19T00:00:00Z',
    });
    // Simulate the empty category having just lost its only recipe (unpublished).
    await putPublishedSnapshot({
      recipeId: 'r-now-gone',
      locale: 'en',
      title: 'Now Gone',
      slug: 'now-gone',
      categoryId: emptyCategory.categoryId,
      renderedAt: '2026-10-19T00:00:00Z',
    });
    await deletePublishedSnapshot('r-now-gone', 'en');

    await rebuildIndex();

    const calls = s3Calls();
    const deleteCall = calls.find((c) => c.Key === 'en/categories/now-empty-category.html');
    expect(deleteCall).toBeDefined();
  });
});
