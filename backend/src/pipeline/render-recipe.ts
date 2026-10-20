import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getRecipe } from '../repository/recipe-repository.js';
import {
  deletePublishedSnapshot,
  getPublishedSnapshot,
  putPublishedSnapshot,
  setPublishStatus,
  setSelectedForNextPublish,
} from '../repository/publish-repository.js';
import { recipeSlug, slugify } from '../lib/slug.js';
import { SUPPORTED_LOCALES } from '../lib/locales.js';
import { getCategoryById } from '../repository/category-repository.js';
import { renderRecipePage, type LocaleLink } from '../../../public-site/src/render.js';
import { renderRichText } from '../../../public-site/src/render-rich-text.js';
import type { RecipeLocaleContent } from '../domain/types.js';

const s3 = new S3Client({});
const PUBLIC_BUCKET_NAME = process.env.PUBLIC_BUCKET_NAME ?? 'clp-cuisine-website-public';

/**
 * Renders and publishes one recipe, in every locale it has content for (Map-state task behind
 * `POST /publish` — User Story 1, FR-015).
 *
 * @remarks
 * On success: uploads each locale's rendered page to the public bucket, writes that locale's
 * published-snapshot record, and sets `publishStatus` to `'live'`. On failure: leaves
 * `publishStatus` at whatever it was before this call (FR-010) and re-throws, so Step Functions'
 * Catch handling sees the failure. Either way, resets `selectedForNextPublish` to `false`
 * (FR-005) — a failed recipe is not silently retried; the owner re-toggles it like any other.
 *
 * @param recipeId - The recipe to render.
 */
export async function renderRecipe(recipeId: string): Promise<void> {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return;

  const priorStatus = recipe.publishStatus;
  await setPublishStatus(recipeId, 'publishing');
  // Locales that are newly published in THIS attempt (no prior snapshot at all) — rolled back if
  // a later locale fails, so a partial failure never leaves a brand-new locale live while the
  // overall publishStatus reverts to its prior (never-live) value (Important 13 from code
  // review: the index must never disagree with publishStatus). A locale that was *already* live
  // before this attempt and re-rendered successfully is NOT rolled back on a later locale's
  // failure — its prior state was live, so FR-010 ("leave prior state intact") is satisfied by
  // simply keeping the freshly-rendered content, not deleting already-public content over an
  // unrelated locale's failure.
  const newlyPublishedThisAttempt: Array<{ locale: string; slug: string }> = [];

  // Slug generation is deterministic (name + recipeId) and needs no DB round-trip per locale, so
  // every locale's slug can be computed upfront — this drives the locale-switcher links rendered
  // into each locale's own page, including ones not yet reached by this loop.
  const slugByLocale = new Map<string, string>();
  for (const [locale, content] of Object.entries(recipe.locales) as Array<[string, RecipeLocaleContent]>) {
    slugByLocale.set(locale, recipeSlug(content.name, recipeId));
  }
  const localeLinks: LocaleLink[] = SUPPORTED_LOCALES.map((locale) => {
    const slug = slugByLocale.get(locale);
    return { locale, label: locale.toUpperCase(), href: slug ? `/${locale}/recipes/${slug}.html` : null };
  });
  const category = recipe.categoryId ? await getCategoryById(recipe.categoryId) : null;
  const categoryLink = category ? { name: category.displayName, slug: slugify(category.displayName) } : null;

  try {
    for (const [locale, content] of Object.entries(recipe.locales) as Array<[string, RecipeLocaleContent]>) {
      const slug = slugByLocale.get(locale)!;
      const stepsHtml = recipe.stepsOrder.map((stepId) => renderRichText(content.steps[stepId] ?? { type: 'doc', content: [] }));
      // Structured, not a flattened string — the client-side servings-scaling script
      // (public-site/assets/recipe.js) recomputes the displayed quantity/approximate equivalent
      // itself from this data (005-recipe-media-details User Story 3).
      const ingredientGroups = recipe.ingredientGroups.map((group) => ({
        name: content.groupNames[group.groupId] ?? null,
        lines: group.lines.map((line) => ({
          quantity: line.quantity,
          unit: line.unit,
          name: content.ingredientNames[line.lineId] ?? '',
          approxEquivalent: line.approxEquivalent,
        })),
      }));

      const html = await renderRecipePage({
        locale,
        title: content.name,
        description: content.description,
        ingredientGroups,
        stepsHtml,
        category: categoryLink,
        locales: localeLinks,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        baseServings: recipe.baseServings,
        coverImageUrl: recipe.coverImageUrl,
      });

      // A rename changes the slug — the previous page (keyed by this recipe's own prior
      // snapshot, not by name) would otherwise stay orphaned and publicly reachable forever
      // (US2's "no longer reachable" guarantee, applied to a renamed-then-republished recipe).
      const previousSnapshot = await getPublishedSnapshot(recipeId, locale);
      if (previousSnapshot && previousSnapshot.slug !== slug) {
        await s3.send(
          new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET_NAME, Key: `${locale}/recipes/${previousSnapshot.slug}.html` }),
        );
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: PUBLIC_BUCKET_NAME,
          Key: `${locale}/recipes/${slug}.html`,
          Body: html,
          ContentType: 'text/html',
        }),
      );

      await putPublishedSnapshot({
        recipeId,
        locale,
        title: content.name,
        slug,
        categoryId: recipe.categoryId,
        coverImageUrl: recipe.coverImageUrl,
        renderedAt: new Date().toISOString(),
      });
      if (!previousSnapshot) newlyPublishedThisAttempt.push({ locale, slug });
    }

    await setPublishStatus(recipeId, 'live');
  } catch (err) {
    for (const { locale, slug } of newlyPublishedThisAttempt) {
      await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET_NAME, Key: `${locale}/recipes/${slug}.html` }));
      await deletePublishedSnapshot(recipeId, locale);
    }
    await setPublishStatus(recipeId, priorStatus);
    throw err;
  } finally {
    await setSelectedForNextPublish(recipeId, false);
  }
}

/**
 * The actual Lambda entrypoint (infra/pipeline.ts's `RenderRecipeFunction`) — Step Functions'
 * Map state invokes this with `{ recipeId }` (its `ItemSelector`/`Payload` shape), never a bare
 * string, so this must destructure before delegating to {@link renderRecipe}.
 */
export async function handler(event: { recipeId: string }): Promise<void> {
  return renderRecipe(event.recipeId);
}
