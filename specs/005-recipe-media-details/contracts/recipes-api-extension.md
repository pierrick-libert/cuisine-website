# Contract Extension: Recipes API — Media and Serving Details

Extends `specs/001-recipe-authoring/contracts/recipes-api.md`'s `POST`/`GET`/`PUT /recipes/{id}`
shapes. Everything in the base contract is unchanged; this documents only the additions.

## `POST /recipes`, `PUT /recipes/{id}` — request body additions

```json
{
  "locale": "en",
  "name": "Grandma's Apple Tart",
  "prepMinutes": 25,
  "cookMinutes": 45,
  "baseServings": 6,
  "coverImageUrl": "https://clp-cuisine-website-images.s3.eu-central-1.amazonaws.com/01m....jpg"
}
```

- `prepMinutes`, `cookMinutes`, `baseServings`, `coverImageUrl` are all optional. Omitted on
  create → `null`. Omitted on update → left unchanged (same "omitted means unchanged" rule the base
  contract already applies to `categoryName`, not reset to `null` — a `PUT` must send an explicit
  `null` to clear one of these fields, matching the spec's Edge Cases on clearing a field).
- `prepMinutes`/`cookMinutes`/`baseServings`, when present and not `null`, MUST be a positive
  integer — otherwise `400`.
- `coverImageUrl`, when present and not `null`, MUST be a non-empty string (no deeper validation —
  this project has no way to verify the URL actually points at a real object without fetching it,
  and the images bucket is the only writer of real URLs the backoffice UI ever produces).
- These four fields are recipe-level, not per-locale — unlike `name`/`description`, they are not
  nested under a particular locale's content and are unaffected by which locale tab is being saved.

## `GET /recipes/{id}`, and `POST`/`PUT`'s `201`/`200` response — response body additions

```json
{
  "recipeId": "...",
  "prepMinutes": 25,
  "cookMinutes": 45,
  "baseServings": 6,
  "coverImageUrl": "https://clp-cuisine-website-images.s3.eu-central-1.amazonaws.com/01m....jpg"
}
```

- All four present, `null` when unset — never omitted from the response (unlike the request body's
  "omitted means unchanged" rule, which only applies to writes).

## `GET /recipes` (list) — unchanged

The list view's summary row does not gain these fields — the backoffice recipe list doesn't need a
thumbnail or time preview; only the single-recipe editor does.

## Image upload (`POST /images`, 002's contract) — unchanged

No change to `contracts/images-api.md` itself. This feature is the first real caller: the
backoffice calls `POST /images`, `PUT`s the file to the returned `uploadUrl`, then sends the
returned `imageUrl` as `coverImageUrl` in a normal `PUT /recipes/{id}` call — three separate calls,
no new combined endpoint.
