import { beforeAll, describe, expect, it } from 'vitest';
import { createRecipe } from '../../src/repository/recipe-repository.js';
import {
  deletePipelineStatus,
  deletePublishedSnapshot,
  getPipelineStatus,
  getPublishedSnapshot,
  getPublishedSnapshotsForRecipe,
  listPublishedSnapshots,
  putPublishedSnapshot,
  setPipelineStatus,
  setPublishStatus,
  setSelectedForNextPublish,
} from '../../src/repository/publish-repository.js';
import { ensureTable } from './helpers.js';
import type { PublishedSnapshot } from '../../src/domain/types.js';

describe('publish-repository (004)', () => {
  beforeAll(ensureTable);

  describe('selectedForNextPublish / publishStatus', () => {
    it('toggles selectedForNextPublish on an existing recipe and returns the updated meta', async () => {
      const recipe = await createRecipe({ locale: 'en', name: 'Toggle Me' });

      const updated = await setSelectedForNextPublish(recipe.recipeId, true);

      expect(updated?.selectedForNextPublish).toBe(true);
    });

    it('returns null when toggling an unknown recipe id (404 case)', async () => {
      const updated = await setSelectedForNextPublish('does-not-exist', true);
      expect(updated).toBeNull();
    });

    it('sets publishStatus on an existing recipe', async () => {
      const recipe = await createRecipe({ locale: 'en', name: 'Status Me' });

      await setPublishStatus(recipe.recipeId, 'live');

      const updated = await setSelectedForNextPublish(recipe.recipeId, false);
      expect(updated?.publishStatus).toBe('live');
    });
  });

  describe('published snapshots', () => {
    const snapshot: PublishedSnapshot = {
      recipeId: 'r-snap-1',
      locale: 'en',
      title: 'Grandma’s Apple Tart',
      slug: 'grandmas-apple-tart',
      categoryId: 'c-1',
      renderedAt: '2026-10-19T00:00:00Z',
    };

    it('writes and lists a published snapshot', async () => {
      await putPublishedSnapshot(snapshot);

      const all = await listPublishedSnapshots();

      expect(all).toContainEqual(snapshot);
    });

    it('deletes a published snapshot', async () => {
      await putPublishedSnapshot(snapshot);

      await deletePublishedSnapshot(snapshot.recipeId, snapshot.locale);

      const all = await listPublishedSnapshots();
      expect(all.find((s) => s.recipeId === snapshot.recipeId && s.locale === snapshot.locale)).toBeUndefined();
    });

    it('gets one locale snapshot for a recipe, or null if none exists', async () => {
      await putPublishedSnapshot(snapshot);

      expect(await getPublishedSnapshot(snapshot.recipeId, snapshot.locale)).toEqual(snapshot);
      expect(await getPublishedSnapshot(snapshot.recipeId, 'de')).toBeNull();
    });

    it('gets only the snapshots for one recipe, across every locale it was published in', async () => {
      const frSnapshot: PublishedSnapshot = { ...snapshot, locale: 'fr', slug: 'tarte-aux-pommes-de-grand-mere' };
      const otherRecipeSnapshot: PublishedSnapshot = { ...snapshot, recipeId: 'r-other' };
      await putPublishedSnapshot(snapshot);
      await putPublishedSnapshot(frSnapshot);
      await putPublishedSnapshot(otherRecipeSnapshot);

      const result = await getPublishedSnapshotsForRecipe(snapshot.recipeId);

      expect(result).toHaveLength(2);
      expect(result.map((s) => s.locale).sort()).toEqual(['en', 'fr']);
    });
  });

  describe('pipeline status', () => {
    it('defaults to not running when no run has ever started', async () => {
      // Other test files in this shared local-DynamoDB table also write PIPELINE#STATUS
      // (a genuine singleton, data-model.md) — force its true "never written" state first so
      // this assertion is deterministic regardless of suite-wide test ordering.
      await deletePipelineStatus();

      const status = await getPipelineStatus();
      expect(status.running).toBe(false);
      expect(status.executionArn).toBeNull();
    });

    it('persists a run-started status and reads it back', async () => {
      await setPipelineStatus({
        running: true,
        executionArn: 'arn:aws:states:eu-central-1:123:execution:Pipeline:abc',
        action: 'publish',
        startedAt: '2026-10-19T10:00:00Z',
        lastResult: null,
      });

      const status = await getPipelineStatus();

      expect(status).toEqual({
        running: true,
        executionArn: 'arn:aws:states:eu-central-1:123:execution:Pipeline:abc',
        action: 'publish',
        startedAt: '2026-10-19T10:00:00Z',
        lastResult: null,
      });
    });
  });
});
