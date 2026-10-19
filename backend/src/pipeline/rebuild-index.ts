import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { listPublishedSnapshots } from '../repository/publish-repository.js';
import { getCategoryById, listCategories } from '../repository/category-repository.js';
import { slugify } from '../lib/slug.js';
import { renderCategoryShellPage } from '../../../public-site/src/render.js';
import type { PublishedSnapshot } from '../domain/types.js';

const s3 = new S3Client({});
const PUBLIC_BUCKET_NAME = process.env.PUBLIC_BUCKET_NAME ?? 'clp-cuisine-website-public';

interface BrowseIndexEntry {
  recipeId: string;
  slug: string;
  title: string;
  categoryId: string | null;
  categorySlug: string | null;
}

/**
 * Resolves a category's slug for the browse index.
 *
 * @remarks
 * Categories are not yet per-locale in this codebase's data model (001's `Category` has one
 * global `displayName`, not a localized name per locale) — the same slug is used for every
 * locale until a future feature adds per-locale category content. See this feature's ledger for
 * this known gap against the constitution's "localized category slugs" aspiration.
 */
async function resolveCategorySlug(categoryId: string | null, cache: Map<string, string | null>): Promise<string | null> {
  if (!categoryId) return null;
  if (cache.has(categoryId)) return cache.get(categoryId) ?? null;
  const category = await getCategoryById(categoryId);
  const slug = category ? slugify(category.displayName) : null;
  cache.set(categoryId, slug);
  return slug;
}

function groupByLocale(snapshots: PublishedSnapshot[]): Map<string, PublishedSnapshot[]> {
  const byLocale = new Map<string, PublishedSnapshot[]>();
  for (const snapshot of snapshots) {
    const list = byLocale.get(snapshot.locale) ?? [];
    list.push(snapshot);
    byLocale.set(snapshot.locale, list);
  }
  return byLocale;
}

/**
 * Rebuilds the full browse/search index for every locale that currently has at least one
 * published recipe, built exclusively from the published-snapshot table (FR-013, SC-008,
 * `contracts/public-site-index.md`) — never from live draft recipe data, so it can never show
 * content ahead of what is actually rendered on the public site.
 */
export async function rebuildIndex(): Promise<void> {
  const snapshots = await listPublishedSnapshots();
  const byLocale = groupByLocale(snapshots);
  const categorySlugCache = new Map<string, string | null>();
  // Which (locale, categoryId) pairs currently have at least one live recipe — drives category
  // shell reconciliation below.
  const liveLocaleCategoryPairs = new Set<string>();

  for (const [locale, localeSnapshots] of byLocale) {
    const recipes: BrowseIndexEntry[] = [];
    for (const snapshot of localeSnapshots) {
      recipes.push({
        recipeId: snapshot.recipeId,
        slug: snapshot.slug,
        title: snapshot.title,
        categoryId: snapshot.categoryId,
        categorySlug: await resolveCategorySlug(snapshot.categoryId, categorySlugCache),
      });
      if (snapshot.categoryId) liveLocaleCategoryPairs.add(`${locale}::${snapshot.categoryId}`);
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: PUBLIC_BUCKET_NAME,
        Key: `${locale}/browse-index.json`,
        Body: JSON.stringify({ generatedAt: new Date().toISOString(), recipes }),
        ContentType: 'application/json',
      }),
    );
  }

  // Reconcile category shells: for every (locale, category) pair this rebuild has any knowledge
  // of (i.e. every locale with at least one live recipe, per the known gap documented in this
  // feature's ledger regarding locales that have dropped to zero live recipes), create the
  // shell if the category is live there, or remove it if not (`contracts/public-site-index.md`).
  for (const locale of byLocale.keys()) {
    for (const category of await listCategories()) {
      const slug = slugify(category.displayName);
      const key = `${locale}/categories/${slug}.html`;

      if (liveLocaleCategoryPairs.has(`${locale}::${category.categoryId}`)) {
        const html = await renderCategoryShellPage({ locale, name: category.displayName, slug });
        await s3.send(
          new PutObjectCommand({ Bucket: PUBLIC_BUCKET_NAME, Key: key, Body: html, ContentType: 'text/html' }),
        );
      } else {
        await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET_NAME, Key: key }));
      }
    }
  }
}
