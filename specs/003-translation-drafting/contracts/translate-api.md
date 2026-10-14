# Contract: Translation (Backoffice)

Base path: `/translate` on the backoffice API Gateway HTTP API. Requires authentication — same
Cognito JWT authorizer as every other route (`contracts/auth.md` from 002-deploy-infrastructure).
All request/response bodies are JSON.

## `POST /translate`

Translates a recipe's text content from one locale to another. Stateless — takes no `recipeId` and
never reads or writes the database; the frontend sends whatever is currently in its own editor
state.

**Request body**:

```json
{
  "sourceLocale": "fr",
  "targetLocale": "en",
  "name": "Tarte aux pommes de grand-mère",
  "description": "Une tarte classique.",
  "groupNames": { "g1": "Pour la pâte" },
  "ingredientNames": { "l1": "farine" },
  "steps": {
    "s1": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Mélanger la farine et le beurre." }] }] }
  }
}
```

- `sourceLocale` and `targetLocale` MUST be non-empty strings; the endpoint itself does not
  validate them against a known locale list — it is locale-agnostic (data-model.md).
- `name` MUST be non-empty → `400` otherwise.
- `description`, `groupNames`, `ingredientNames`, and `steps` may be empty (`""`, `{}`).

**Response** `200`:

```json
{
  "name": "Grandma's Apple Tart",
  "description": "A classic tart.",
  "groupNames": { "g1": "For the dough" },
  "ingredientNames": { "l1": "flour" },
  "steps": {
    "s1": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Mix the flour and butter." }] }] }
  }
}
```

- Same shape as the request (minus `sourceLocale`/`targetLocale`), with every text value
  translated. Every Tiptap document's non-text structure (node types, `marks`, `attrs`, child
  ordering — including `image` nodes and `bulletList`/`listItem` nesting) is identical to what was
  sent; only `text` values inside `{type: "text", ...}` nodes differ (FR-002).

**Response** `400`: `name` missing or empty — `{ "message": "Recipe name is required." }` (mirrors
`contracts/recipes-api.md`'s existing validation message style from 001).

**Response** `502`: the translation could not be completed — either the Anthropic API call itself
failed (rate limit, timeout, outage) or its response didn't satisfy the one hard invariant this
endpoint enforces (the translated-string count must exactly match what was sent). Example:
`{ "message": "Could not generate a translation. Please try again." }`. The frontend's existing
French content (and any existing English content) is never touched by a failed call — this
endpoint doesn't persist anything in the first place, so there is nothing to roll back.

## What this contract explicitly does not cover

- Any recipe-id-scoped operation, or persisting the translated result — the frontend's existing
  `PUT /recipes/{id}` (001) is what the owner uses afterward if they choose to save the draft.
- Locale pairs other than `fr`→`en` — the endpoint accepts arbitrary `sourceLocale`/`targetLocale`
  strings, but no UI exists yet to request anything other than `fr`→`en` (spec.md Assumptions).
- Any bulk/multi-recipe translation — one request always covers exactly one recipe's content.
