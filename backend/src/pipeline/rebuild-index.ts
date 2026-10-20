import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listPublishedSnapshots } from '../repository/publish-repository.js';
import { getCategoryById, listCategories } from '../repository/category-repository.js';
import { slugify } from '../lib/slug.js';
import { SUPPORTED_LOCALES } from '../lib/locales.js';
import { renderCategoryShellPage, renderHomePage, type LocaleLink } from '../../../public-site/src/render.js';
import type { PublishedSnapshot } from '../domain/types.js';

// Categories are not yet per-locale (see resolveCategorySlug's comment below), so a category or
// home page's locale switcher is just the same slug under a different locale segment — no
// per-locale existence check needed, unlike a recipe page's locale switcher.
function localeLinksFor(path: (locale: string) => string): LocaleLink[] {
  return SUPPORTED_LOCALES.map((locale) => ({ locale, label: locale.toUpperCase(), href: path(locale) }));
}

const s3 = new S3Client({});
const PUBLIC_BUCKET_NAME = process.env.PUBLIC_BUCKET_NAME ?? 'clp-cuisine-website-public';

// Named currentDir, not __dirname — see public-site/src/render.ts's comment on the exact same
// esbuild/Node-ESM collision this avoids.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
// Same LAMBDA_TASK_ROOT-aware resolution as public-site/src/render.ts's TEMPLATES_DIR — this
// file lives alongside render.ts in the same esbuild bundle (infra/pipeline.ts's copyFiles
// copies public-site/templates AND must also carry assets/, see that file's comment).
const ASSETS_DIR = process.env.LAMBDA_TASK_ROOT
  ? path.join(process.env.LAMBDA_TASK_ROOT, 'assets')
  : path.join(currentDir, '..', '..', '..', 'public-site', 'assets');

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
 * Uploads the public site's static client-side assets (the Alpine.js browse/search logic and
 * the shared stylesheet) on every run — neither is ever otherwise deployed (no build step writes
 * to the public bucket; see `public-site/assets/browse.js`'s own comment on why it's a plain
 * script, not a module).
 */
async function uploadStaticAssets(): Promise<void> {
  const browseJs = readFileSync(path.join(ASSETS_DIR, 'browse.js'), 'utf-8');
  await s3.send(
    new PutObjectCommand({
      Bucket: PUBLIC_BUCKET_NAME,
      Key: 'assets/browse.js',
      Body: browseJs,
      ContentType: 'application/javascript',
    }),
  );

  const styleCss = readFileSync(path.join(ASSETS_DIR, 'style.css'), 'utf-8');
  await s3.send(
    new PutObjectCommand({
      Bucket: PUBLIC_BUCKET_NAME,
      Key: 'assets/style.css',
      Body: styleCss,
      ContentType: 'text/css',
    }),
  );
}

/**
 * Rebuilds the full browse/search index and category shells for every supported locale
 * (SUPPORTED_LOCALES, plus any locale a snapshot happens to exist in), built exclusively from
 * the published-snapshot table (FR-013, SC-008, `contracts/public-site-index.md`) — never from
 * live draft recipe data, so it can never show content ahead of what is actually rendered on the
 * public site.
 */
export async function rebuildIndex(): Promise<void> {
  await uploadStaticAssets();

  // A recipe only ever has a published-snapshot item for a locale it is actually live in —
  // render-recipe.ts rolls back any locale it wrote during a failed attempt (Important 13 from
  // code review), so "a snapshot exists" and "publishStatus is live" never disagree. This keeps
  // the index built exclusively from the snapshot table, never needing to cross-reference live
  // recipe state (FR-013, research.md).
  const snapshots = await listPublishedSnapshots();
  const byLocale = groupByLocale(snapshots);
  // Every SUPPORTED_LOCALES entry gets an index/shell pass even with zero live recipes, so a
  // locale that just dropped to zero doesn't keep showing its last-generated (now entirely
  // stale) index and category shells forever (Important 11 from code review).
  const localesToRebuild = new Set([...SUPPORTED_LOCALES, ...byLocale.keys()]);
  const categorySlugCache = new Map<string, string | null>();
  // Which (locale, categoryId) pairs currently have at least one live recipe — drives category
  // shell reconciliation below.
  const liveLocaleCategoryPairs = new Set<string>();

  for (const locale of localesToRebuild) {
    const localeSnapshots = byLocale.get(locale) ?? [];
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

  // Reconcile category shells for the same locale set as the index above — create the shell if
  // the category is live there, or remove it if not (`contracts/public-site-index.md`) — and
  // collect each locale's live categories for its home page (Important 15: a public-site entry
  // point, since nothing previously linked to a category shell or recipe page without already
  // knowing its direct URL).
  const allCategories = await listCategories();
  for (const locale of localesToRebuild) {
    // Computed up front, not accumulated during the shell-render loop below, so every shell's
    // cross-category nav (not just categories rendered before it) can link every live category.
    const liveCategoriesThisLocale = allCategories
      .filter((category) => liveLocaleCategoryPairs.has(`${locale}::${category.categoryId}`))
      .map((category) => ({ name: category.displayName, slug: slugify(category.displayName) }));

    for (const category of allCategories) {
      const slug = slugify(category.displayName);
      const key = `${locale}/categories/${slug}.html`;

      if (liveLocaleCategoryPairs.has(`${locale}::${category.categoryId}`)) {
        const html = await renderCategoryShellPage({
          locale,
          name: category.displayName,
          slug,
          locales: localeLinksFor((l) => `/${l}/categories/${slug}.html`),
          categories: liveCategoriesThisLocale,
        });
        await s3.send(
          new PutObjectCommand({ Bucket: PUBLIC_BUCKET_NAME, Key: key, Body: html, ContentType: 'text/html' }),
        );
      } else {
        await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET_NAME, Key: key }));
      }
    }

    const homeHtml = await renderHomePage({
      locale,
      categories: liveCategoriesThisLocale,
      locales: localeLinksFor((l) => `/${l}/index.html`),
    });
    await s3.send(
      new PutObjectCommand({ Bucket: PUBLIC_BUCKET_NAME, Key: `${locale}/index.html`, Body: homeHtml, ContentType: 'text/html' }),
    );
  }
}
