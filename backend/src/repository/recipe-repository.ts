import {
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './table-client.js';
import { generateId } from '../lib/id.js';
import { findOrCreateCategory } from './category-repository.js';
import { ValidationError } from '../domain/errors.js';
import { validateIngredientLine } from '../domain/ingredient.js';
import type {
  IngredientGroup,
  Locale,
  RecipeInput,
  RecipeLocaleContent,
  RecipeMeta,
  RecipeSummary,
  RecipeWithLocales,
} from '../domain/types.js';

const metaKey = (recipeId: string) => ({ PK: `RECIPE#${recipeId}`, SK: 'META' });
const localeKey = (recipeId: string, locale: Locale) => ({
  PK: `RECIPE#${recipeId}`,
  SK: `LOCALE#${locale}`,
});

function assertNonEmptyName(name: string): void {
  // FR-002: a non-empty recipe name is required before a recipe can be saved, even as a draft.
  if (!name || !name.trim()) {
    throw new ValidationError('Recipe name is required.');
  }
}

/** Splits the denormalized request body into META structure + LOCALE text (FR-009). */
function splitInput(input: RecipeInput): { groups: IngredientGroup[]; stepsOrder: string[]; locale: RecipeLocaleContent } {
  const groupNames: Record<string, string> = {};
  const ingredientNames: Record<string, string> = {};

  const groups: IngredientGroup[] = (input.ingredientGroups ?? []).map((group) => {
    const groupId = group.groupId ?? generateId();
    groupNames[groupId] = group.name;
    return {
      groupId,
      lines: group.lines.map((line) => {
        validateIngredientLine(line);
        const lineId = line.lineId ?? generateId();
        ingredientNames[lineId] = line.name;
        return {
          lineId,
          quantity: line.quantity,
          // FR-004: unit is optional (counted ingredients have none).
          unit: line.unit ?? null,
          // FR-005: approximate volume equivalent is optional, entered manually in this feature.
          approxEquivalent: line.approxEquivalent ?? null,
        };
      }),
    };
  });

  const steps: Record<string, RecipeLocaleContent['steps'][string]> = {};
  const stepsOrder: string[] = (input.steps ?? []).map((step) => {
    const stepId = step.stepId ?? generateId();
    steps[stepId] = step.richText;
    return stepId;
  });

  return {
    groups,
    stepsOrder,
    locale: {
      name: input.name,
      description: input.description ?? '',
      groupNames,
      ingredientNames,
      steps,
    },
  };
}

function assembleRecipe(metaItem: RecipeMeta, localeItems: Array<{ SK: string } & RecipeLocaleContent>): RecipeWithLocales {
  const locales: Record<Locale, RecipeLocaleContent> = {};
  for (const item of localeItems) {
    const locale = item.SK.replace('LOCALE#', '');
    const { SK: _sk, ...content } = item;
    locales[locale] = content as RecipeLocaleContent;
  }
  return { ...metaItem, locales };
}

export async function createRecipe(input: RecipeInput): Promise<RecipeWithLocales> {
  assertNonEmptyName(input.name);

  const recipeId = generateId();
  const now = new Date().toISOString();
  const { groups, stepsOrder, locale } = splitInput(input);
  const category = input.categoryName ? await findOrCreateCategory(input.categoryName) : null;

  const meta: RecipeMeta = {
    recipeId,
    status: 'draft',
    categoryId: category?.categoryId ?? null,
    tags: input.tags ?? [],
    ingredientGroups: groups,
    stepsOrder,
    createdAt: now,
    updatedAt: now,
  };

  const transactItems: TransactWriteCommandInput['TransactItems'] = [
    { Put: { TableName: TABLE_NAME, Item: { ...metaKey(recipeId), ...meta } } },
    { Put: { TableName: TABLE_NAME, Item: { ...localeKey(recipeId, input.locale), ...locale } } },
  ];
  await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  return { ...meta, locales: { [input.locale]: locale } };
}

export async function getRecipe(recipeId: string): Promise<RecipeWithLocales | null> {
  // A single Query by partition key returns the META item and every LOCALE#* item together —
  // no secondary index needed, per constitution Principle IV.
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `RECIPE#${recipeId}` },
    }),
  );
  const items = result.Items ?? [];
  const metaItem = items.find((item) => item.SK === 'META') as RecipeMeta | undefined;
  if (!metaItem) return null;

  const localeItems = items.filter((item) => (item.SK as string).startsWith('LOCALE#')) as Array<
    { SK: string } & RecipeLocaleContent
  >;
  return assembleRecipe(metaItem, localeItems);
}

export async function updateRecipe(recipeId: string, input: RecipeInput): Promise<RecipeWithLocales | null> {
  assertNonEmptyName(input.name);

  const existing = await getRecipe(recipeId);
  if (!existing) return null;

  const { groups, stepsOrder, locale } = splitInput(input);
  const category = input.categoryName !== undefined && input.categoryName !== null
    ? await findOrCreateCategory(input.categoryName)
    : null;

  const meta: RecipeMeta = {
    recipeId,
    status: existing.status,
    categoryId: category ? category.categoryId : existing.categoryId,
    tags: input.tags ?? existing.tags,
    ingredientGroups: groups,
    stepsOrder,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const transactItems: TransactWriteCommandInput['TransactItems'] = [
    { Put: { TableName: TABLE_NAME, Item: { ...metaKey(recipeId), ...meta } } },
    { Put: { TableName: TABLE_NAME, Item: { ...localeKey(recipeId, input.locale), ...locale } } },
  ];
  await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  const locales = { ...existing.locales, [input.locale]: locale };
  return { ...meta, locales };
}

export async function deleteRecipe(recipeId: string): Promise<boolean> {
  const existing = await getRecipe(recipeId);
  if (!existing) return false;

  const keysToDelete = [metaKey(recipeId), ...Object.keys(existing.locales).map((locale) => localeKey(recipeId, locale))];
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: keysToDelete.map((Key) => ({ Delete: { TableName: TABLE_NAME, Key } })),
    }),
  );
  return true;
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  // Full table Scan grouped in memory, per constitution Principle IV — this project's scale
  // (roughly 100-1000 recipes) makes this both simple and cheap.
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  const items = result.Items ?? [];

  const metaByRecipeId = new Map<string, RecipeMeta>();
  const firstLocaleByRecipeId = new Map<string, RecipeLocaleContent>();

  for (const item of items) {
    const pk = item.PK as string;
    if (!pk.startsWith('RECIPE#')) continue;
    const recipeId = pk.replace('RECIPE#', '');
    if (item.SK === 'META') {
      metaByRecipeId.set(recipeId, item as RecipeMeta);
    } else if ((item.SK as string).startsWith('LOCALE#') && !firstLocaleByRecipeId.has(recipeId)) {
      firstLocaleByRecipeId.set(recipeId, item as RecipeLocaleContent);
    }
  }

  return Array.from(metaByRecipeId.entries()).map(([recipeId, meta]) => ({
    recipeId,
    name: firstLocaleByRecipeId.get(recipeId)?.name ?? '',
    categoryId: meta.categoryId,
    tags: meta.tags,
  }));
}
