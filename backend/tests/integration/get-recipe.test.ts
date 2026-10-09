import { beforeAll, describe, expect, it } from 'vitest';
import { handler as createHandler } from '../../src/handlers/create-recipe.js';
import { handler as getHandler } from '../../src/handlers/get-recipe.js';
import { ensureTable, parseBody } from './helpers.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('GET /recipes/{id} (US1)', () => {
  beforeAll(ensureTable);

  it('returns 404 for a non-existent recipe', async () => {
    const result = await getHandler({ pathParameters: { id: 'does-not-exist' } } as unknown as APIGatewayProxyEventV2);
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when the id is missing', async () => {
    const result = await getHandler({} as unknown as APIGatewayProxyEventV2);
    expect(result.statusCode).toBe(400);
  });

  it('never leaks DynamoDB\'s internal PK/SK attributes into the response', async () => {
    const created = await createHandler({ body: JSON.stringify({ locale: 'en', name: 'No Internal Keys' }) } as unknown as APIGatewayProxyEventV2);
    const { recipeId } = parseBody<{ recipeId: string }>(created);

    const result = await getHandler({ pathParameters: { id: recipeId } } as unknown as APIGatewayProxyEventV2);
    const recipe = parseBody<Record<string, unknown>>(result);

    expect(recipe).not.toHaveProperty('PK');
    expect(recipe).not.toHaveProperty('SK');
    const en = (recipe.locales as Record<string, Record<string, unknown>>).en!;
    expect(en).not.toHaveProperty('PK');
    expect(en).not.toHaveProperty('SK');
  });
});
