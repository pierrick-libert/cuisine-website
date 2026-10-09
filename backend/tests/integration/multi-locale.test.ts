import { beforeAll, describe, expect, it } from 'vitest';
import { handler as createHandler } from '../../src/handlers/create-recipe.js';
import { handler as updateHandler } from '../../src/handlers/update-recipe.js';
import { handler as getHandler } from '../../src/handlers/get-recipe.js';
import { ensureTable, parseBody } from './helpers.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { RecipeInput } from '../../src/domain/types.js';

function event(body: RecipeInput, id?: string): APIGatewayProxyEventV2 {
  return {
    pathParameters: id ? { id } : undefined,
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEventV2;
}

type Recipe = {
  recipeId: string;
  ingredientGroups: Array<{ groupId: string; lines: Array<{ lineId: string; quantity: number; unit: string | null }> }>;
  locales: Record<string, { name: string; ingredientNames: Record<string, string> }>;
};

describe('Multi-locale authoring (US3, FR-009)', () => {
  beforeAll(ensureTable);

  it('adds a second locale while keeping structure/quantities shared, not duplicated', async () => {
    const created = await createHandler(
      event({
        locale: 'en',
        name: "Grandma's Apple Tart",
        ingredientGroups: [{ name: 'For the dough', lines: [{ quantity: 250, unit: 'g', name: 'flour' }] }],
      }),
    );
    const recipe = parseBody<Recipe>(created);
    const group = recipe.ingredientGroups[0]!;
    const line = group.lines[0]!;

    // Add French content for the SAME structural ids — this is what the real editor does when
    // a second locale tab is filled in: it reuses groupId/lineId, only the text changes.
    await updateHandler(
      event(
        {
          locale: 'fr',
          name: 'Tarte aux pommes de grand-mère',
          ingredientGroups: [
            {
              groupId: group.groupId,
              name: 'Pour la pâte',
              lines: [{ lineId: line.lineId, quantity: line.quantity, unit: line.unit, name: 'farine' }],
            },
          ],
        },
        recipe.recipeId,
      ),
    );

    const result = await getHandler(event({ locale: 'en', name: '' }, recipe.recipeId));
    const full = parseBody<Recipe>(result);

    // Both locales are independently retrievable.
    expect(full.locales.en?.name).toBe("Grandma's Apple Tart");
    expect(full.locales.fr?.name).toBe('Tarte aux pommes de grand-mère');
    expect(full.locales.en?.ingredientNames[line.lineId]).toBe('flour');
    expect(full.locales.fr?.ingredientNames[line.lineId]).toBe('farine');

    // Quantity/unit (structure) is shared, not duplicated per locale.
    expect(full.ingredientGroups).toHaveLength(1);
    expect(full.ingredientGroups[0]?.lines[0]?.quantity).toBe(250);
  });

  it('remains valid with only one locale (FR-014)', async () => {
    const created = await createHandler(event({ locale: 'en', name: 'English Only' }));
    const recipe = parseBody<Recipe>(created);
    const result = await getHandler(event({ locale: 'en', name: '' }, recipe.recipeId));
    const full = parseBody<Recipe>(result);
    expect(Object.keys(full.locales)).toEqual(['en']);
  });
});
