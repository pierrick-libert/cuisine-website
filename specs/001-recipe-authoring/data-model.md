# Phase 1 Data Model: Recipe Authoring

Single DynamoDB table (shared with other features per the constitution), partition/sort key
(`PK`/`SK`) design, no secondary indexes. All ids are ULIDs.

## Recipe — metadata item

| Field | Type | Notes |
|---|---|---|
| `PK` | string | `RECIPE#<recipeId>` |
| `SK` | string | `META` |
| `recipeId` | string (ULID) | Generated on create; immutable. |
| `status` | string | Always `"draft"` for this feature (publishing is a later feature). |
| `categoryId` | string \| null | References a Category item's canonical id; null until assigned. |
| `tags` | string[] | Free-form, user-entered; no normalization beyond trimming. |
| `ingredientGroups` | array | See **Ingredient Group** shape below; ordered array = display order. |
| `stepsOrder` | array\<string\> | Ordered list of step ids; step content itself lives per-locale (FR-009). |
| `createdAt` / `updatedAt` | string (ISO 8601) | Maintained by the repository layer. |

### Ingredient Group (embedded, not a separate item)

```json
{
  "groupId": "ulid",
  "lines": [
    {
      "lineId": "ulid",
      "quantity": 250,
      "unit": "g",
      "approxEquivalent": { "quantity": 16, "unit": "tbsp" }
    }
  ]
}
```

- `unit` and `approxEquivalent` are optional (FR-004, FR-005) — a counted ingredient (e.g.
  "apples") has `unit: null` and no `approxEquivalent`.
- Group and line order is the array order — reordering (FR-012) is just a reorder of these arrays
  on save, no separate `order` field needed.
- Ingredient and step *names/text* are **not** stored here — only structure and quantities, which
  FR-009 requires to be shared (not duplicated) across locales. The group/line carries only
  `groupId`/`lineId` as the stable reference locale content attaches to.

## Recipe — locale content item (one per language the recipe has content for)

| Field | Type | Notes |
|---|---|---|
| `PK` | string | `RECIPE#<recipeId>` |
| `SK` | string | `LOCALE#<lang>` (e.g. `LOCALE#en`) |
| `name` | string | Required (FR-002) — the only field validated as non-empty for save. |
| `description` | string | Optional. |
| `ingredientNames` | map\<lineId, string\> | Translated name for each ingredient line id. |
| `groupNames` | map\<groupId, string\> | Translated name for each ingredient group id. |
| `steps` | map\<stepId, richTextJson\> | Tiptap JSON document per step id, keyed to `stepsOrder`. |

- A recipe is valid with just one `LOCALE#*` item present (FR-014).
- An ingredient line or step that has no entry yet for a given locale renders as empty in that
  locale — this is expected mid-authoring state, not an error (edge case in spec.md).

## Category item

| Field | Type | Notes |
|---|---|---|
| `PK` | string | `CATEGORY#<categoryId>` |
| `SK` | string | `META` |
| `categoryId` | string (ULID) | Canonical id, stable even if the display name is edited later. |
| `normalizedName` | string | Lowercased + trimmed; used to detect an existing category (FR-008). |
| `displayName` | string | Original casing, as entered. |

- "Assign a category" resolves `normalizedName` against existing Category items first; only
  creates a new Category item if no match is found. No category-management UI (listing, rename,
  merge) exists in this feature — see spec.md Assumptions.

## Validation rules (from Functional Requirements)

- A recipe MUST have a non-empty `name` in at least one locale item before it can be saved
  (FR-001, FR-002).
- `quantity` is required on an ingredient line; `unit` and `approxEquivalent` are optional
  (FR-004, FR-005).
- No minimum/maximum count is enforced on groups, lines, or steps — zero is a valid (if
  incomplete) in-progress state (edge cases in spec.md); deleting the last group/locale must still
  leave the recipe in a saveable state (not an error).
- Category matching is case-insensitive via `normalizedName` (FR-008).

## State / lifecycle

This feature has a single state: **draft**. `status` is stored now so that a later publishing
feature can transition it to `published` without a schema migration, but no transition logic is
implemented here.
