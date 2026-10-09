import type {
  IngredientGroup,
  RawLocaleContent,
  RawRecipeGroup,
  Step,
} from '../services/recipesApi.js';

export function emptyLocaleContent(): RawLocaleContent {
  return { name: '', description: '', groupNames: {}, ingredientNames: {}, steps: {} };
}

/**
 * Combines locale-independent structure (ids, quantities, units — shared across all locales per
 * FR-009) with one locale's text, for display in the editor. Switching the active locale re-runs
 * this against the SAME structure, so unsaved structural edits (added/removed/reordered groups,
 * lines, or steps) survive a locale switch — only the text shown changes.
 */
export function mergeGroupsForDisplay(structure: RawRecipeGroup[], text: RawLocaleContent): IngredientGroup[] {
  return structure.map((group) => ({
    groupId: group.groupId,
    name: text.groupNames[group.groupId] ?? '',
    lines: group.lines.map((line) => ({ ...line, name: text.ingredientNames[line.lineId] ?? '' })),
  }));
}

/** Splits the editor's denormalized display groups back into shared structure + this locale's text. */
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

export function mergeStepsForDisplay(stepsOrder: string[], text: RawLocaleContent): Step[] {
  return stepsOrder.map((stepId) => ({
    stepId,
    richText: text.steps[stepId] ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  }));
}

export function splitStepsFromDisplay(display: Step[]): {
  stepsOrder: string[];
  steps: Record<string, Record<string, unknown>>;
} {
  const steps: Record<string, Record<string, unknown>> = {};
  const stepsOrder = display.map((step) => {
    steps[step.stepId] = step.richText;
    return step.stepId;
  });
  return { stepsOrder, steps };
}
