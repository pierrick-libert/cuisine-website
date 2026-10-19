import { beforeAll, describe, expect, it } from 'vitest';
import { handler as createHandler } from '../../src/handlers/create-recipe.js';
import { handler as listHandler } from '../../src/handlers/list-recipes.js';
import { handler as toggleHandler } from '../../src/handlers/toggle-recipe-publish.js';
import { ensureTable, parseBody } from './helpers.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('GET /recipes (004, FR-008 per-recipe publish fields)', () => {
  beforeAll(ensureTable);

  it('includes selectedForNextPublish and publishStatus for each recipe', async () => {
    const created = await createHandler({
      body: JSON.stringify({ locale: 'en', name: 'Listed With Publish Fields' }),
    } as unknown as APIGatewayProxyEventV2);
    const { recipeId } = parseBody<{ recipeId: string }>(created);
    await toggleHandler({
      pathParameters: { id: recipeId },
      body: JSON.stringify({ selected: true }),
    } as unknown as APIGatewayProxyEventV2);

    const result = await listHandler();

    const { recipes } = parseBody<{
      recipes: Array<{ recipeId: string; selectedForNextPublish: boolean; publishStatus: string }>;
    }>(result);
    const listed = recipes.find((r) => r.recipeId === recipeId);
    expect(listed?.selectedForNextPublish).toBe(true);
    expect(listed?.publishStatus).toBe('not_published');
  });
});
