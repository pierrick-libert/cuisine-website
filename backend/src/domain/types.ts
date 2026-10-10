/** An IETF-style language tag, e.g. `'en'`, `'fr'`. */
export type Locale = string;

/** A practical volume-based stand-in for a weight measurement (e.g. "250g flour ≈ 16 tbsp"). */
export interface ApproxEquivalent {
  quantity: number;
  unit: string;
}

/**
 * A single structured ingredient line.
 *
 * @remarks
 * Quantity, unit, and the approximate equivalent are structural — shared across every locale of
 * the recipe (FR-009) — unlike the ingredient's name, which is locale-specific and lives on
 * {@link RecipeLocaleContent.ingredientNames} instead.
 */
export interface IngredientLine {
  lineId: string;
  quantity: number;
  /** `null` for a counted ingredient (e.g. "6 apples") that has no unit of measure. */
  unit: string | null;
  /** `null` when no approximate volume equivalent has been recorded (FR-005). */
  approxEquivalent: ApproxEquivalent | null;
}

/** A named subsection of a recipe's ingredient list (e.g. "For the filling"). */
export interface IngredientGroup {
  groupId: string;
  /** Lines in display order — order is not tracked separately; it *is* the array order. */
  lines: IngredientLine[];
}

export type RecipeStatus = 'draft';

/**
 * The `RECIPE#<id>/META` DynamoDB item — a recipe's structure and quantities only.
 *
 * @remarks
 * Deliberately carries no translatable text; see {@link RecipeLocaleContent} for that. This
 * split is what lets a recipe's quantities and structure stay shared across every locale it has
 * been authored in, instead of being duplicated per language.
 */
export interface RecipeMeta {
  recipeId: string;
  status: RecipeStatus;
  categoryId: string | null;
  tags: string[];
  ingredientGroups: IngredientGroup[];
  /** Step ids in display order; each id's text lives in {@link RecipeLocaleContent.steps}. */
  stepsOrder: string[];
  createdAt: string;
  updatedAt: string;
}

/** An opaque Tiptap JSON document — the backend stores and returns this without inspecting it. */
export type RichTextDoc = Record<string, unknown>;

/** The `RECIPE#<id>/LOCALE#<lang>` DynamoDB item — one language's translatable text only. */
export interface RecipeLocaleContent {
  name: string;
  description: string;
  /** Translated group names, keyed by {@link IngredientGroup.groupId}. */
  groupNames: Record<string, string>;
  /** Translated ingredient names, keyed by {@link IngredientLine.lineId}. */
  ingredientNames: Record<string, string>;
  /** Step rich text, keyed by the step id from {@link RecipeMeta.stepsOrder}. */
  steps: Record<string, RichTextDoc>;
}

/** The `CATEGORY#<id>/META` DynamoDB item. */
export interface Category {
  categoryId: string;
  /** Lowercased and trimmed, for case-insensitive matching (FR-008). */
  normalizedName: string;
  /** The category's original casing, as entered. */
  displayName: string;
}

/**
 * The assembled shape returned by `GET /recipes/\{id\}` — a {@link RecipeMeta} with every locale
 * it has content for. See `contracts/recipes-api.md`.
 */
export interface RecipeWithLocales extends RecipeMeta {
  locales: Record<Locale, RecipeLocaleContent>;
}

/** One row of the `GET /recipes` listing response. */
export interface RecipeSummary {
  recipeId: string;
  /** Resolved from whichever locale happens to be available, for display purposes only. */
  name: string;
  categoryId: string | null;
  tags: string[];
}

// --- Request body shapes (POST/PUT /recipes) ---
// The SPA edits a denormalized view (group/ingredient names alongside quantities); the repository
// layer splits this into the META (structure) and LOCALE (text) items on write.

/** One ingredient line as sent by the editor — structure and its (one-locale) name together. */
export interface IngredientLineInput {
  /** Omitted when adding a brand-new line; the repository layer generates an id. */
  lineId?: string;
  quantity: number;
  unit?: string | null;
  name: string;
  approxEquivalent?: ApproxEquivalent | null;
}

/** One ingredient group as sent by the editor. */
export interface IngredientGroupInput {
  /** Omitted when adding a brand-new group; the repository layer generates an id. */
  groupId?: string;
  name: string;
  lines: IngredientLineInput[];
}

/** One step as sent by the editor. */
export interface StepInput {
  /** Omitted when adding a brand-new step; the repository layer generates an id. */
  stepId?: string;
  richText: RichTextDoc;
}

/**
 * The `POST`/`PUT /recipes` request body.
 *
 * @remarks
 * Carries exactly one locale's content per call — `PUT` never touches any locale other than the
 * one named here (see `contracts/recipes-api.md`).
 */
export interface RecipeInput {
  locale: Locale;
  name: string;
  description?: string;
  /** `null` to clear the category; omitted to leave it unchanged on an update. */
  categoryName?: string | null;
  tags?: string[];
  ingredientGroups?: IngredientGroupInput[];
  steps?: StepInput[];
}
