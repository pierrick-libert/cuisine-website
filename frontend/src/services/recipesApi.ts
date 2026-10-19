// Mirrors backend/src/domain/types.ts's request/response shapes (contracts/recipes-api.md).
// Kept as a small duplicate rather than a shared package — not worth the setup at this project's
// size (two small apps, one developer).

import type { JSONContent } from '@tiptap/core';
import { getAccessToken } from './auth.js';

/** A practical volume-based stand-in for a weight measurement (e.g. "250g flour ≈ 16 tbsp"). */
export interface ApproxEquivalent {
  quantity: number;
  unit: string;
}

/** A single structured ingredient line, as displayed in the editor (structure + its name). */
export interface IngredientLine {
  lineId: string;
  quantity: number;
  unit: string | null;
  name: string;
  approxEquivalent: ApproxEquivalent | null;
}

/** A named ingredient group, as displayed in the editor. */
export interface IngredientGroup {
  groupId: string;
  name: string;
  lines: IngredientLine[];
}

/** A single recipe step. */
export interface Step {
  stepId: string;
  richText: JSONContent;
}

/** The flat, single-locale view of a recipe the editor renders — see {@link toRecipeDetail}. */
export interface RecipeDetail {
  recipeId: string;
  status: 'draft';
  categoryId: string | null;
  /** Resolved from {@link categoryId} for display — `null` if there is no category. */
  categoryName: string | null;
  tags: string[];
  /** The locale this view's text is drawn from (may differ from what was requested — see
   * {@link toRecipeDetail}). */
  locale: string;
  name: string;
  description: string;
  ingredientGroups: IngredientGroup[];
  steps: Step[];
  /** Every locale this recipe has content for, for the `LocaleTabs` component. */
  availableLocales: string[];
}

/** A recipe's current actual public state (004-publish-pipeline-and FR-008). */
export type PublishStatus = 'not_published' | 'live' | 'publishing' | 'unpublishing';

/** One row of the `GET /recipes` listing response. */
export interface RecipeSummary {
  recipeId: string;
  name: string;
  categoryId: string | null;
  tags: string[];
  /** The one-shot "included in the next Publish/Unpublish run" toggle (FR-001). */
  selectedForNextPublish: boolean;
  /** This recipe's current actual public state, independent of the toggle above (FR-008). */
  publishStatus: PublishStatus;
}

/** The `POST`/`PUT /recipes` request body — see `contracts/recipes-api.md`. */
export interface RecipeInput {
  locale: string;
  name: string;
  description?: string;
  categoryName?: string | null;
  tags?: string[];
  ingredientGroups?: Array<{
    groupId?: string;
    name: string;
    lines: Array<{
      lineId?: string;
      quantity: number;
      unit?: string | null;
      name: string;
      approxEquivalent?: ApproxEquivalent | null;
    }>;
  }>;
  steps?: Array<{ stepId?: string; richText: JSONContent }>;
}

/** One ingredient line as returned in the backend's assembled shape — structure only, no name. */
export interface RawRecipeLine {
  lineId: string;
  quantity: number;
  unit: string | null;
  approxEquivalent: ApproxEquivalent | null;
}

/** One ingredient group as returned in the backend's assembled shape — structure only, no name. */
export interface RawRecipeGroup {
  groupId: string;
  lines: RawRecipeLine[];
}

/** One locale's translatable text, as returned in the backend's assembled shape. */
export interface RawLocaleContent {
  name: string;
  description: string;
  groupNames: Record<string, string>;
  ingredientNames: Record<string, string>;
  steps: Record<string, JSONContent>;
}

/**
 * The backend's assembled `GET /recipes/\{id\}` response shape — structure
 * ({@link RawRecipeGroup}) kept separate from every locale's text ({@link RawLocaleContent}),
 * mirroring `data-model.md`'s META/LOCALE item split.
 */
export interface RawRecipe {
  recipeId: string;
  status: 'draft';
  categoryId: string | null;
  /** Resolved from {@link categoryId} for display — `null` if there is no category. */
  categoryName: string | null;
  tags: string[];
  ingredientGroups: RawRecipeGroup[];
  stepsOrder: string[];
  locales: Record<string, RawLocaleContent>;
}

