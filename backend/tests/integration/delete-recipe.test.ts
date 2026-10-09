import { beforeAll, describe, expect, it } from 'vitest';
import { handler as createHandler } from '../../src/handlers/create-recipe.js';
import { handler as deleteHandler } from '../../src/handlers/delete-recipe.js';
import { handler as getHandler } from '../../src/handlers/get-recipe.js';
import { ensureTable, parseBody } from './helpers.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('DELETE /recipes/{id} (US2, FR-013)', () => {
  beforeAll(ensureTable);

  it('deletes an existing recipe', async () => {
    const created = await createHandler({ body: JSON.stringify({ locale: 'en', name: 'To Delete' }) } as unknown as APIGatewayProxyEventV2);
    const { recipeId } = parseBody<{ recipeId: string }>(created);

    const deleteResult = await deleteHandler({ pathParameters: { id: recipeId } } as unknown as APIGatewayProxyEventV2);
    expect(deleteResult.statusCode).toBe(204);

    const getResult = await getHandler({ pathParameters: { id: recipeId } } as unknown as APIGatewayProxyEventV2);
    expect(getResult.statusCode).toBe(404);
  });

  it('returns 404 for a non-existent recipe', async () => {
    const result = await deleteHandler({ pathParameters: { id: 'does-not-exist' } } as unknown as APIGatewayProxyEventV2);
    expect(result.statusCode).toBe(404);
  });
});
