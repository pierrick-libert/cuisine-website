# Phase 1 Data Model: Translation Drafting

This feature introduces **no new persisted entity** and makes **no change** to the existing
recipe/category DynamoDB schema from 001-recipe-authoring. Per spec.md's Key Entities, a
"translation draft" is explicitly not a stored thing — it exists only as the response of one
request/response cycle and as in-browser editor state until the owner separately saves it (at
which point it becomes ordinary, already-modeled English `RecipeLocaleContent`, per 001's
data-model.md — no new field or status is added to that shape).

## Translate request/response shape

Both the request and the response use the same shape — translation substitutes values in place,
nothing is added or removed from the structure.

| Field | Type | Notes |
|---|---|---|
| `sourceLocale` | `string` (request only) | e.g. `"fr"`. Not locale-validated beyond being a non-empty string — this endpoint is locale-agnostic; the frontend is what currently only ever sends `"fr"`. |
| `targetLocale` | `string` (request only) | e.g. `"en"`. Same as above. |
| `name` | `string` | The recipe name. Required (FR-006 — a request with an empty/missing `name` is `400`). |
| `description` | `string` | May be empty. |
| `groupNames` | `Record<string, string>` | Keyed by `IngredientGroup.groupId` (001's data-model.md) — same keys in the response as in the request, only values translated. |
| `ingredientNames` | `Record<string, string>` | Keyed by `IngredientLine.lineId` — same keying as above. |
| `steps` | `Record<string, TiptapDoc>` | Keyed by step id (001's `stepsOrder` entries). Each value is a full Tiptap/ProseMirror JSON document; the response's document for a given key has the identical structure to the request's — only text-node `text` values differ. |

## Internal shape: the flattened translation unit (not part of the API contract)

Used only inside the handler, to go from "the request above" to "one ordered array of strings for
one Claude call" and back. Not serialized anywhere, not returned to the frontend — purely an
implementation detail of `rich-text-translation.ts`, documented here because it is the crux of the
formatting-preservation guarantee (FR-002/SC-002).

| Concept | Shape | Notes |
|---|---|---|
| Extracted text list | `string[]` | Built by walking the request in a fixed order: `name`, `description`, then each `groupNames` value (stable key order), then each `ingredientNames` value (stable key order), then each step's Tiptap document's text nodes in document traversal order. |
| Reinsertion | same original structures, text swapped | The response is built by replacing each entry above with the translated string at the same index, in the same order — the plain-string fields get a 1:1 swap; each step's document is rebuilt by walking its *original* tree again and substituting each text node's `text` field, leaving `type`, `marks`, `attrs`, and child ordering completely unchanged. |

## Validation rules (from Functional Requirements)

- FR-006: `name` must be a non-empty string — `400` otherwise, mirroring 001's existing
  `assertNonEmptyName` check on `POST`/`PUT /recipes`.
- FR-002/SC-002 (formatting preservation) and FR-007 (fail clearly, never corrupt): the count of
  strings Claude returns MUST exactly match the count sent — a mismatch is treated as a hard
  failure (the handler returns an error; it never attempts a partial or best-guess reinsertion).
