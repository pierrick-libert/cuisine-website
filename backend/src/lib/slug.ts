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
