# Implementation Plan: Publish Pipeline and Public Recipe Site

**Branch**: `004-publish-pipeline-and` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-publish-pipeline-and/spec.md`

## Summary

Add a per-recipe publish toggle and two explicit actions — Publish and Unpublish — in the
backoffice, each acting only on currently-toggled recipes and resetting their toggle afterward. A
new Step Functions state machine renders toggled-on recipes (Publish) or removes toggled-on
recipes (Unpublish) as pre-rendered Eleventy static pages in a new public S3+CloudFront site at
`cuisine.libertpierrick.com`, then rebuilds the full browse/search index and category shell pages
from a per-recipe "last-published snapshot" record (never from live draft data, so the index can
never show content ahead of what is actually rendered), then invalidates CloudFront. The existing
backoffice is additionally given its own custom domain, `admin.cuisine.libertpierrick.com`. Both
buttons trigger the pipeline asynchronously (fire-and-forget `StartExecution`) and the backoffice
polls a status endpoint, since a full run can exceed API Gateway's 29-second synchronous limit.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24.x LTS — unchanged from 001/002/003.

**Primary Dependencies**: `@11ty/eleventy` (latest 3.x) for static rendering; `@aws-sdk/client-sfn`
for starting/polling the Step Functions execution from Lambda; `@aws-sdk/client-s3` (already used
by 002's image upload) for writing rendered pages and the index JSON directly to the public
bucket; Alpine.js (via CDN or a small bundled copy, per the constitution) for the public site's
client-side browse/search/filter. No new frontend testing libraries beyond 003's React Testing
Library setup.

**Storage**: Extends the existing single DynamoDB table (001/002) — no new data store. Adds two
new attributes to the `RECIPE#<id>/META` item (`selectedForNextPublish`, `publishStatus`), a new
`RECIPE#<id>/PUBLISHED#<locale>` item type for the published-snapshot record, and a single
`PIPELINE#STATUS` item tracking whether a run is currently in progress and its execution ARN (for
FR-009's single-run-at-a-time guarantee and status polling). The public site's browse/search index
and category shells are plain JSON/HTML files in the public S3 bucket, not a database.

**Testing**: Vitest (existing, both backend and frontend). Eleventy template rendering is unit-
tested against fixture recipe/category data → expected HTML, per the constitution's testing
stance. The render/index/reconcile Lambda logic (recipe → rendered-file mapping, snapshot-table-
driven index assembly) is unit-tested as pure functions wherever extractable from AWS SDK calls;
the actual S3 writes and Step Functions execution are integration-tested against mocked clients,
mirroring 003's pattern of mocking the Anthropic client. No automated test drives a real Step
Functions execution end-to-end (validated manually per quickstart.md).

**Target Platform**: AWS Lambda (Step Functions task states) + a new S3+CloudFront static site,
behind the existing API Gateway HTTP API (same Cognito JWT authorizer) for the two new trigger
routes and the status route — extends 002's infrastructure, no new backend authentication surface
(Principle III).

**Project Type**: Web application — extends the existing `backend/`/`frontend/`/`infra/` layout
with one new top-level project, `public-site/`, holding the Eleventy templates/layouts rendered by
the pipeline (distinct from `frontend/`, which remains the Cognito-authenticated backoffice SPA).

**Performance Goals**: Not latency-sensitive — a publish/unpublish run is an infrequent, deliberate
action (Principle V); a run taking up to a few minutes for the project's expected scale (100-1000
recipes) is acceptable, since the UI reports progress asynchronously rather than blocking.

