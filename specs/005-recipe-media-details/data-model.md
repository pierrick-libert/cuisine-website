# Phase 1 Data Model: Recipe Media and Serving Details

## `RecipeMeta` (extended)

The `RECIPE#<id>/META` DynamoDB item (`backend/src/domain/types.ts`) gains four new optional
fields, alongside the existing `categoryId`:

| Field | Type | Constraint | Notes |
|---|---|---|---|
| `prepMinutes` | `number \| null` | positive integer when set | Preparation time, recipe-level (FR-001) |
| `cookMinutes` | `number \| null` | positive integer when set | Cook/bake time, recipe-level (FR-001) |
| `baseServings` | `number \| null` | positive integer when set | The servings count the authored ingredient quantities are *for* — the scaling multiplier's denominator (FR-001, FR-006) |
| `coverImageUrl` | `string \| null` | a `https://` URL pointing at the images bucket when set | FR-002 |

All four default to `null` for every recipe created before this feature (and for any new recipe
that doesn't set them) — `withPublishDefaults()`-style backward compatibility, matching 004's
pattern for its own additive fields (FR-009).

None of the four is added to `RecipeLocaleContent` — they are not translatable text (see
research.md).

## `PublishedSnapshot` (extended, from 004)

The `RECIPE#<id>/PUBLISHED#<locale>` item gains:

| Field | Type | Notes |
|---|---|---|
| `coverImageUrl` | `string \| null` | Copied from `RecipeMeta.coverImageUrl` at render time (`render-recipe.ts`), same as `title`/`categoryId` already are — never read live from draft data at rebuild time (FR-004, research.md). |

`prepMinutes`/`cookMinutes`/`baseServings` are **not** added to the snapshot — they only affect the
recipe detail page itself (rendered directly from draft data at render time, like every other
recipe-detail field already is), not the browse index, which only needs enough to render a card
(title, slug, category, and now a thumbnail).

## `IngredientLine` (unchanged structure, newly fully consumed)

No schema change — `quantity: number`, `unit: string | null`, `approxEquivalent:
{quantity, unit} | null` already exist (001). This feature is the first to actually read
`approxEquivalent` all the way through to the rendered page.

## Public-site render data (`public-site/src/render.ts`)

`RecipeRenderData.ingredientGroups` changes shape — from a pre-flattened display string to
structured data the client can scale:

```ts
// Before (004):
ingredientGroups: Array<{ name: string | null; lines: Array<{ text: string }> }>;

// After (005):
ingredientGroups: Array<{
  name: string | null;
  lines: Array<{
    quantity: number;
    unit: string | null;
    name: string;
    approxEquivalent: { quantity: number; unit: string } | null;
  }>;
}>;
```

`RecipeRenderData` additionally gains:

```ts
prepMinutes: number | null;
cookMinutes: number | null;
baseServings: number | null;
coverImageUrl: string | null;
```

`HomePageRenderData.categories` and `CategoryShellRenderData.categories`/recipe-card entries
(sourced from `browse-index.json`'s per-recipe entries at browse.js's filter layer, not from the
Eleventy render-data interfaces themselves) gain `coverImageUrl` alongside the existing
`categorySlug` on the browse-index entry — see the index contract below.

## Backoffice request/response shape (`PUT`/`POST /recipes/{id}`, 001's contract extended)

See `contracts/recipes-api-extension.md` for the full before/after body.

## Browse/search index entry (004's contract extended)

See `contracts/public-site-index-extension.md` for the full before/after `browse-index.json` shape.
