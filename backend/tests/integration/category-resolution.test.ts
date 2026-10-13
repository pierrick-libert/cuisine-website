import { beforeAll, describe, expect, it } from 'vitest';
import { handler as createHandler } from '../../src/handlers/create-recipe.js';
import { handler as getHandler } from '../../src/handlers/get-recipe.js';
import { handler as updateHandler } from '../../src/handlers/update-recipe.js';
import { ensureTable, parseBody } from './helpers.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { RecipeInput } from '../../src/domain/types.js';

function createEvent(body: RecipeInput): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as unknown as APIGatewayProxyEventV2;
}
function updateEvent(id: string, body: RecipeInput): APIGatewayProxyEventV2 {
  return { pathParameters: { id }, body: JSON.stringify(body) } as unknown as APIGatewayProxyEventV2;
}

type RecipeWithCategory = { recipeId: string; categoryId: string | null; categoryName: string | null };

describe('category name resolution (regression)', () => {
  beforeAll(ensureTable);

  it('resolves categoryName on create, not just categoryId', async () => {
    const result = await createHandler(createEvent({ locale: 'en', name: 'Apple Tart', categoryName: 'Dessert' }));
    const recipe = parseBody<RecipeWithCategory>(result);
    expect(recipe.categoryId).toBeTruthy();
    expect(recipe.categoryName).toBe('Dessert');
  });

  it('resolves categoryName on GET, from a previously-created recipe', async () => {
    const created = parseBody<RecipeWithCategory>(
      await createHandler(createEvent({ locale: 'en', name: 'Apple Tart', categoryName: 'Dessert' })),
    );
    const result = await getHandler({ pathParameters: { id: created.recipeId } } as unknown as APIGatewayProxyEventV2);
    const recipe = parseBody<RecipeWithCategory>(result);
    expect(recipe.categoryName).toBe('Dessert');
  });

  it('leaves the category unchanged when categoryName is omitted on update', async () => {
    const created = parseBody<RecipeWithCategory>(
      await createHandler(createEvent({ locale: 'en', name: 'Apple Tart', categoryName: 'Dessert' })),
    );
    const result = await updateHandler(updateEvent(created.recipeId, { locale: 'en', name: 'Apple Tart' }));
    const updated = parseBody<RecipeWithCategory>(result);
    expect(updated.categoryName).toBe('Dessert');
  });

  it('changes the category (and its name) when a new categoryName is given on update', async () => {
    const created = parseBody<RecipeWithCategory>(
      await createHandler(createEvent({ locale: 'en', name: 'Apple Tart', categoryName: 'Dessert' })),
    );
    const result = await updateHandler(
      updateEvent(created.recipeId, { locale: 'en', name: 'Apple Tart', categoryName: 'Breakfast' }),
    );
    const updated = parseBody<RecipeWithCategory>(result);
    expect(updated.categoryName).toBe('Breakfast');
    expect(updated.categoryId).not.toBe(created.categoryId);
  });

  it('clears the category when categoryName is explicitly null on update', async () => {
    const created = parseBody<RecipeWithCategory>(
      await createHandler(createEvent({ locale: 'en', name: 'Apple Tart', categoryName: 'Dessert' })),
    );
    const result = await updateHandler(
      updateEvent(created.recipeId, { locale: 'en', name: 'Apple Tart', categoryName: null }),
    );
    const updated = parseBody<RecipeWithCategory>(result);
    expect(updated.categoryId).toBeNull();
    expect(updated.categoryName).toBeNull();
  });
});
