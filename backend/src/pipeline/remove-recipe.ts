import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getRecipe } from '../repository/recipe-repository.js';
import {
  deletePublishedSnapshot,
  getPublishedSnapshotsForRecipe,
  setPublishStatus,
  setSelectedForNextPublish,
} from '../repository/publish-repository.js';

const s3 = new S3Client({});
const PUBLIC_BUCKET_NAME = process.env.PUBLIC_BUCKET_NAME ?? 'clp-cuisine-website-public';

/**
 * Removes one recipe from the public site, in every locale it is currently published in
 * (Map-state task behind `POST /unpublish` — User Story 2).
 *
 * @remarks
 * Reads which pages to delete from the published-snapshot table (`getPublishedSnapshotsForRecipe`)
 * rather than the recipe's current draft locales/slug — the slug actually rendered may differ
 * from what the draft would produce today if it has since been edited (User Story 3's stability
 * guarantee applies symmetrically to removal). On success: deletes each locale's page and
 * snapshot, sets `publishStatus` to `'not_published'`. On failure: leaves `publishStatus` at its
 * prior value (FR-010) and re-throws. Either way, resets `selectedForNextPublish` (FR-005).
 *
 * @param recipeId - The recipe to unpublish.
 */
export async function removeRecipe(recipeId: string): Promise<void> {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return;

  const priorStatus = recipe.publishStatus;
  await setPublishStatus(recipeId, 'unpublishing');

  try {
    const snapshots = await getPublishedSnapshotsForRecipe(recipeId);

    for (const snapshot of snapshots) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: PUBLIC_BUCKET_NAME,
          Key: `${snapshot.locale}/recipes/${snapshot.slug}.html`,
        }),
      );
      await deletePublishedSnapshot(recipeId, snapshot.locale);
    }

    await setPublishStatus(recipeId, 'not_published');
  } catch (err) {
    await setPublishStatus(recipeId, priorStatus);
    throw err;
  } finally {
    await setSelectedForNextPublish(recipeId, false);
  }
}
