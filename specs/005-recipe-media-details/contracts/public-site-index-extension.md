# Contract Extension: Public Site Output — Media and Serving Details

Extends `specs/004-publish-pipeline-and/contracts/public-site-index.md`. Everything in that
contract is unchanged; this documents only the additions.

## Recipe detail page — new elements

Still one static file per `/<locale>/recipes/<slug>.html`, still rendered once per
`render-recipe.ts` invocation. The rendered HTML now additionally embeds, when set on the recipe:

- A hero `<img>` for `coverImageUrl`, placed between the hero text block and the two-column body
  (matching `mockups/Main.dc.html`'s layout) — entirely omitted (no element at all) when
  `coverImageUrl` is `null`.
- A "Prep X min · Bake Y min" line and a "Serves N" indicator next to the category badge —
  omitted, field by field, for whichever of `prepMinutes`/`cookMinutes`/`baseServings` is `null`.
- When `baseServings` is set: each ingredient line is rendered with its quantity/unit/
  approxEquivalent as structured data an inline Alpine component
  (`public-site/assets/recipe.js`'s `recipeDetail()`) reads to drive the servings stepper — see
  data-model.md. When `baseServings` is `null`, ingredient lines render exactly as they did under
  004 (static text, no stepper, no embedded structured data needed beyond what's already shown).

This remains fully static HTML with no interactivity beyond what the embedded Alpine component
provides entirely client-side (Principle II) — the file served to a visitor never changes between
servings selections; only the DOM, in the visitor's own browser, does.

## Browse/search index — `browse-index.json` entry additions

```json
{
  "generatedAt": "2026-10-20T10:04:30Z",
  "recipes": [
    {
      "recipeId": "r-123",
      "slug": "grandmas-apple-tart",
      "title": "Grandma's Apple Tart",
      "categoryId": "c-45",
      "categorySlug": "desserts",
      "coverImageUrl": "https://clp-cuisine-website-images.s3.eu-central-1.amazonaws.com/01m....jpg"
    }
  ]
}
```

- `coverImageUrl` is `null` when the recipe has none — `public-site/assets/browse.js`'s recipe-card
  rendering (consumed by `category-shell.njk` and `home.njk`) must render the card without an
  `<img>` element at all when `null`, not a broken-image icon or placeholder box (FR-005).
- Sourced from the published snapshot (data-model.md), identically to every other field already in
  this index — never from live draft data (unchanged 004 guarantee, FR-004).

## What this extension explicitly does not cover

- Image resizing, multiple sizes/breakpoints, or a CDN image-transformation pipeline — the cover
  image is served exactly as uploaded, at whatever resolution the owner's file happens to be
  (consistent with 002's images-api.md, which already explicitly excludes resizing).
- Any metric/imperial unit data in the index or detail page — explicitly out of scope (FR-010).
