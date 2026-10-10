import { beforeAll, describe, expect, it } from 'vitest';
import { handler } from '../../src/handlers/create-recipe.js';
import { ensureTable, parseBody } from './helpers.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { RecipeInput } from '../../src/domain/types.js';

function event(body: RecipeInput): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as unknown as APIGatewayProxyEventV2;
}

describe('POST /recipes (US1)', () => {
  beforeAll(ensureTable);

  it('rejects a missing name (FR-002)', async () => {
    const result = await handler(event({ locale: 'en', name: '' }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects a malformed JSON body with 400, not an uncaught error', async () => {
    const result = await handler({ body: '{not json' } as unknown as Parameters<typeof handler>[0]);
    expect(result.statusCode).toBe(400);
  });

  it('creates a recipe with only a name, accepting empty groups/steps (FR-010)', async () => {
    const result = await handler(event({ locale: 'en', name: 'Minimal Draft' }));
    expect(result.statusCode).toBe(201);
    const recipe = parseBody<{ recipeId: string; locales: Record<string, { name: string }> }>(result);
    expect(recipe.recipeId).toBeTruthy();
    expect(recipe.locales.en?.name).toBe('Minimal Draft');
  });

  it('creates a full recipe with ingredient groups and steps', async () => {
    const result = await handler(
      event({
        locale: 'en',
        name: "Grandma's Apple Tart",
        description: 'A classic.',
        ingredientGroups: [
          {
            name: 'For the dough',
            lines: [{ quantity: 250, unit: 'g', name: 'flour', approxEquivalent: { quantity: 16, unit: 'tbsp' } }],
          },
        ],
        steps: [{ richText: { type: 'doc', content: [] } }],
      }),
    );
    expect(result.statusCode).toBe(201);
    const recipe = parseBody<{
      ingredientGroups: Array<{ groupId: string; lines: Array<{ quantity: number }> }>;
      stepsOrder: string[];
    }>(result);
    expect(recipe.ingredientGroups).toHaveLength(1);
    expect(recipe.ingredientGroups[0]?.lines[0]?.quantity).toBe(250);
    expect(recipe.stepsOrder).toHaveLength(1);
  });
});