/**
 * Projects the backend's split META/LOCALE shape ({@link RawRecipe}) into the flat,
 * single-locale view ({@link RecipeDetail}) most of the editor renders.
 *
 * @param raw - The recipe as returned by the backend.
 * @param locale - The preferred locale to project.
 * @returns A {@link RecipeDetail} for `locale`, or for any available locale if `raw` has no
 * content for the one requested (`RecipeDetail.locale` reports which one was actually used).
 */
export function toRecipeDetail(raw: RawRecipe, locale: string): RecipeDetail {
  const content = raw.locales[locale] ?? raw.locales[Object.keys(raw.locales)[0]!];
  const resolvedLocale = raw.locales[locale] ? locale : Object.keys(raw.locales)[0]!;

  return {
    recipeId: raw.recipeId,
    status: raw.status,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    tags: raw.tags,
    locale: resolvedLocale,
    name: content?.name ?? '',
    description: content?.description ?? '',
    ingredientGroups: raw.ingredientGroups.map((group) => ({
      groupId: group.groupId,
      name: content?.groupNames[group.groupId] ?? '',
      lines: group.lines.map((line) => ({
        ...line,
        name: content?.ingredientNames[line.lineId] ?? '',
      })),
    })),
    steps: raw.stepsOrder.map((stepId) => ({ stepId, richText: content?.steps[stepId] ?? {} })),
    availableLocales: Object.keys(raw.locales),
  };
}

/**
 * The deployed API's base URL, injected at build time (`infra/web.ts`'s `VITE_API_URL`
 * environment variable — see `specs/002-deploy-infrastructure/plan.md`). Empty in local
 * development, where `path` is instead proxied to the local backend — see `vite.config.ts`.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * A thin `fetch` wrapper shared by every API call below.
 *
 * @param path - The request path, relative to {@link API_BASE_URL} (proxied to the local backend
 * in development — see `vite.config.ts`).
 * @param init - Standard `fetch` options.
 * @returns The parsed JSON response, or `undefined` for a `204 No Content` response.
 * @throws If the response status is not ok (2xx).
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Lists every draft recipe (`GET /recipes`), for the recipe list page. */
export async function listRecipes(): Promise<RecipeSummary[]> {
  const data = await request<{ recipes: RecipeSummary[] }>('/recipes');
  return data.recipes;
}

/**
 * Fetches one recipe, projected to a single locale.
 *
 * @param recipeId - The recipe's id.
 * @param locale - The preferred locale to project (see {@link toRecipeDetail}).
 */
export async function getRecipe(recipeId: string, locale = 'en'): Promise<RecipeDetail> {
  const raw = await request<RawRecipe>(`/recipes/${recipeId}`);
  return toRecipeDetail(raw, locale);
}

/**
 * Fetches every locale's content at once.
 *
 * @remarks
 * Used by the recipe editor so switching locale tabs never needs a server round trip or discards
 * unsaved structural edits — see `src/lib/localeEditing.ts`.
 *
 * @param recipeId - The recipe's id.
 */
export async function getRecipeRaw(recipeId: string): Promise<RawRecipe> {
  return request<RawRecipe>(`/recipes/${recipeId}`);
}

/**
 * Creates a new draft recipe (`POST /recipes`).
 *
 * @param input - The recipe's initial content, for exactly one locale.
 */
export async function createRecipe(input: RecipeInput): Promise<RecipeDetail> {
  const raw = await request<RawRecipe>('/recipes', { method: 'POST', body: JSON.stringify(input) });
  return toRecipeDetail(raw, input.locale);
}

/**
 * Updates a recipe's structure and/or one locale's content (`PUT /recipes/\{id\}`).
 *
 * @param recipeId - The recipe's id.
 * @param input - The recipe's full new structure, plus one locale's content.
 */
export async function updateRecipe(recipeId: string, input: RecipeInput): Promise<RecipeDetail> {
  const raw = await request<RawRecipe>(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return toRecipeDetail(raw, input.locale);
}

/** Deletes a recipe (`DELETE /recipes/\{id\}`). */
export async function deleteRecipe(recipeId: string): Promise<void> {
  await request<void>(`/recipes/${recipeId}`, { method: 'DELETE' });
}
