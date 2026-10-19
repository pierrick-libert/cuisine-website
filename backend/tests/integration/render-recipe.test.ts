import { beforeAll, describe, expect, it, vi } from 'vitest';

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

const { renderRecipe, handler } = await import('../../src/pipeline/render-recipe.js');
const { createRecipe, updateRecipe, getRecipe } = await import('../../src/repository/recipe-repository.js');
const { setSelectedForNextPublish, listPublishedSnapshots } = await import('../../src/repository/publish-repository.js');
const { recipeSlug } = await import('../../src/lib/slug.js');
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

    const expectedSlug = recipeSlug('Rendered Recipe One', recipe.recipeId);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const { input } = sendMock.mock.calls[0]![0] as { input: { Bucket: string; Key: string; Body: string } };
    expect(input.Key).toBe(`en/recipes/${expectedSlug}.html`);
    expect(input.Body).toContain('Mix it.');
    expect(input.Body).toContain('250 g flour');

    const snapshots = await listPublishedSnapshots();
    const snapshot = snapshots.find((s) => s.recipeId === recipe.recipeId);
    expect(snapshot).toEqual({
      recipeId: recipe.recipeId,
      locale: 'en',
      title: 'Rendered Recipe One',
      slug: expectedSlug,
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
    expect(keys).toContain(`en/recipes/${recipeSlug('Two Locale Recipe', recipe.recipeId)}.html`);
    expect(keys).toContain(`fr/recipes/${recipeSlug('Recette Deux Langues', recipe.recipeId)}.html`);
  });

  it('two recipes with the same name never collide on the same public URL', async () => {
    const recipeA = await createRecipe({ locale: 'en', name: 'Pancakes' });
    const recipeB = await createRecipe({ locale: 'en', name: 'Pancakes' });
    await setSelectedForNextPublish(recipeA.recipeId, true);
    await setSelectedForNextPublish(recipeB.recipeId, true);
    sendMock.mockClear();

    await renderRecipe(recipeA.recipeId);
    await renderRecipe(recipeB.recipeId);

    const keys = sendMock.mock.calls.map((call) => (call[0] as { input: { Key: string } }).input.Key);
    expect(new Set(keys).size).toBe(keys.length); // no two uploads share a key
  });

  it('deletes the old page when a published recipe is renamed and republished (US2 stability)', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Original Name' });
    await setSelectedForNextPublish(recipe.recipeId, true);
    await renderRecipe(recipe.recipeId);
    const oldSlug = recipeSlug('Original Name', recipe.recipeId);

    await updateRecipe(recipe.recipeId, { locale: 'en', name: 'Renamed' });
    await setSelectedForNextPublish(recipe.recipeId, true);
    sendMock.mockClear();

    await renderRecipe(recipe.recipeId);

    const deleteCall = sendMock.mock.calls.find(
      (call) => (call[0] as { input: { Key: string } }).input.Key === `en/recipes/${oldSlug}.html`,
    );
    expect(deleteCall).toBeDefined();
    const newSlug = recipeSlug('Renamed', recipe.recipeId);
    const putCall = sendMock.mock.calls.find(
      (call) => (call[0] as { input: { Key: string } }).input.Key === `en/recipes/${newSlug}.html`,
    );
    expect(putCall).toBeDefined();
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

  describe('handler (Step Functions Map-state event shape)', () => {
    it('accepts { recipeId } as its event, not a bare string (Critical: ASL event shape)', async () => {
      const recipe = await createRecipe({ locale: 'en', name: 'Handler Shape Recipe' });
      await setSelectedForNextPublish(recipe.recipeId, true);
      sendMock.mockClear();

      await handler({ recipeId: recipe.recipeId });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const updated = await getRecipe(recipe.recipeId);
      expect(updated?.publishStatus).toBe('live');
    });
  });
});
