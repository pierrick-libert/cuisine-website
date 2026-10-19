/** The minimal recipe shape {@link buildPublishPlan} needs — a subset of `RecipeMeta` (types.ts). */
export interface SelectableRecipe {
  recipeId: string;
  selectedForNextPublish: boolean;
}

/** One Publish or Unpublish run's fixed target: the action and the recipe ids it acts on. */
export interface PublishPlan {
  action: 'publish' | 'unpublish';
  recipeIds: string[];
}

/**
 * Builds a run plan for the given action from the currently toggled-on recipes (FR-002-FR-004).
 *
 * @remarks
 * Pure — takes an already-fetched recipe list rather than querying the table itself, so the set
 * of recipes a run acts on is fixed at the moment this is called (data-model.md's validation
 * rule), independent of any toggle changes made afterward.
 */
export function buildPublishPlan(recipes: SelectableRecipe[], action: PublishPlan['action']): PublishPlan {
  return {
    action,
    recipeIds: recipes.filter((recipe) => recipe.selectedForNextPublish).map((recipe) => recipe.recipeId),
  };
}
