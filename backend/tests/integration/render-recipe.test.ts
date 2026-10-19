import { beforeAll, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { renderRecipe } = await import('../../src/pipeline/render-recipe.js');
const { createRecipe, updateRecipe, getRecipe } = await import('../../src/repository/recipe-repository.js');
const { setSelectedForNextPublish, listPublishedSnapshots } = await import('../../src/repository/publish-repository.js');
const { ensureTable } = await import('./helpers.js');

describe('renderRecipe (004, User Story 1)', () => {
  beforeAll(ensureTable);

  it('renders and uploads a page per locale, writes a snapshot, and sets publishStatus to live', async () => {
    const recipe = await createRecipe({
      locale: 'en',
      name: 'Rendered Recipe One',
      description: 'A test recipe.',
      ingredientGroups: [{ name: 'Main', lines: [{ quantity: 250, unit: 'g', name: 'flour' }] }],
      steps: [{ richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mix it.' }] }] } }],
    });
    await setSelectedForNextPublish(recipe.recipeId, true);
    sendMock.mockClear();

    await renderRecipe(recipe.recipeId);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { input } = sendMock.mock.calls[0]![0] as { input: { Bucket: string; Key: string; Body: string } };
    expect(input.Key).toBe('en/recipes/rendered-recipe-one.html');
    expect(input.Body).toContain('Mix it.');
    expect(input.Body).toContain('250 g flour');

    const snapshots = await listPublishedSnapshots();
    const snapshot = snapshots.find((s) => s.recipeId === recipe.recipeId);
    expect(snapshot).toEqual({
      recipeId: recipe.recipeId,
      locale: 'en',
      title: 'Rendered Recipe One',
      slug: 'rendered-recipe-one',
      categoryId: null,
      renderedAt: expect.any(String),
    });

    const updated = await getRecipe(recipe.recipeId);
    expect(updated?.publishStatus).toBe('live');
    expect(updated?.selectedForNextPublish).toBe(false);
  });

  it('renders one page per locale the recipe has content for (FR-015)', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Two Locale Recipe' });
    await updateRecipe(recipe.recipeId, { locale: 'fr', name: 'Recette Deux Langues' });
    await setSelectedForNextPublish(recipe.recipeId, true);
    sendMock.mockClear();

    await renderRecipe(recipe.recipeId);

    expect(sendMock).toHaveBeenCalledTimes(2);
    const keys = sendMock.mock.calls.map((call) => (call[0] as { input: { Key: string } }).input.Key);
    expect(keys).toContain('en/recipes/two-locale-recipe.html');
    expect(keys).toContain('fr/recipes/recette-deux-langues.html');
  });

  it('reverts publishStatus to its prior value and still resets the toggle on failure', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Will Fail To Render' });
    await setSelectedForNextPublish(recipe.recipeId, true);
    sendMock.mockClear();
    sendMock.mockRejectedValueOnce(new Error('S3 is down'));

    await expect(renderRecipe(recipe.recipeId)).rejects.toThrow('S3 is down');

    const after = await getRecipe(recipe.recipeId);
    expect(after?.publishStatus).toBe('not_published');
    expect(after?.selectedForNextPublish).toBe(false);
  });
});
