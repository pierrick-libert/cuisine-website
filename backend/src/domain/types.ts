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

/** Only `'draft'` exists in this feature — see {@link PublishStatus} for the separate publish state. */
export type RecipeStatus = 'draft';

/**
 * A recipe's current actual public state (004-publish-pipeline-and's `publishStatus`, FR-008) —
 * independent of {@link RecipeMeta.selectedForNextPublish}, which only selects a recipe for the
 * next run, not its current state.
 */
export type PublishStatus = 'not_published' | 'live' | 'publishing' | 'unpublishing';

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
  /**
   * The one-shot "included in the next Publish/Unpublish run" toggle (004-publish-pipeline-and
   * FR-001). Reset to `false` by the pipeline once a run acts on this recipe (FR-005) — never by
   * any other write path.
   */
  selectedForNextPublish: boolean;
  /** This recipe's current actual public state, independent of the toggle above (FR-008). */
  publishStatus: PublishStatus;
  /** Preparation time in minutes (005-recipe-media-details FR-001) — recipe-level, not per-locale. */
  prepMinutes: number | null;
  /** Cook/bake time in minutes (005-recipe-media-details FR-001) — recipe-level, not per-locale. */
  cookMinutes: number | null;
  /**
   * The servings count the authored ingredient quantities are for — the denominator of the public
   * site's servings-scaling multiplier (005-recipe-media-details FR-001, FR-006). `null` means no
   * servings control is offered on the public page.
   */
  baseServings: number | null;
  /** One shared cover image URL for the recipe, not per-locale (005-recipe-media-details FR-002). */
  coverImageUrl: string | null;
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
  /** Resolved from {@link RecipeMeta.categoryId} for display — `null` if there is no category, or
   * if the category it referenced no longer exists. */
  categoryName: string | null;
  locales: Record<Locale, RecipeLocaleContent>;
}

/** One row of the `GET /recipes` listing response. */
export interface RecipeSummary {
  recipeId: string;
  /** Resolved from whichever locale happens to be available, for display purposes only. */
  name: string;
  categoryId: string | null;
  tags: string[];
  /** See {@link RecipeMeta.selectedForNextPublish} (004-publish-pipeline-and, FR-008). */
  selectedForNextPublish: boolean;
  /** See {@link RecipeMeta.publishStatus} (004-publish-pipeline-and, FR-008). */
  publishStatus: PublishStatus;
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
  /** Omitted leaves unchanged; `null` clears it (005-recipe-media-details). Recipe-level, not per-locale. */
  prepMinutes?: number | null;
  /** Omitted leaves unchanged; `null` clears it (005-recipe-media-details). Recipe-level, not per-locale. */
  cookMinutes?: number | null;
  /** Omitted leaves unchanged; `null` clears it (005-recipe-media-details). Recipe-level, not per-locale. */
  baseServings?: number | null;
  /** Omitted leaves unchanged; `null` clears it (005-recipe-media-details). Recipe-level, not per-locale. */
  coverImageUrl?: string | null;
}

// --- POST /translate (003-translation-drafting) ---
// Stateless: no recipeId, no persisted entity — see that feature's data-model.md.

/**
 * The `POST /translate` request body — a recipe's locale content plus which locales to translate
 * between. See `003-translation-drafting/contracts/translate-api.md`.
 */
export interface TranslateInput {
  /** e.g. `"fr"` — this endpoint is locale-agnostic; it does not validate against a known list. */
  sourceLocale: string;
  /** e.g. `"en"`. */
  targetLocale: string;
  name: string;
  description: string;
  groupNames: Record<string, string>;
  ingredientNames: Record<string, string>;
  steps: Record<string, RichTextDoc>;
}

/** The `POST /translate` response — same shape as the translatable parts of {@link TranslateInput}. */
export interface TranslateOutput {
  name: string;
  description: string;
  groupNames: Record<string, string>;
  ingredientNames: Record<string, string>;
  steps: Record<string, RichTextDoc>;
}

// --- 004-publish-pipeline-and ---

/**
 * The `RECIPE#<id>/PUBLISHED#<locale>` DynamoDB item — what was actually last rendered to the
 * public site for one recipe in one locale, deliberately decoupled from that recipe's current
 * draft content (data-model.md). This, not the live draft, is what the browse/search index and
 * category shells are rebuilt from (FR-013).
 */
export interface PublishedSnapshot {
  recipeId: string;
  locale: Locale;
  /** The recipe's name *as actually rendered* — not necessarily the current draft name. */
  title: string;
  /** The URL path segment this locale's recipe page was rendered under. */
  slug: string;
  /** The category this recipe was filed under *as actually rendered*. */
  categoryId: string | null;
  /** The cover image URL *as actually rendered* (005-recipe-media-details FR-004). */
  coverImageUrl: string | null;
  renderedAt: string;
}

/**
 * The single `PIPELINE#STATUS` DynamoDB item — exactly one ever exists. Tracks whether a Publish
 * or Unpublish run is currently in progress (the FR-009 run-lock) and its status, for
 * `GET /publish-status` polling.
 */
export interface PipelineStatus {
  running: boolean;
  executionArn: string | null;
  action: 'publish' | 'unpublish' | null;
  startedAt: string | null;
  lastResult: 'succeeded' | 'failed' | null;
}
