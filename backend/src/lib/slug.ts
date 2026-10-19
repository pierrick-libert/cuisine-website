/**
 * Converts text into a URL-safe slug: lowercased, accents stripped, non-alphanumeric runs
 * collapsed to a single hyphen, leading/trailing hyphens trimmed.
 *
 * @remarks
 * Used for category and recipe detail page URL path segments (004-publish-pipeline-and's
 * `contracts/public-site-index.md`).
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a recipe's public URL slug: `slugify(name)` plus a short, lowercased suffix derived
 * from the recipe's id.
 *
 * @remarks
 * Two recipes can slugify to the same name (e.g. two "Pancakes", or "Crème brûlée" vs. "Creme
 * brulee") — without a per-recipe suffix they'd silently overwrite each other's rendered page.
 * The slug (prefix and suffix both) can still change on rename — `render-recipe.ts` detects that
 * by comparing against the recipe's previous published snapshot (keyed by recipe id, not slug)
 * and deletes the old page rather than leaving it orphaned.
 */
export function recipeSlug(name: string, recipeId: string): string {
  const suffix = recipeId.slice(-6).toLowerCase();
  const base = slugify(name);
  return base ? `${base}-${suffix}` : suffix;
}
