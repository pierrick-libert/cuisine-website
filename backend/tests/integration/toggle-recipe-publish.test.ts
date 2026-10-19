import { beforeAll, describe, expect, it } from 'vitest';
import { handler } from '../../src/handlers/toggle-recipe-publish.js';
import { createRecipe } from '../../src/repository/recipe-repository.js';
import { ensureTable, parseBody } from './helpers.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

function event(recipeId: string, selected: boolean): APIGatewayProxyEventV2 {
  return {
    pathParameters: { id: recipeId },
    body: JSON.stringify({ selected }),
  } as unknown as APIGatewayProxyEventV2;
}

describe('PATCH /recipes/{id}/publish-toggle (004, FR-001)', () => {
  beforeAll(ensureTable);

  it('toggles a recipe on and returns its publish state', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Toggle Target' });

    const result = await handler(event(recipe.recipeId, true));

    expect(result.statusCode).toBe(200);
    const body = parseBody<{ recipeId: string; selectedForNextPublish: boolean; publishStatus: string }>(result);
    expect(body).toEqual({
      recipeId: recipe.recipeId,
      selectedForNextPublish: true,
      publishStatus: 'not_published',
    });
  });

  it('returns 404 for an unknown recipe id', async () => {
    const result = await handler(event('does-not-exist', true));
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when the recipe id is missing', async () => {
    const result = await handler({ pathParameters: {}, body: '{"selected":true}' } as unknown as APIGatewayProxyEventV2);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when selected is not a boolean (Minor: was unvalidated)', async () => {
    const recipe = await createRecipe({ locale: 'en', name: 'Toggle Validation Target' });

    const result = await handler({
      pathParameters: { id: recipe.recipeId },
      body: JSON.stringify({ selected: 'yes' }),
    } as unknown as APIGatewayProxyEventV2);

    expect(result.statusCode).toBe(400);
  });
});
