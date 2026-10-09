import { describe, expect, it } from 'vitest';
import {
  emptyLocaleContent,
  mergeGroupsForDisplay,
  splitGroupsFromDisplay,
  mergeStepsForDisplay,
  splitStepsFromDisplay,
} from '../../src/lib/localeEditing.js';
import type { RawRecipeGroup } from '../../src/services/recipesApi.js';

describe('mergeGroupsForDisplay / splitGroupsFromDisplay (US3, FR-009)', () => {
  const structure: RawRecipeGroup[] = [
    { groupId: 'g1', lines: [{ lineId: 'l1', quantity: 250, unit: 'g', approxEquivalent: null }] },
  ];
  const en = { ...emptyLocaleContent(), groupNames: { g1: 'For the dough' }, ingredientNames: { l1: 'flour' } };
  const fr = { ...emptyLocaleContent(), groupNames: { g1: 'Pour la pâte' }, ingredientNames: { l1: 'farine' } };

  it('merges structure with the active locale\'s text', () => {
    const display = mergeGroupsForDisplay(structure, en);
    expect(display[0]?.name).toBe('For the dough');
    expect(display[0]?.lines[0]?.name).toBe('flour');
    expect(display[0]?.lines[0]?.quantity).toBe(250);
  });

  it('round-trips structural edits made while viewing one locale, into another', () => {
    // Simulate: viewing English, bump the quantity (a structural edit).
    const enDisplay = mergeGroupsForDisplay(structure, en);
    const editedDisplay = [{ ...enDisplay[0]!, lines: [{ ...enDisplay[0]!.lines[0]!, quantity: 300 }] }];
    const { structure: newStructure } = splitGroupsFromDisplay(editedDisplay);

    // Switching to French must show the NEW quantity, with French text, not English text.
    const frDisplay = mergeGroupsForDisplay(newStructure, fr);
    expect(frDisplay[0]?.lines[0]?.quantity).toBe(300);
    expect(frDisplay[0]?.lines[0]?.name).toBe('farine');
  });

  it('splitting extracts text separately from structure', () => {
    const display = mergeGroupsForDisplay(structure, en);
    const { structure: s, groupNames, ingredientNames } = splitGroupsFromDisplay(display);
    expect(s).toEqual(structure);
    expect(groupNames).toEqual({ g1: 'For the dough' });
    expect(ingredientNames).toEqual({ l1: 'flour' });
  });
});

describe('mergeStepsForDisplay / splitStepsFromDisplay', () => {
  it('keeps step order shared while text is locale-specific', () => {
    const stepsOrder = ['s1', 's2'];
    const en = { ...emptyLocaleContent(), steps: { s1: { text: 'first' }, s2: { text: 'second' } } };
    const display = mergeStepsForDisplay(stepsOrder, en);
    expect(display.map((s) => s.stepId)).toEqual(['s1', 's2']);
    expect(display[0]?.richText).toEqual({ text: 'first' });

    const { stepsOrder: order2, steps } = splitStepsFromDisplay(display);
    expect(order2).toEqual(stepsOrder);
    expect(steps.s1).toEqual({ text: 'first' });
  });
});
