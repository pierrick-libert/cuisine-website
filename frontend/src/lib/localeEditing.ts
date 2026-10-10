import type { JSONContent } from '@tiptap/core';
import type {
  IngredientGroup,
  RawLocaleContent,
  RawRecipeGroup,
  Step,
} from '../services/recipesApi.js';

/** An empty {@link RawLocaleContent}, for a locale that has no content yet. */
export function emptyLocaleContent(): RawLocaleContent {
  return { name: '', description: '', groupNames: {}, ingredientNames: {}, steps: {} };
}

/**
 * Combines locale-independent structure with one locale's text, for display in the editor.
 *
 * @remarks
 * Structure (ids, quantities, units) is shared across all locales per FR-009. Switching the
 * active locale re-runs this against the *same* structure, so unsaved structural edits (added/
 * removed/reordered groups or lines) survive a locale switch — only the text shown changes.
 *
 * @param structure - The recipe's shared ingredient structure.
 * @param text - The active locale's text.
 * @returns The denormalized groups `IngredientGroupEditor` renders.
 */
export function mergeGroupsForDisplay(structure: RawRecipeGroup[], text: RawLocaleContent): IngredientGroup[] {
  return structure.map((group) => ({
    groupId: group.groupId,
    name: text.groupNames[group.groupId] ?? '',
    lines: group.lines.map((line) => ({ ...line, name: text.ingredientNames[line.lineId] ?? '' })),
  }));
}

/**
 * The inverse of {@link mergeGroupsForDisplay} — splits the editor's denormalized groups back
 * into shared structure and this locale's text, after any edit (text, reorder, add, or delete).
 *
 * @param display - The current state of `IngredientGroupEditor`'s groups.
 */
export function splitGroupsFromDisplay(display: IngredientGroup[]): {
  structure: RawRecipeGroup[];
  groupNames: Record<string, string>;
  ingredientNames: Record<string, string>;
} {
  const groupNames: Record<string, string> = {};
  const ingredientNames: Record<string, string> = {};
  const structure = display.map((group) => {
    groupNames[group.groupId] = group.name;
    return {
      groupId: group.groupId,
      lines: group.lines.map((line) => {
        ingredientNames[line.lineId] = line.name;
        return { lineId: line.lineId, quantity: line.quantity, unit: line.unit, approxEquivalent: line.approxEquivalent };
      }),
    };
  });
  return { structure, groupNames, ingredientNames };
}

/** The steps counterpart of {@link mergeGroupsForDisplay} — step order is shared; rich text is
 * per-locale. */
export function mergeStepsForDisplay(stepsOrder: string[], text: RawLocaleContent): Step[] {
  return stepsOrder.map((stepId) => ({
    stepId,
    richText: text.steps[stepId] ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  }));
}

/** The steps counterpart of {@link splitGroupsFromDisplay}. */
export function splitStepsFromDisplay(display: Step[]): {
  stepsOrder: string[];
  steps: Record<string, JSONContent>;
} {
  const steps: Record<string, JSONContent> = {};
  const stepsOrder = display.map((step) => {
    steps[step.stepId] = step.richText;
    return step.stepId;
  });
  return { stepsOrder, steps };
}
