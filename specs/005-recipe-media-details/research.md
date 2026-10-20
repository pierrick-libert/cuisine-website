# Phase 0 Research: Recipe Media and Serving Details

## Cover image upload: no existing frontend caller, only an existing backend contract

**Decision**: Build a new `CoverImageUpload.tsx` component and `frontend/src/services/imagesApi.ts`
that call `POST /images` (built in 002, `contracts/images-api.md`) directly, then `PUT` the file to
the returned presigned URL, then store the returned `imageUrl` on the recipe via the existing
`PUT /recipes/{id}` call (extended with the new field).

**Rationale**: Confirmed by reading `StepsEditor.tsx` — its image toolbar button only does
`window.prompt('Image URL')` and inserts by URL; the comment there explicitly says "Image upload
infrastructure is out of this feature's scope ... insert by URL in the meantime." So `POST /images`
is a real, deployed, Cognito-authenticated route with zero frontend callers anywhere in the
codebase today. This feature is the "later feature" the images-api.md contract already names as
out of its own scope ("Associating an uploaded image with a specific recipe — a later feature").

**Alternatives considered**: Wiring cover-image upload through the same rich-text editor used for
steps — rejected, a cover image is a single recipe-level field, not inline rich-text content: it
needs its own small upload control (pick file → upload → preview → save URL), not a Tiptap node.

## Where the four new fields live in the data model

**Decision**: All four (prepMinutes, cookMinutes, baseServings, coverImageUrl) are added to
`RecipeMeta` (the `RECIPE#<id>/META` item), as optional (`| null`) fields, exactly like
`categoryId` already is — never per-locale.

**Rationale**: None of the four is translatable text; they describe the recipe itself regardless
of which locale is being viewed, matching 001's existing split of structural/quantitative data
(`RecipeMeta`) from translatable text (`RecipeLocaleContent`). Putting them on `RecipeMeta` means
the backoffice's locale tabs (`LocaleTabs.tsx`) don't need to change at all — these fields are
edited once, not per-locale.

**Alternatives considered**: Per-locale fields (e.g. a locale-specific cover image or time) —
explicitly rejected during scoping (locked decision: one shared cover image; time/servings are
also inherently not locale-specific, a recipe doesn't bake faster in French).

## Servings scaling: client-side arithmetic over embedded data, no new network request

**Decision**: `renderRecipePage` embeds each ingredient line's `{ quantity, unit, approxEquivalent
}` as structured data (JSON, inlined into the page, e.g. via an Alpine `x-data` object built from
server-rendered values) rather than the current flattened `"12 potato potatoes"` string. A new
`public-site/assets/recipe.js` Alpine component (`recipeDetail(baseServings, ingredientLines)`)
holds a `servings` state initialized to `baseServings`, and a computed/derived display quantity per
line: `scaled = quantity * (servings / baseServings)`, formatted via `fmt()` (round to 1 decimal,
drop trailing `.0`) — the exact approach already prototyped in the approved mockup's
`Component.fmt()`/`renderVals()`.

**Rationale**: Principle II requires this to be client-side JS over already-embedded data, with no
server round-trip — matches `browse.js`'s existing pattern of fetching/filtering
`browse-index.json` client-side rather than hitting an API. Reusing one shared rounding rule
(`fmt()`) for both the main quantity and its `approxEquivalent` keeps the display logic in one
place.

**Alternatives considered**: Server-rendering every possible servings count ahead of time (e.g.
static pages for servings 1-12) — rejected as wasteful (N pages per recipe for no reason) and
contrary to Principle II's explicit client-side-scaling guidance. Doing the scaling math in Nunjucks
at render time (publish-time, not visitor-time) — rejected, since it would only produce the one
`baseServings` value's numbers; the whole point is the visitor changing it live.

## Rendering `approxEquivalent`: completing a gap left by 001, not new scope

**Decision**: `formatIngredientLine`'s replacement (structured data, not a flattened string) also
carries `approxEquivalent` through to the public-site render data and template, displayed as a
secondary, smaller line under the primary quantity (matching the mockup's "≈ 16 tbsp" styling),
scaled by the same servings multiplier.

**Rationale**: `ApproxEquivalent` has existed on `IngredientLine` since 001 specifically "to
support servings scaling, metric/imperial conversion, and approximate-measure suggestions"
(constitution Principle VII) but `render-recipe.ts`'s `formatIngredientLine` has silently ignored
it since 004 shipped. Since this feature is already restructuring that exact code path to support
scaling, finishing this pre-existing gap is a natural, low-cost inclusion rather than new scope —
and the approved mockup explicitly shows it.

**Alternatives considered**: Leaving `approxEquivalent` unrendered, as a separate future feature —
rejected; it would mean touching this same ingredient-rendering code a third time (001 modeled it,
005 restructures it for scaling, a hypothetical 006 would render it) for data that already exists
and is already shown in the approved design.

## Cover image thumbnails on recipe cards: extending the 004 browse index, not a second index

**Decision**: `BrowseIndexEntry` (in `rebuild-index.ts`) and `PublishedSnapshot` (the 004 entity
the index is built from) both gain an optional `coverImageUrl` field, populated by
`render-recipe.ts` from the recipe's `RecipeMeta.coverImageUrl` at render time, same as every other
snapshot field.

**Rationale**: Matches 004's existing design exactly (`research.md`'s "Full index/category
rebuild, driven by a snapshot table, not live draft data") — the browse index and category/home
pages must never show content ahead of what the snapshot (and therefore the rendered recipe page)
actually has, so the cover image must flow through the same snapshot, not be looked up separately
from live draft data at rebuild time.

**Alternatives considered**: Looking up each recipe's current `coverImageUrl` from live draft data
during `rebuildIndex()` — rejected, this is exactly the drift bug 004's research.md already
identified and avoided for title/category; the same reasoning applies unchanged to a cover image.

## No new AWS infrastructure needed

**Decision**: No change to `infra/storage.ts`, `infra/pipeline.ts`, or `infra/api.ts` beyond what
004 already provisions — `clp-cuisine-website-images` is already `access: 'public'` (002) and
`POST /images` is already a deployed route (002); `PUT /recipes/{id}` already exists and only needs
its request/response shape extended, not a new route.

**Rationale**: Confirmed by reading `infra/storage.ts` directly — the images bucket's access mode
was already set to `'public'` specifically so `imageUrl` "is a plain, directly-retrievable
address," anticipating exactly this kind of later consumer.

**Alternatives considered**: None — this is a direct reuse of already-provisioned infrastructure,
not a design decision with real alternatives.
