import { beforeAll, describe, expect, it, vi } from 'vitest';

const s3SendMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = s3SendMock;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { renderRecipe } = await import('../../src/pipeline/render-recipe.js');
const { rebuildIndex } = await import('../../src/pipeline/rebuild-index.js');
const { createRecipe, updateRecipe } = await import('../../src/repository/recipe-repository.js');
const { setSelectedForNextPublish } = await import('../../src/repository/publish-repository.js');
const { ensureTable } = await import('./helpers.js');

describe('Stable snapshot end-to-end (004, User Story 3)', () => {
  beforeAll(ensureTable);

  it('leaves the public page and index unchanged after editing a published recipe without republishing it', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Published Soup' });
    await setSelectedForNextPublish(recipe.recipeId, true);
    s3SendMock.mockClear();

    await renderRecipe(recipe.recipeId);
    const [publishCall] = s3SendMock.mock.calls;
    const publishedHtml = (publishCall![0] as { input: { Body: string } }).input.Body;
    expect(publishedHtml).toContain('Published Soup');

    // Edit the draft WITHOUT toggling/republishing — US3's "deliberate snapshot" guarantee.
    await updateRecipe(recipe.recipeId, { locale: 'en', name: 'Totally Different Soup' });

    s3SendMock.mockClear();
    await rebuildIndex();

    const indexCall = s3SendMock.mock.calls.find(
      (call) => (call[0] as { input: { Key: string } }).input.Key === 'en/browse-index.json',
    );
    const indexBody = JSON.parse((indexCall![0] as { input: { Body: string } }).input.Body) as {
      recipes: Array<{ recipeId: string; title: string }>;
    };
    const entry = indexBody.recipes.find((r) => r.recipeId === recipe.recipeId);

    // The index must still reflect what was actually published — never the unpublished edit.
    expect(entry?.title).toBe('Published Soup');
    expect(entry?.title).not.toBe('Totally Different Soup');
  });
});
