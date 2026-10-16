# Contract: Public Site Output (Static Files)

The public site at `cuisine.libertpierrick.com` has no backend API (Principle II/III) — this
documents the *file shape* the pipeline writes to the public S3 bucket and that the client-side
Alpine.js browse/search script and the Eleventy category-shell templates consume. This is the
contract between `backend/src/pipeline/*` (the producer) and `public-site/assets/browse.js` +
`public-site/templates/*` (the consumers).

## Recipe detail page

Path: `/<locale>/recipes/<slug>.html` (e.g. `/en/recipes/grandmas-apple-tart.html`). One file per
locale a recipe is published in (FR-015 — never written for a locale the recipe has no content
for). Static HTML, rendered once per `render-recipe.ts` invocation; no interactivity beyond what a
later feature adds (spec.md Assumptions).

## Category shell page

Path: `/<locale>/categories/<category-slug>.html`. One per locale/category pair that has at least
one currently-live recipe. The shell itself is largely static chrome; it fetches
`browse-index.json` (below) client-side and filters to its own category + locale, per the
constitution's client-side-interactivity stance — it is not re-rendered with an embedded recipe
list on every run, only reconciled (created/removed) when a category's live membership changes to/
from zero.

## Browse/search index

Path: `/<locale>/browse-index.json`. One file per locale. Rebuilt in full on every pipeline run,
from the published-snapshot table only (data-model.md, research.md) — never from live draft data.

```json
{
  "generatedAt": "2026-10-16T10:04:30Z",
  "recipes": [
    {
      "recipeId": "r-123",
      "slug": "grandmas-apple-tart",
      "title": "Grandma's Apple Tart",
      "categoryId": "c-45",
      "categorySlug": "desserts"
    }
  ]
}
```

- Contains exactly the recipes with a `publishStatus === 'live'` **and** a
  `RECIPE#<id>/PUBLISHED#<locale>` snapshot item for this locale — the same set, by construction,
  as the detail pages actually present under `/<locale>/recipes/`.
- `title`, `categoryId`, `categorySlug` are the snapshot's values (what was actually rendered),
  never the recipe's current draft values (FR-013/SC-008).
- Consumed entirely client-side by `public-site/assets/browse.js` for search/filter/pagination
  (FR-012) — no server-side query of this file ever happens.

## What this contract explicitly does not cover

- Any endpoint for a visitor to trigger or observe a publish run — the public site is read-only
  static content; `publish-api.md` is backoffice-only.
- Image files — recipe images are served from the existing 002 images bucket/URL scheme,
  referenced by detail pages but not produced by this pipeline.
- A combined, all-locale index file — each locale's `browse-index.json` is independent, matching
  how category slugs and recipe slugs are already localized per-locale (constitution Principle
  VI).
