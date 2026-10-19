# Pierrick's Sunday Kitchen — Public Site

Eleventy templates and client-side assets for the public recipe site at
`cuisine.libertpierrick.com`. Not an app the owner interacts with directly, and not built at
`sst deploy` time — its templates are invoked programmatically, one recipe or category at a time,
by `backend/src/pipeline/render-recipe.ts` and `backend/src/pipeline/rebuild-index.ts` whenever
the owner clicks "Publish"/"Unpublish" in the backoffice. See
[`../specs/004-publish-pipeline-and/`](../specs/004-publish-pipeline-and/) for the spec and plan.

## Setup

```bash
npm install
```

## Test

```bash
npm run typecheck
npm run lint
npm test   # real @11ty/eleventy invocations against templates/ — not mocked
```

## Layout

- `templates/recipe-detail.njk` — one recipe's detail page, per locale
- `templates/category-shell.njk` — mostly-static chrome per category/locale; the actual recipe
  listing is fetched and filtered client-side by `assets/browse.js`, never re-rendered per recipe
- `assets/browse.js` — Alpine.js component powering client-side browse/search/filter over
  `browse-index.json` (`contracts/public-site-index.md`) — loaded as a plain `<script>`, not a
  module, so it's a global before Alpine (deferred) evaluates `x-data`
- `src/render.ts` — drives Eleventy's programmatic `toJSON()` API to render one template with
  one recipe's or category's data in memory, without writing to disk — the caller uploads the
  returned HTML to S3 itself
- `src/render-rich-text.ts` — a small, hand-written Tiptap-JSON-to-HTML renderer, deliberately
  bounded to the exact node/mark types `frontend/src/components/StepsEditor.tsx`'s toolbar exposes
  (bold, italic, bullet list, image) rather than depending on the full `@tiptap/html` renderer
