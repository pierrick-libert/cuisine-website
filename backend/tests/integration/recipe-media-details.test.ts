import { beforeAll, describe, expect, it } from 'vitest';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../src/repository/table-client.js';
import { createRecipe, getRecipe, updateRecipe } from '../../src/repository/recipe-repository.js';
import { ensureTable } from './helpers.js';
import type { RecipeInput } from '../../src/domain/types.js';

const minimalInput: RecipeInput = { locale: 'en', name: 'Test Recipe' };

describe('Recipe media/serving fields (005-recipe-media-details FR-001, FR-002)', () => {
  beforeAll(ensureTable);

  it('persists prepMinutes/cookMinutes/baseServings/coverImageUrl on create and read them back', async () => {
    const created = await createRecipe({
      ...minimalInput,
      prepMinutes: 25,
      cookMinutes: 45,
      baseServings: 6,
      coverImageUrl: 'https://clp-cuisine-website-images.s3.eu-central-1.amazonaws.com/a.jpg',
    });

    expect(created.prepMinutes).toBe(25);
    expect(created.cookMinutes).toBe(45);
    expect(created.baseServings).toBe(6);
    expect(created.coverImageUrl).toBe('https://clp-cuisine-website-images.s3.eu-central-1.amazonaws.com/a.jpg');

    const fetched = await getRecipe(created.recipeId);
    expect(fetched?.prepMinutes).toBe(25);
    expect(fetched?.cookMinutes).toBe(45);
    expect(fetched?.baseServings).toBe(6);
    expect(fetched?.coverImageUrl).toBe('https://clp-cuisine-website-images.s3.eu-central-1.amazonaws.com/a.jpg');
  });

  it('defaults all four fields to null when never set', async () => {
    const created = await createRecipe(minimalInput);

    expect(created.prepMinutes).toBeNull();
    expect(created.cookMinutes).toBeNull();
    expect(created.baseServings).toBeNull();
    expect(created.coverImageUrl).toBeNull();
  });

  it('updateRecipe sets a previously-unset field', async () => {
    const created = await createRecipe(minimalInput);

    const updated = await updateRecipe(created.recipeId, { ...minimalInput, baseServings: 4 });

    expect(updated?.baseServings).toBe(4);
  });

  it('updateRecipe leaves a field unchanged when omitted from the request', async () => {
    const created = await createRecipe({ ...minimalInput, prepMinutes: 10 });

    const updated = await updateRecipe(created.recipeId, minimalInput);

    expect(updated?.prepMinutes).toBe(10);
  });

  it('updateRecipe clears a field when the request sends an explicit null', async () => {
    const created = await createRecipe({ ...minimalInput, cookMinutes: 30 });

    const updated = await updateRecipe(created.recipeId, { ...minimalInput, cookMinutes: null });

    expect(updated?.cookMinutes).toBeNull();
  });

  it('defaults all four fields to null for a recipe written before this feature existed', async () => {
    const recipeId = 'legacy-media-recipe-1';
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `RECIPE#${recipeId}`,
          SK: 'META',
          recipeId,
          status: 'draft',
          categoryId: null,
          tags: [],
          ingredientGroups: [],
          stepsOrder: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          selectedForNextPublish: false,
          publishStatus: 'not_published',
        },
      }),
    );
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { PK: `RECIPE#${recipeId}`, SK: 'LOCALE#en', name: 'Legacy Recipe', description: '', groupNames: {}, ingredientNames: {}, steps: {} },
      }),
    );

    const fetched = await getRecipe(recipeId);

    expect(fetched?.prepMinutes).toBeNull();
    expect(fetched?.cookMinutes).toBeNull();
    expect(fetched?.baseServings).toBeNull();
    expect(fetched?.coverImageUrl).toBeNull();
  });

  it('rejects a non-positive-integer prepMinutes/cookMinutes/baseServings with a validation error', async () => {
    await expect(createRecipe({ ...minimalInput, prepMinutes: -5 })).rejects.toThrow();
    await expect(createRecipe({ ...minimalInput, cookMinutes: 1.5 })).rejects.toThrow();
    await expect(createRecipe({ ...minimalInput, baseServings: 0 })).rejects.toThrow();
  });

  it('rejects an empty-string coverImageUrl with a validation error', async () => {
    await expect(createRecipe({ ...minimalInput, coverImageUrl: '' })).rejects.toThrow();
  });
});
