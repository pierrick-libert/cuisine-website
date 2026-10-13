# Contract: Recipes API (Backoffice)

Base path: `/recipes` on the backoffice API Gateway HTTP API. All routes require the backoffice's
Cognito-authenticated session (authorizer setup is a separate concern, not part of this feature's
tasks — see spec.md Assumptions). All request/response bodies are JSON.

## `POST /recipes`

Create a new draft recipe.

**Request body**:

```json
{
  "locale": "en",
  "name": "Grandma's Apple Tart",
  "description": "",
  "ingredientGroups": [],
  "steps": []
}
```

- `locale` + `name` are the only required fields (FR-001, FR-002); an empty/missing `name` → `400`.
- `ingredientGroups` and `steps` may be empty arrays (FR-010 — partial drafts are valid).

**Response** `201`: the created recipe, in the shape of `GET /recipes/{id}` below.

## `GET /recipes`

List all draft recipes (for the backoffice recipe list view). Implemented as a full table scan
grouped in memory per the constitution (Principle IV) — no pagination needed at this feature's
scale.

**Response** `200`:

```json
{ "recipes": [{ "recipeId": "...", "name": "...", "categoryId": "...", "tags": ["..."] }] }
```

- `name` here is resolved from a default/first-available locale for display purposes only.

## `GET /recipes/{id}`

Fetch one recipe with all of its locale content.

**Response** `200`:

```json
{
  "recipeId": "...",
  "status": "draft",
  "categoryId": "...",
  "categoryName": "Dessert",
  "tags": ["apple", "autumn"],
  "ingredientGroups": [
    {
      "groupId": "...",
      "lines": [{ "lineId": "...", "quantity": 250, "unit": "g", "approxEquivalent": { "quantity": 16, "unit": "tbsp" } }]
    }
  ],
  "stepsOrder": ["step-1", "step-2"],
  "locales": {
    "en": {
      "name": "Grandma's Apple Tart",
      "description": "...",
      "groupNames": { "...": "For the dough" },
      "ingredientNames": { "...": "all-purpose flour" },
      "steps": { "step-1": { "type": "doc", "content": [] } }
    }
  }
}
```

- `categoryName` is resolved from `categoryId` for display — `null` if the recipe has no category.

**Response** `404`: recipe does not exist.

## `PUT /recipes/{id}`

Update a recipe's structure and/or one locale's content in a single call (the backoffice SPA saves
the whole editor state at once, per FR-010's "save at any point" requirement — there is no partial
PATCH).

**Request body**: same shape as `GET /recipes/{id}`'s response, minus `recipeId`/`status`, with
exactly one locale's content under `locales` for this call (the SPA sends the locale tab currently
being edited; other locales are untouched server-side).

**Validation**:

- The non-empty-`name` rule (FR-002) applies to whichever locale is included in the request body
  if it is the recipe's only locale; a locale may not be removed if it is the last one carrying
  content, to keep edge-case "deleting the last locale" from leaving an invalid recipe (spec.md
  Edge Cases) — this constraint must be enforced server-side, not just assumed from the UI.
- Category resolution (new-or-existing, case-insensitive) happens here if `categoryId` is replaced
  by a new category name (see data-model.md Category item).

**Response** `200`: the updated recipe, same shape as `GET /recipes/{id}`.
**Response** `400`: validation failure (e.g. empty name on the only locale).
**Response** `404`: recipe does not exist.

## `DELETE /recipes/{id}`

Delete an entire draft recipe (FR-013).

**Response** `204`. **Response** `404`: recipe does not exist.

## Out of scope for this contract

- Any `/recipes/{id}/publish` route — publishing is a separate, later feature.
- Any AI-assist route (translation draft, approximate-measure suggestion) — separate, later
  feature; the fields they would populate (`approxEquivalent`, additional `locales` entries) are
  already in this shape so they can be added without a breaking schema change.
- Category list/rename/merge routes — not part of this feature (spec.md Assumptions).