**Constraints**: Cost Above All (Step Functions Standard workflows and Lambda are pay-per-use; no
fixed-cost resource added); Static-First Public Site (no server-side process serves a public
request — every page, the index, and category shells are pre-rendered files); Explicit Over
Automatic (Publish/Unpublish are the only ways the pipeline runs — no automatic trigger on recipe
save, per FR-002 through FR-005); Simplicity Over Premature Scale (the toggled-recipe query and the
snapshot-table scan for index rebuild use plain DynamoDB scans, no new GSI, consistent with
Principle IV at this project's scale).

**Scale/Scope**: Single owner, infrequent publish runs, on the order of 100-1000 recipes total and
a handful to a few dozen toggled per run — matches 001/002/003's stated scale.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Cost Above All | PASS | Step Functions Standard workflow, Lambda, S3, and CloudFront are all pay-per-use/pay-per-request; no fixed-cost resource is introduced. The new CloudFront distribution has the same zero-idle-cost profile as the existing one. |
| II. Static-First Public Site | PASS | This feature exists to implement this exact principle: every recipe detail page, category shell, and the browse/search index are pre-rendered by the pipeline; the public site has no server-side process at request time; client-side browse/search/filter is implemented in Alpine.js over the pre-generated index. Recipe-detail interactivity (servings/unit toggle) is explicitly deferred to a later feature, per the spec's Assumptions. |
| III. Single Exposed Backend Surface | PASS | The two new trigger routes (`POST /publish`, `POST /unpublish`) and the status route are added to the existing, already-authenticated backoffice API Gateway — no new API surface, no public-facing backend endpoint (the public site remains purely static). |
| IV. Simplicity Over Premature Scale | PASS | Selecting toggled recipes and rebuilding the index both use full table scans over the existing single table, no new GSI, matching the project's stated scale. The single `PIPELINE#STATUS` item is the simplest possible run-lock/status mechanism at this scale. |
| V. Explicit Over Automatic | PASS | This principle names this feature's exact mechanism as its canonical example (clicking "Publish all pending changes") — Publish/Unpublish are the only way the pipeline ever runs; routine recipe edits never trigger it. |
| VI. Multi-Language as a First-Class Concern | PASS | Recipe detail pages, category shells, and the browse/search index are all generated per locale; a recipe published in only some locales appears solely within those locales' surfaces (FR-015). |
| VII. Structured Data Over Free Text | N/A | No change to ingredient or step storage; this feature only adds publish-state and snapshot metadata. |

No violations — Complexity Tracking is not needed for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/004-publish-pipeline-and/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── publish-api.md
│   └── public-site-index.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── handlers/
│   │   ├── toggle-recipe-publish.ts      # NEW — PATCH /recipes/{id}/publish-toggle
│   │   ├── start-publish.ts              # NEW — POST /publish
│   │   ├── start-unpublish.ts            # NEW — POST /unpublish
│   │   ├── get-publish-status.ts         # NEW — GET /publish-status
│   │   └── ...                           # existing handlers, unchanged
│   ├── domain/
│   │   ├── types.ts                      # MODIFIED — publish state + snapshot shapes
│   │   └── publish-selection.ts          # NEW — pure: pick toggled recipes, build run plan
│   ├── pipeline/                         # NEW — Step Functions task Lambdas
│   │   ├── render-recipe.ts              # per-recipe Map state: Eleventy render → S3 write
│   │   ├── remove-recipe.ts              # per-recipe Map state: S3 delete (Unpublish)
│   │   ├── rebuild-index.ts              # full browse/search index + category shells, from
│   │   │                                 # the snapshot table only (never live draft data)
│   │   └── invalidate-cdn.ts             # CloudFront invalidation for the public distribution
│   └── repository/
│       └── publish-repository.ts         # NEW — toggle/status/snapshot/pipeline-lock reads+writes
└── tests/
    ├── unit/
    │   ├── publish-selection.test.ts     # NEW
    │   └── rebuild-index.test.ts         # NEW
    └── integration/
        ├── start-publish.test.ts         # NEW — SFN client mocked
        └── render-recipe.test.ts         # NEW — S3 client mocked

public-site/                              # NEW top-level project — Eleventy source, not an app
├── .eleventy.js
├── templates/
│   ├── recipe-detail.njk
│   └── category-shell.njk
├── src/
│   └── render.ts                         # programmatic Eleventy invocation used by pipeline/render-recipe.ts
├── assets/
│   └── browse.js                         # Alpine.js-based client-side search/filter/pagination
└── tests/
    └── unit/
        └── templates.test.ts             # fixture data → expected HTML

frontend/
├── src/
│   ├── components/
│   │   └── PublishToggle.tsx             # NEW — per-recipe toggle, wired into RecipeListPage
│   ├── pages/
│   │   └── RecipeListPage.tsx            # MODIFIED — adds toggle column, Publish/Unpublish buttons,
│   │                                     # status polling display
│   └── services/
│       └── publishApi.ts                 # NEW — calls the four new routes
└── tests/
    └── unit/
        └── PublishToggle.test.tsx        # NEW

infra/
├── storage.ts                            # MODIFIED — no schema change needed (single-table, no new
│                                         # physical resource); public bucket added here
├── web.ts                                # MODIFIED — backoffice StaticSite gains
│                                         # `domain: 'admin.cuisine.libertpierrick.com'`
├── public-site.ts                        # NEW — public StaticSite/bucket + CloudFront, domain
│                                         # `cuisine.libertpierrick.com`
├── pipeline.ts                           # NEW — Step Functions state machine + its task Lambdas
└── api.ts                                # MODIFIED — four new routes + their Lambdas
```

**Structure Decision**: Extends the existing `backend/`/`frontend/`/`infra/` layout and adds one
new top-level project, `public-site/`, for the Eleventy templates and client-side browse/search
script — kept separate from `frontend/` because it is not an app the owner interacts with
directly, has no auth, and is invoked programmatically by `backend/src/pipeline/render-recipe.ts`
at publish time rather than built once at deploy time the way `frontend/`'s `StaticSite` is.
`infra/public-site.ts` provisions the public bucket+CloudFront+domain as infrastructure only; the
actual recipe HTML written into that bucket happens at publish-time via the pipeline Lambdas, not
via `StaticSite`'s own `build` step (which only runs at `sst deploy` time and has no access to
recipe data).

## Complexity Tracking

*No Constitution Check violations — section intentionally left empty.*
