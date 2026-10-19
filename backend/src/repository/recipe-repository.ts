import {
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './table-client.js';
import { generateId } from '../lib/id.js';
import { findOrCreateCategory, getCategoryById } from './category-repository.js';
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

/**
 * @throws {@link ValidationError} if `name` is empty — FR-002 requires a recipe name before it
 * can be saved, even as a draft.
 */
function assertNonEmptyName(name: string): void {
  if (!name || !name.trim()) {
    throw new ValidationError('Recipe name is required.');
  }
}

/**
 * Splits the editor's denormalized request body into META structure and LOCALE text (FR-009),
 * validating each ingredient line (FR-004, FR-005) and assigning ids to any new group/line/step.
 */
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

/** Resolves a `categoryId` to its display name, for the `GET`-response shape. */
async function resolveCategoryName(categoryId: string | null): Promise<string | null> {
  if (!categoryId) return null;
  const category = await getCategoryById(categoryId);
  return category?.displayName ?? null;
}

/** Strips DynamoDB's internal `PK`/`SK` attributes before an item is returned over the API. */
function stripKeys<T extends object>(item: T): Omit<T, 'PK' | 'SK'> {
  const { PK: _pk, SK: _sk, ...rest } = item as T & { PK?: string; SK?: string };
  return rest;
}

/**
 * Defaults `selectedForNextPublish`/`publishStatus` for a META item written before
 * 004-publish-pipeline-and existed (001-003's recipes have neither field at all).
 *
 * @remarks
 * Without this, a pre-004 recipe's `publishStatus` reads back `undefined`: the backoffice shows
 * a blank status label, `PublishToggle` becomes an uncontrolled-to-controlled checkbox, and
 * writing `undefined` back through `publish-repository.ts` (whose marshaller strips `undefined`
 * values) can throw a `ValidationException` deep inside an unrelated catch block.
 */
function withPublishDefaults(meta: RecipeMeta): RecipeMeta {
  return {
    ...meta,
    selectedForNextPublish: meta.selectedForNextPublish ?? false,
    publishStatus: meta.publishStatus ?? 'not_published',
  };
}

/** Combines a META item with its LOCALE items into the `GET /recipes/\{id\}` response shape. */
function assembleRecipe(
  metaItem: RecipeMeta & { PK?: string; SK?: string },
  localeItems: Array<{ SK: string } & RecipeLocaleContent>,
  categoryName: string | null,
): RecipeWithLocales {
  const locales: Record<Locale, RecipeLocaleContent> = {};
  for (const item of localeItems) {
    const locale = item.SK.replace('LOCALE#', '');
    locales[locale] = stripKeys(item) as RecipeLocaleContent;
  }
  return { ...withPublishDefaults(stripKeys(metaItem) as RecipeMeta), categoryName, locales };
}

/**
 * Creates a new draft recipe (User Story 1).
 *
 * @param input - The recipe's initial content, for exactly one locale.
 * @returns The newly created recipe, in its assembled `GET`-response shape.
 * @throws {@link ValidationError} if `input.name` is empty (FR-002), or any ingredient line fails
 * {@link validateIngredientLine}.
 */
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
    // 004-publish-pipeline-and: every recipe starts untoggled and unpublished.
    selectedForNextPublish: false,
    publishStatus: 'not_published',
  };

  const transactItems: TransactWriteCommandInput['TransactItems'] = [
    { Put: { TableName: TABLE_NAME, Item: { ...metaKey(recipeId), ...meta } } },
    { Put: { TableName: TABLE_NAME, Item: { ...localeKey(recipeId, input.locale), ...locale } } },
  ];
  await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  return { ...meta, categoryName: category?.displayName ?? null, locales: { [input.locale]: locale } };
}

/**
 * Fetches one recipe with every locale it has content for.
 *
 * @remarks
 * A single `Query` by partition key returns the META item and every `LOCALE#*` item together —
 * no secondary index needed, per constitution Principle IV.
 *
 * @param recipeId - The recipe's id.
 * @returns The assembled recipe, or `null` if no recipe with that id exists.
 */
export async function getRecipe(recipeId: string): Promise<RecipeWithLocales | null> {
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
  const categoryName = await resolveCategoryName(metaItem.categoryId);
  return assembleRecipe(metaItem, localeItems, categoryName);
}

/**
 * Updates a recipe's structure and/or one locale's content (User Story 2).
 *
 * @remarks
 * Replaces the recipe's entire structure (ingredient groups/lines, step order) with whatever
 * `input` contains — there is no partial update. Locales other than `input.locale` are left
 * untouched, which is what lets {@link createRecipe} and this function together support
 * multi-language authoring (User Story 3) with no extra code.
 *
 * @param recipeId - The recipe's id.
 * @param input - The recipe's full new structure, plus one locale's content.
 * @returns The updated recipe, or `null` if no recipe with that id exists.
 * @throws {@link ValidationError} if `input.name` is empty (FR-002), or any ingredient line fails
 * {@link validateIngredientLine}.
 */
export async function updateRecipe(recipeId: string, input: RecipeInput): Promise<RecipeWithLocales | null> {
  assertNonEmptyName(input.name);

  const existing = await getRecipe(recipeId);
  if (!existing) return null;

  const { groups, stepsOrder, locale } = splitInput(input);

  // input.categoryName: omitted leaves the category unchanged, `null` clears it, a string
  // finds-or-creates it (see RecipeInput's doc comment).
  let categoryId = existing.categoryId;
  let categoryName = existing.categoryName;
  if (input.categoryName === null) {
    categoryId = null;
    categoryName = null;
  } else if (input.categoryName !== undefined) {
    const category = await findOrCreateCategory(input.categoryName);
    categoryId = category.categoryId;
    categoryName = category.displayName;
  }

  const meta: RecipeMeta = {
    recipeId,
    status: existing.status,
    categoryId,
    tags: input.tags ?? existing.tags,
    ingredientGroups: groups,
    stepsOrder,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    // 004-publish-pipeline-and: a draft edit never touches publish state (US3 — the public site
    // must not drift ahead of the last actual publish run just because the draft changed).
    selectedForNextPublish: existing.selectedForNextPublish,
    publishStatus: existing.publishStatus,
  };

  const transactItems: TransactWriteCommandInput['TransactItems'] = [
    { Put: { TableName: TABLE_NAME, Item: { ...metaKey(recipeId), ...meta } } },
    { Put: { TableName: TABLE_NAME, Item: { ...localeKey(recipeId, input.locale), ...locale } } },
  ];
  await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  const locales = { ...existing.locales, [input.locale]: locale };
  return { ...meta, categoryName, locales };
}

/**
 * Deletes a recipe and all of its locale content (User Story 2, FR-013).
 *
 * @param recipeId - The recipe's id.
 * @returns `true` if the recipe existed and was deleted; `false` if it did not exist.
 */
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

/**
 * Lists every draft recipe, for the backoffice's recipe list view.
 *
 * @remarks
 * Implemented as a full table `Scan` grouped in memory, per constitution Principle IV — at this
 * project's scale (roughly 100-1000 recipes) this is both simpler and cheaper than a secondary
 * index.
 *
 * @returns One summary row per recipe, with its name resolved from whichever locale is available.
 */
export async function listRecipes(): Promise<RecipeSummary[]> {
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
    selectedForNextPublish: meta.selectedForNextPublish ?? false,
    publishStatus: meta.publishStatus ?? 'not_published',
  }));
}
