import { beforeAll, describe, expect, it } from 'vitest';
import { handler as createHandler } from '../../src/handlers/create-recipe.js';
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

type Recipe = {
  recipeId: string;
  ingredientGroups: Array<{ groupId: string; lines: Array<{ lineId: string; quantity: number }> }>;
  stepsOrder: string[];
};

async function createTestRecipe(): Promise<Recipe> {
  const result = await createHandler(
    createEvent({
      locale: 'en',
      name: 'Original Name',
      ingredientGroups: [
        {
          name: 'Group A',
          lines: [
            { quantity: 100, unit: 'g', name: 'flour' },
            { quantity: 2, unit: null, name: 'eggs' },
          ],
        },
      ],
      steps: [{ richText: { type: 'doc', content: [] } }],
    }),
  );
  return parseBody<Recipe>(result);
}

describe('PUT /recipes/{id} (US2)', () => {
  beforeAll(ensureTable);

  it('updates an ingredient quantity', async () => {
    const recipe = await createTestRecipe();
    const group = recipe.ingredientGroups[0]!;
    // The GET/create response's ingredientGroups deliberately omits `name` (names live only in
    // locale content, per data-model.md) — the PUT request body is denormalized, so names must
    // be supplied again here, same as the real editor UI would.
    const names = ['flour', 'eggs'];
    const result = await updateHandler(
      updateEvent(recipe.recipeId, {
        locale: 'en',
        name: 'Original Name',
        ingredientGroups: [
          {
            groupId: group.groupId,
            name: 'Group A',
            lines: group.lines.map((l, i) => ({
              ...l,
              name: names[i]!,
              quantity: i === 0 ? 150 : l.quantity,
            })),
          },
        ],
      }),
    );
    expect(result.statusCode).toBe(200);
    const updated = parseBody<Recipe>(result);
    expect(updated.ingredientGroups[0]?.lines[0]?.quantity).toBe(150);
  });

  it('reorders ingredient lines', async () => {
    const recipe = await createTestRecipe();
    const group = recipe.ingredientGroups[0]!;
    const names = ['flour', 'eggs'];
    const linesWithNames = group.lines.map((l, i) => ({ ...l, name: names[i]! }));
    const [first, second] = linesWithNames;
    const result = await updateHandler(
      updateEvent(recipe.recipeId, {
        locale: 'en',
        name: 'Original Name',
        ingredientGroups: [{ groupId: group.groupId, name: 'Group A', lines: [second!, first!] }],
      }),
    );
    const updated = parseBody<Recipe>(result);
    expect(updated.ingredientGroups[0]?.lines[0]?.lineId).toBe(second!.lineId);
  });

  it('deletes an ingredient group by omitting it from the request', async () => {
    const recipe = await createTestRecipe();
    const result = await updateHandler(
      updateEvent(recipe.recipeId, { locale: 'en', name: 'Original Name', ingredientGroups: [] }),
    );
    const updated = parseBody<Recipe>(result);
    expect(updated.ingredientGroups).toHaveLength(0);
  });

  it('deletes a step by omitting it from the request', async () => {
    const recipe = await createTestRecipe();
    const result = await updateHandler(updateEvent(recipe.recipeId, { locale: 'en', name: 'Original Name', steps: [] }));
    const updated = parseBody<Recipe>(result);
    expect(updated.stepsOrder).toHaveLength(0);
  });

  it('returns 404 for a non-existent recipe', async () => {
    const result = await updateHandler(updateEvent('does-not-exist', { locale: 'en', name: 'x' }));
    expect(result.statusCode).toBe(404);
  });
});
