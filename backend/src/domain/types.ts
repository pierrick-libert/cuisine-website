export type Locale = string; // e.g. 'en', 'fr'

export interface ApproxEquivalent {
  quantity: number;
  unit: string;
}

/** Structural ingredient line — quantity/unit are shared across locales (FR-009). */
export interface IngredientLine {
  lineId: string;
  quantity: number;
  unit: string | null;
  approxEquivalent: ApproxEquivalent | null;
}

export interface IngredientGroup {
  groupId: string;
  lines: IngredientLine[];
}

export type RecipeStatus = 'draft';

/** The RECIPE#<id>/META item — structure and quantities only, no translatable text. */
export interface RecipeMeta {
  recipeId: string;
  status: RecipeStatus;
  categoryId: string | null;
  tags: string[];
  ingredientGroups: IngredientGroup[];
  stepsOrder: string[];
  createdAt: string;
  updatedAt: string;
}

/** Opaque Tiptap JSON document — the backend never inspects its contents. */
export type RichTextDoc = Record<string, unknown>;

/** The RECIPE#<id>/LOCALE#<lang> item — translatable text only. */
export interface RecipeLocaleContent {
  name: string;
  description: string;
  groupNames: Record<string, string>;
  ingredientNames: Record<string, string>;
  steps: Record<string, RichTextDoc>;
}

export interface Category {
  categoryId: string;
  normalizedName: string;
  displayName: string;
}

/** Assembled shape returned by GET /recipes/{id}, per contracts/recipes-api.md. */
export interface RecipeWithLocales extends RecipeMeta {
  locales: Record<Locale, RecipeLocaleContent>;
}

/** Row shape returned by GET /recipes (list). */
export interface RecipeSummary {
  recipeId: string;
  name: string;
  categoryId: string | null;
  tags: string[];
}

// --- Request body shapes (POST/PUT /recipes) ---
// The SPA edits a denormalized view (group/ingredient names alongside quantities); the repository
// layer splits this into the META (structure) and LOCALE (text) items on write.

export interface IngredientLineInput {
  lineId?: string;
  quantity: number;
  unit?: string | null;
  name: string;
  approxEquivalent?: ApproxEquivalent | null;
}

export interface IngredientGroupInput {
  groupId?: string;
  name: string;
  lines: IngredientLineInput[];
}

export interface StepInput {
  stepId?: string;
  richText: RichTextDoc;
}

export interface RecipeInput {
  locale: Locale;
  name: string;
  description?: string;
  categoryName?: string | null;
  tags?: string[];
  ingredientGroups?: IngredientGroupInput[];
  steps?: StepInput[];
}
