import { describe, expect, it } from 'vitest';
import { buildPublishPlan } from '../../src/domain/publish-selection.js';

describe('buildPublishPlan (004, FR-002-FR-004)', () => {
  const recipes = [
    { recipeId: 'r1', selectedForNextPublish: true },
    { recipeId: 'r2', selectedForNextPublish: false },
    { recipeId: 'r3', selectedForNextPublish: true },
  ];

  it('includes only toggled-on recipes', () => {
    const plan = buildPublishPlan(recipes, 'publish');
    expect(plan.recipeIds).toEqual(['r1', 'r3']);
  });

  it('excludes every untoggled recipe, even when none are toggled on', () => {
    const plan = buildPublishPlan(
      [
        { recipeId: 'r1', selectedForNextPublish: false },
        { recipeId: 'r2', selectedForNextPublish: false },
      ],
      'publish',
    );
    expect(plan.recipeIds).toEqual([]);
  });

  it('builds the same recipe selection for publish and unpublish, only the action differs', () => {
    const publishPlan = buildPublishPlan(recipes, 'publish');
    const unpublishPlan = buildPublishPlan(recipes, 'unpublish');

    expect(unpublishPlan.recipeIds).toEqual(publishPlan.recipeIds);
    expect(publishPlan.action).toBe('publish');
    expect(unpublishPlan.action).toBe('unpublish');
  });
});
