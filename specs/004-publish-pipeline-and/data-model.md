# Phase 1 Data Model: Publish Pipeline and Public Recipe Site

Extends the existing single DynamoDB table (001-recipe-authoring) with publish-related state and
one new item type. No new physical data store is introduced (Principle IV/the constitution's
single-table stance).

## `RECIPE#<id>/META` — extended (existing item, new attributes)

| Field | Type | Notes |
|---|---|---|
| `selectedForNextPublish` | `boolean` | The one-shot toggle (FR-001). Defaults to `false` for every existing and new recipe. Set by `PATCH /recipes/{id}/publish-toggle`; reset to `false` by the pipeline's per-recipe task once it acts on this recipe (FR-005) — never by any other write path. |
| `publishStatus` | `'not_published' \| 'live' \| 'publishing' \| 'unpublishing'` | The current actual public state (FR-008), independent of the toggle above. Defaults to `'not_published'`. Set to `'publishing'`/`'unpublishing'` when a run starts acting on this recipe, then `'live'`/`'not_published'` on that recipe's successful render/removal, or left at its prior value if that recipe's own task fails (FR-010). |

All other `RECIPE#<id>/META` fields (001's `RecipeMeta`) are unchanged.

## `RECIPE#<id>/PUBLISHED#<locale>` — new item type

The published-snapshot record — what the index/category-shell rebuild reads, deliberately
decoupled from the recipe's live draft content (research.md: "Full index/category rebuild, driven
by a snapshot table").

| Field | Type | Notes |
|---|---|---|
| `recipeId` | `string` | |
| `locale` | `string` | One item per locale the recipe was last published in. |
| `title` | `string` | The recipe's name *as actually rendered*, at the moment it was last rendered — not necessarily the current draft name. |
| `slug` | `string` | The URL path segment this locale's recipe page was rendered under. |
| `categoryId` | `string \| null` | The category this recipe was filed under *as actually rendered*. |
| `renderedAt` | `string` (ISO 8601) | When this snapshot was written. |

Written by `pipeline/render-recipe.ts` on a successful render. Deleted by `pipeline/remove-
recipe.ts` on a successful Unpublish for that locale (and, if the recipe is removed entirely, for
every locale it had). Never written or read by any backoffice draft-editing code path — only by
the pipeline and by `rebuild-index.ts`.

## `PIPELINE#STATUS` — new, single item (no per-recipe keying)

The run-lock and status-polling record (FR-009; research.md: "Trigger and status-polling
pattern").

| Field | Type | Notes |
|---|---|---|
| `running` | `boolean` | `true` while a Publish or Unpublish execution is in progress. A new `POST /publish`/`POST /unpublish` call is rejected while this is `true` (FR-009). |
| `executionArn` | `string \| null` | The current (or most recent) Step Functions execution's ARN, used by `GET /publish-status` to call `DescribeExecution`. |
| `action` | `'publish' \| 'unpublish' \| null` | Which action started the current/most recent run, for display. |
| `startedAt` | `string \| null` (ISO 8601) | |
| `lastResult` | `'succeeded' \| 'failed' \| null` | The most recently completed run's outcome, shown until a new run starts. |

Exactly one item of this type ever exists. Read by `GET /publish-status`; written by
`start-publish.ts`/`start-unpublish.ts` (on start) and by the pipeline's final task and its Catch
handler (on completion/failure).

## State transitions

- `selectedForNextPublish`: `false → true` (owner toggles on) → `true → false` (either action
  consumes it, win or lose — a failed per-recipe task still resets the toggle, since the owner must
  re-toggle to retry, per FR-005's "once that action completes" scope being the whole run, not a
  silent retry).
- `publishStatus`: `not_published → publishing → live` (successful Publish) or
  `live → unpublishing → not_published` (successful Unpublish). A per-recipe task failure leaves
  `publishStatus` at whatever it was immediately before that task ran (FR-010) — it does not get
  stuck in `publishing`/`unpublishing`, since the per-recipe task's own failure handler reverts it.
- `PIPELINE#STATUS.running`: `false → true` (an action starts a run) → `true → false` (the
  pipeline's final task or its top-level Catch handler completes).

## Validation rules

- FR-009: `start-publish.ts`/`start-unpublish.ts` MUST reject the call (without starting a new
  execution) if `PIPELINE#STATUS.running` is already `true`.
- FR-002/FR-003/FR-004: the recipe set a run acts on is fixed at the moment `StartExecution` is
  called — a toggle changed by the owner *after* a run has started does not affect that
  already-running run (it only affects the next one).
- Rendering a recipe with no content in a given locale never produces a `PUBLISHED#<locale>` item
  or page for that locale (FR-015) — the per-recipe render task iterates only over the locales the
  recipe actually has `RecipeLocaleContent` for.
