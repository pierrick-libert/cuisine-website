// Mirrors backend/src/domain/types.ts's request/response shapes (contracts/recipes-api.md).
// Kept as a small duplicate rather than a shared package — not worth the setup at this project's
// size (two small apps, one developer).

export interface ApproxEquivalent {
  quantity: number;
  unit: string;
}

export interface IngredientLine {
  lineId: string;
  quantity: number;
  unit: string | null;
  name: string;
  approxEquivalent: ApproxEquivalent | null;
}

export interface IngredientGroup {
  groupId: string;
  name: string;
  lines: IngredientLine[];
}

export interface Step {
  stepId: string;
  richText: Record<string, unknown>;
}

export interface RecipeDetail {
  recipeId: string;
  status: 'draft';
  categoryId: string | null;
  tags: string[];
  locale: string;
  name: string;
  description: string;
  ingredientGroups: IngredientGroup[];
  steps: Step[];
  availableLocales: string[];
}

export interface RecipeSummary {
  recipeId: string;
  name: string;
  categoryId: string | null;
  tags: string[];
}

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
  steps?: Array<{ stepId?: string; richText: Record<string, unknown> }>;
}

// Backend's assembled GET shape (ingredientGroups hold ids/quantities, locales[x] holds text).
export interface RawRecipeLine {
  lineId: string;
  quantity: number;
  unit: string | null;
  approxEquivalent: ApproxEquivalent | null;
}
export interface RawRecipeGroup {
  groupId: string;
  lines: RawRecipeLine[];
}
export interface RawLocaleContent {
  name: string;
  description: string;
  groupNames: Record<string, string>;
  ingredientNames: Record<string, string>;
  steps: Record<string, Record<string, unknown>>;
}
export interface RawRecipe {
  recipeId: string;
  status: 'draft';
  categoryId: string | null;
  tags: string[];
  ingredientGroups: RawRecipeGroup[];
  stepsOrder: string[];
  locales: Record<string, RawLocaleContent>;
}

/** Projects the backend's split META/LOCALE shape into a flat, locale-specific editor view. */
export function toRecipeDetail(raw: RawRecipe, locale: string): RecipeDetail {
  const content = raw.locales[locale] ?? raw.locales[Object.keys(raw.locales)[0]!];
  const resolvedLocale = raw.locales[locale] ? locale : Object.keys(raw.locales)[0]!;

  return {
    recipeId: raw.recipeId,
    status: raw.status,
    categoryId: raw.categoryId,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const data = await request<{ recipes: RecipeSummary[] }>('/recipes');
  return data.recipes;
}

export async function getRecipe(recipeId: string, locale = 'en'): Promise<RecipeDetail> {
  const raw = await request<RawRecipe>(`/recipes/${recipeId}`);
  return toRecipeDetail(raw, locale);
}

/** Fetches every locale's content at once — used by the editor so switching locale tabs never
 * needs a server round trip or discards unsaved structural edits. */
export async function getRecipeRaw(recipeId: string): Promise<RawRecipe> {
  return request<RawRecipe>(`/recipes/${recipeId}`);
}

export async function createRecipe(input: RecipeInput): Promise<RecipeDetail> {
  const raw = await request<RawRecipe>('/recipes', { method: 'POST', body: JSON.stringify(input) });
  return toRecipeDetail(raw, input.locale);
}

export async function updateRecipe(recipeId: string, input: RecipeInput): Promise<RecipeDetail> {
  const raw = await request<RawRecipe>(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return toRecipeDetail(raw, input.locale);
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await request<void>(`/recipes/${recipeId}`, { method: 'DELETE' });
}
