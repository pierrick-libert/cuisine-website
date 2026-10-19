import { beforeAll, describe, expect, it } from 'vitest';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../src/repository/table-client.js';
import { getRecipe, listRecipes } from '../../src/repository/recipe-repository.js';
import { setPublishStatus, setSelectedForNextPublish } from '../../src/repository/publish-repository.js';
import { ensureTable } from './helpers.js';

describe('publishStatus/selectedForNextPublish defaults for pre-004 recipes (Important 9)', () => {
  beforeAll(ensureTable);

  async function putLegacyRecipe(recipeId: string) {
    // A META item shaped exactly like what 001-003 would have written — no
    // selectedForNextPublish/publishStatus fields at all.
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
        },
      }),
    );
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { PK: `RECIPE#${recipeId}`, SK: 'LOCALE#en', name: 'Legacy Recipe', description: '', groupNames: {}, ingredientNames: {}, steps: {} },
      }),
    );
  }

  it('getRecipe defaults a legacy recipe to not toggled / not_published', async () => {
    await putLegacyRecipe('legacy-recipe-1');

    const recipe = await getRecipe('legacy-recipe-1');

    expect(recipe?.selectedForNextPublish).toBe(false);
    expect(recipe?.publishStatus).toBe('not_published');
  });

  it('listRecipes defaults a legacy recipe to not toggled / not_published', async () => {
    await putLegacyRecipe('legacy-recipe-2');

    const recipes = await listRecipes();

    const legacy = recipes.find((r) => r.recipeId === 'legacy-recipe-2');
    expect(legacy?.selectedForNextPublish).toBe(false);
    expect(legacy?.publishStatus).toBe('not_published');
  });

  it('setSelectedForNextPublish on a legacy recipe returns a defaulted publishStatus, not undefined', async () => {
    await putLegacyRecipe('legacy-recipe-3');

    const updated = await setSelectedForNextPublish('legacy-recipe-3', true);

    expect(updated?.selectedForNextPublish).toBe(true);
    expect(updated?.publishStatus).toBe('not_published');
  });

  it('setPublishStatus on a legacy recipe returns a defaulted selectedForNextPublish, not undefined', async () => {
    await putLegacyRecipe('legacy-recipe-4');

    const updated = await setPublishStatus('legacy-recipe-4', 'live');

    expect(updated?.publishStatus).toBe('live');
    expect(updated?.selectedForNextPublish).toBe(false);
  });
});
