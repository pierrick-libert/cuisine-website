import { beforeAll, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock;
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { removeRecipe, handler } = await import('../../src/pipeline/remove-recipe.js');
const { createRecipe, updateRecipe, getRecipe } = await import('../../src/repository/recipe-repository.js');
const {
  getPublishedSnapshotsForRecipe,
  putPublishedSnapshot,
  setPublishStatus,
  setSelectedForNextPublish,
} = await import('../../src/repository/publish-repository.js');
const { ensureTable } = await import('./helpers.js');

describe('removeRecipe (004, User Story 2)', () => {
  beforeAll(ensureTable);

  it('deletes every published locale, clears its snapshots, and sets publishStatus to not_published', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Live Recipe' });
    await setPublishStatus(recipe.recipeId, 'live');
    await putPublishedSnapshot({
      recipeId: recipe.recipeId,
      locale: 'en',
      title: 'Live Recipe',
      slug: 'live-recipe',
      categoryId: null,
      renderedAt: '2026-10-19T00:00:00Z',
    });
    await setSelectedForNextPublish(recipe.recipeId, true);
    sendMock.mockClear();

    await removeRecipe(recipe.recipeId);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { input } = sendMock.mock.calls[0]![0] as { input: { Bucket: string; Key: string } };
    expect(input.Key).toBe('en/recipes/live-recipe.html');

    const remainingSnapshots = await getPublishedSnapshotsForRecipe(recipe.recipeId);
    expect(remainingSnapshots).toHaveLength(0);

    const updated = await getRecipe(recipe.recipeId);
    expect(updated?.publishStatus).toBe('not_published');
    expect(updated?.selectedForNextPublish).toBe(false);
  });

  it('deletes using the snapshot slug/locale, even if the recipe has since been edited (US3 stability)', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Old Title' });
    await setPublishStatus(recipe.recipeId, 'live');
    await putPublishedSnapshot({
      recipeId: recipe.recipeId,
      locale: 'en',
      title: 'Old Title',
      slug: 'old-title',
      categoryId: null,
      renderedAt: '2026-10-19T00:00:00Z',
    });
    // Edit the draft without republishing — the snapshot above is deliberately stale.
    await updateRecipe(recipe.recipeId, { locale: 'en', name: 'New Unpublished Title' });
    await setSelectedForNextPublish(recipe.recipeId, true);
    sendMock.mockClear();

    await removeRecipe(recipe.recipeId);

    const { input } = sendMock.mock.calls[0]![0] as { input: { Key: string } };
    expect(input.Key).toBe('en/recipes/old-title.html');
  });

  it('reverts publishStatus to its prior value and still resets the toggle on failure', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Will Fail To Unpublish' });
    await setPublishStatus(recipe.recipeId, 'live');
    await putPublishedSnapshot({
      recipeId: recipe.recipeId,
      locale: 'en',
      title: 'Will Fail To Unpublish',
      slug: 'will-fail-to-unpublish',
      categoryId: null,
      renderedAt: '2026-10-19T00:00:00Z',
    });
    await setSelectedForNextPublish(recipe.recipeId, true);
    sendMock.mockClear();
    sendMock.mockRejectedValueOnce(new Error('S3 is down'));

    await expect(removeRecipe(recipe.recipeId)).rejects.toThrow('S3 is down');

    const after = await getRecipe(recipe.recipeId);
    expect(after?.publishStatus).toBe('live');
    expect(after?.selectedForNextPublish).toBe(false);
  });

  describe('handler (Step Functions Map-state event shape)', () => {
    it('accepts { recipeId } as its event, not a bare string (Critical: ASL event shape)', async () => {
      const recipe = await createRecipe({ locale: 'en', name: 'Handler Shape Unpublish' });
      await setPublishStatus(recipe.recipeId, 'live');
      await putPublishedSnapshot({
        recipeId: recipe.recipeId,
        locale: 'en',
        title: 'Handler Shape Unpublish',
        slug: 'handler-shape-unpublish',
        categoryId: null,
        renderedAt: '2026-10-19T00:00:00Z',
      });
      await setSelectedForNextPublish(recipe.recipeId, true);
      sendMock.mockClear();

      await handler({ recipeId: recipe.recipeId });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const updated = await getRecipe(recipe.recipeId);
      expect(updated?.publishStatus).toBe('not_published');
    });
  });
});
