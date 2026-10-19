# Contract: Publish Pipeline (Backoffice)

New routes on the existing backoffice API Gateway HTTP API. Requires authentication — same
Cognito JWT authorizer as every other route (002's `contracts/auth.md`). All request/response
bodies are JSON.

## `PATCH /recipes/{id}/publish-toggle`

Sets the one-shot "included in the next Publish/Unpublish run" toggle for one recipe (FR-001).
Never affects `publishStatus` — this is purely the selection, not an action.

**Request body**:

```json
{ "selected": true }
```

**Response** `200`:

```json
{ "recipeId": "r-123", "selectedForNextPublish": true, "publishStatus": "live" }
```

**Response** `404`: no recipe with that id.

## `POST /publish`

Starts a pipeline run that renders and makes live every recipe currently toggled on
(`selectedForNextPublish === true`), per FR-003. Fire-and-forget — returns immediately; the caller
polls `GET /publish-status` for progress (research.md: "Trigger and status-polling pattern").

**Request body**: none.

**Response** `202`:

```json
{ "executionArn": "arn:aws:states:eu-central-1:...:execution:...", "status": "started" }
```

**Response** `409`: a run is already in progress (FR-009).

```json
{ "message": "A publish or unpublish run is already in progress." }
```

**Response** `200` (nothing to do): no recipe is currently toggled on — no execution is started.

```json
{ "status": "nothing-to-publish" }
```

## `POST /unpublish`

Starts a pipeline run that removes every recipe currently toggled on
(`selectedForNextPublish === true`) from the public site, per FR-004. Same fire-and-forget shape,
`409`, and no-op response as `POST /publish`, with `"status": "started"` /
`"status": "nothing-to-unpublish"`.

## `GET /publish-status`

Returns the current/most recent run's status (FR-008), read from the single `PIPELINE#STATUS`
item plus a live Step Functions `DescribeExecution` call while `running` is `true`.

**Response** `200`:

```json
{
  "running": false,
  "action": "publish",
  "startedAt": "2026-10-16T10:03:00Z",
  "lastResult": "succeeded"
}
```

While a run is in progress, `running: true` and `lastResult: null`; once it completes, `running`
flips back to `false` and `lastResult` reflects that run's outcome.

## Per-recipe status, in the existing recipe listing

`GET /recipes` (001) and `GET /recipes/{id}` (001) gain two fields on each recipe, per FR-008:
`selectedForNextPublish` and `publishStatus` (the exact values from data-model.md's `META` item).
No new route is needed for this — it's an additive field on the existing contracts.

## What this contract explicitly does not cover

- The public site's own HTTP surface — it has none; every page is static (Principle II/III). See
  `public-site-index.md` for the file-shape contract the pipeline writes, not an API.
- Any way to select "all recipes" or "all live recipes" in one call — selection is always via the
  per-recipe toggle (FR-001); there is no bulk-select endpoint.
- Retrying a single failed recipe from a partially-failed run automatically — per data-model.md's
  state transitions, a failed per-recipe task leaves its toggle reset, so the owner re-toggles it
  and clicks Publish/Unpublish again like any other recipe.
