---

description: "Task list template for feature implementation"
---

# Tasks: Publish Pipeline and Public Recipe Site

**Input**: Design documents from `/specs/004-publish-pipeline-and/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included, following 001/002/003's established pattern and the constitution's testing
stance (template/pure-function unit tests + mocked-client integration tests; no automated test
drives a real Step Functions execution or real CloudFront).

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Every task includes its exact file path(s)

## Path Conventions

Web application layout, per plan.md's Project Structure: `backend/src/`, `frontend/src/`,
`public-site/` (new top-level Eleventy project), `infra/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new `public-site/` project this feature introduces.

- [ ] T001 Create `public-site/` project scaffold (`package.json`, `tsconfig.json`,
  `.eleventy.js`) per plan.md's Project Structure, mirroring `backend/`'s TypeScript/Node 24.x
  configuration
- [ ] T002 [P] Add `@11ty/eleventy` (latest 3.x) and TypeScript devDependencies to
  `public-site/package.json` (plan.md Primary Dependencies)
- [ ] T003 [P] Configure ESLint for `public-site/` in `public-site/eslint.config.js`, matching the
  style of `backend/eslint.config.js` and `frontend/eslint.config.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data model, trigger/status API, toggle UI, and the pipeline's shared (non-per-recipe)
steps — everything every user story needs before it can be built or independently tested.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Extend `backend/src/domain/types.ts`: add `selectedForNextPublish: boolean` and
  `publishStatus: 'not_published' | 'live' | 'publishing' | 'unpublishing'` to `RecipeMeta`
  (data-model.md's `RECIPE#<id>/META` — extended); add new `PublishedSnapshot`
  (`recipeId`, `locale`, `title`, `slug`, `categoryId: string | null`, `renderedAt`) and
  `PipelineStatus` (`running: boolean`, `executionArn: string | null`,
  `action: 'publish' | 'unpublish' | null`, `startedAt: string | null`,
  `lastResult: 'succeeded' | 'failed' | null`) interfaces; update the stale `RecipeStatus` doc
  comment ("Only `'draft'` exists... publishing will add `'published'`") to reflect that
  publish state lives in the new `publishStatus` field, not a `RecipeStatus` enum value
- [ ] T005 [P] Implement `backend/src/repository/publish-repository.ts`: read/write
  `selectedForNextPublish` and `publishStatus` on `RECIPE#<id>/META`; create/delete
  `RECIPE#<id>/PUBLISHED#<locale>` snapshot items; read/write the single `PIPELINE#STATUS` item
  (data-model.md — exactly one such item ever exists)
- [ ] T006 [P] Unit test `backend/tests/unit/publish-repository.test.ts`: toggle set/reset,
  `publishStatus` transitions, snapshot create/delete, and `PIPELINE#STATUS` read/write, against a
  local DynamoDB (mirrors 001's repository test pattern)
- [ ] T007 Add a new public, static-site-ready S3 bucket (`clp-` prefixed, per
  `infra/iam/README.md`'s naming constraint) to `infra/storage.ts` for the public site's rendered
  output
- [ ] T008 Create `infra/public-site.ts`: a new `sst.aws.StaticSite` provisioning the public
  bucket + CloudFront distribution + `domain: 'cuisine.libertpierrick.com'` via SST's Route 53 DNS
  integration (research.md "Custom domains via SST") — `build` step left minimal/placeholder, since
  real content is written by the pipeline at publish time, not at `sst deploy` time
- [ ] T009 Add `domain: 'admin.cuisine.libertpierrick.com'` to the existing backoffice
  `sst.aws.StaticSite` in `infra/web.ts` (research.md "Backoffice migration to its own subdomain")
- [ ] T010 Create `infra/pipeline.ts`: the Step Functions state machine shape — a selection Lambda,
  a Map state branching to a render task (Publish) or a remove task (Unpublish) per toggled
  recipe, a shared rebuild-index task, a shared invalidate-CDN task, and a top-level `Catch`
  handler that marks `PIPELINE#STATUS.lastResult = 'failed'` and leaves unaffected recipes
  untouched (FR-010, research.md "Pipeline orchestration shape"); wire placeholder stubs for the
  render/remove task Lambdas, to be implemented in US1/US2
- [ ] T011 Implement `backend/src/domain/publish-selection.ts`: pure function that reads the
  toggled-on (`selectedForNextPublish === true`) recipe set and builds a run plan for a given
  action (`'publish' | 'unpublish'`) — FR-002 through FR-004
- [ ] T012 [P] Unit test `backend/tests/unit/publish-selection.test.ts`: untoggled recipes are
  excluded from either plan; a recipe toggled on appears in exactly one plan per the action passed
- [ ] T013 Implement `backend/src/handlers/toggle-recipe-publish.ts`:
  `PATCH /recipes/{id}/publish-toggle` (contracts/publish-api.md) — `404` for an unknown recipe id
- [ ] T014 Implement `backend/src/handlers/start-publish.ts` and
  `backend/src/handlers/start-unpublish.ts`: `POST /publish` / `POST /unpublish` — reject with
  `409` if `PIPELINE#STATUS.running` is already `true` (FR-009), otherwise call Step Functions
  `StartExecution` with `publish-selection.ts`'s plan, record `running: true` +
  `executionArn` + `action` + `startedAt`, and return `202` with `{ executionArn, status:
  "started" }`; return `200` with `{ status: "nothing-to-publish" | "nothing-to-unpublish" }` and
  skip `StartExecution` when the plan is empty (contracts/publish-api.md)
- [ ] T015 Implement `backend/src/handlers/get-publish-status.ts`: `GET /publish-status` — reads
  `PIPELINE#STATUS`, and while `running` is `true`, calls Step Functions `DescribeExecution` on the
  stored `executionArn` to confirm live status (contracts/publish-api.md)
- [ ] T016 [P] Integration test `backend/tests/integration/start-publish.test.ts`: the `409`
  concurrent-run guard (FR-009) and the `nothing-to-publish` no-op path, with the Step Functions
  client mocked (quickstart.md scenario 6)
- [ ] T017 Wire the four new routes — `PATCH /recipes/{id}/publish-toggle`, `POST /publish`,
  `POST /unpublish`, `GET /publish-status` — into `infra/api.ts`, each behind the existing Cognito
  JWT authorizer (Principle III — no new unauthenticated surface)
- [ ] T018 Extend `backend/src/handlers/list-recipes.ts` and `backend/src/handlers/get-recipe.ts`
  response shapes to include `selectedForNextPublish` and `publishStatus` per recipe (FR-008,
  contracts/publish-api.md — additive fields on the existing 001 contracts)
- [ ] T019 [P] Create `frontend/src/services/publishApi.ts`: typed calls to the four new routes
- [ ] T020 Create `frontend/src/components/PublishToggle.tsx`: a self-contained per-recipe toggle
  control (owns its own pending/error state, mirroring 003's `TranslationDraftButton.tsx` pattern)
- [ ] T021 Modify `frontend/src/pages/RecipeListPage.tsx`: add the toggle column, "Publish" and
  "Unpublish" buttons (each acting on currently-toggled recipes only), a per-recipe
  `publishStatus` display independent of the toggle (FR-008), and polling of `GET /publish-status`
  while a run is in progress, surfacing a `409` as a clear "a run is already in progress" message
  (FR-009)
- [ ] T022 [P] Unit test `frontend/tests/unit/PublishToggle.test.tsx` (React Testing Library, per
  003's established component-test pattern)
- [ ] T023 Implement `backend/src/pipeline/rebuild-index.ts`: regenerates, in full on every run,
  each locale's `browse-index.json` and every category shell page's presence/absence, built
  exclusively from `RECIPE#<id>/PUBLISHED#<locale>` snapshot items filtered to
  `publishStatus === 'live'` — **never** from live draft recipe content (FR-013, SC-008,
  research.md "Full index/category rebuild, driven by a snapshot table")
- [ ] T024 [P] Unit test `backend/tests/unit/rebuild-index.test.ts`: given a snapshot-table fixture
  and a live draft edit to a recipe *not* re-rendered this run, confirms the rebuilt index/category
  shells reflect only the snapshot data, never the live draft edit
- [ ] T025 Implement `backend/src/pipeline/invalidate-cdn.ts`: CloudFront invalidation for the
  public distribution, run as the pipeline's final shared task
- [ ] T026 Create `public-site/.eleventy.js` config and `public-site/templates/category-shell.njk`:
  static chrome shell per locale/category that fetches `browse-index.json` client-side rather than
  embedding a recipe list (contracts/public-site-index.md)

**Checkpoint**: Foundation ready — every user story phase below can now be implemented and
independently tested.

---

## Phase 3: User Story 1 - Publish selected recipes to the public site (Priority: P1) 🎯 MVP

**Goal**: A recipe toggled on and published becomes live on the public site; untoggled recipes are
unaffected.

**Independent Test**: Toggle one complete recipe, click "Publish," confirm its detail page,
category listing, and `browse-index.json` entry all appear; confirm an untoggled recipe's public
state is unchanged (quickstart.md scenario 1).

### Tests for User Story 1

- [ ] T027 [P] [US1] Integration test `backend/tests/integration/render-recipe.test.ts`: the
  per-recipe render → S3-write → snapshot-write → `publishStatus` transition logic, with the S3
  client mocked

### Implementation for User Story 1

- [ ] T028 [US1] Create `public-site/templates/recipe-detail.njk`: per-locale recipe detail page
  template (contracts/public-site-index.md's `/<locale>/recipes/<slug>.html` path)
- [ ] T029 [US1] Implement `public-site/src/render.ts`: programmatic Eleventy invocation that
  renders one recipe's data against `recipe-detail.njk`, writing to the Lambda's `/tmp`
  (research.md "Rendering recipes with Eleventy inside a Lambda task")
- [ ] T030 [US1] Implement `backend/src/pipeline/render-recipe.ts` (the Map-state render task):
  invokes `public-site/src/render.ts`, uploads the result to the public bucket via `PutObject` —
  one file per locale the recipe has content for, never for a locale it lacks (FR-015) — writes
  that locale's `RECIPE#<id>/PUBLISHED#<locale>` snapshot (data-model.md), sets `publishStatus` to
  `'live'` on success, leaves it at its prior value unchanged on failure (FR-010), and resets
  `selectedForNextPublish` to `false` regardless of outcome (FR-005)
- [ ] T031 [US1] Wire `render-recipe.ts` into `infra/pipeline.ts`'s Publish-branch Map state,
  replacing T010's placeholder
- [ ] T032 [US1] Run quickstart.md scenario 1 (Publish a recipe) end-to-end against a deployed
  stack and confirm every expected result

**Checkpoint**: User Story 1 is independently functional — this is the MVP.

---

## Phase 4: User Story 2 - Remove selected recipes from the public site (Priority: P1)

**Goal**: A toggled, live recipe becomes unreachable on the public site when "Unpublish" is
clicked; untoggled recipes are unaffected.

**Independent Test**: Toggle a currently-live recipe, click "Unpublish," confirm it is no longer
reachable at its detail URL, category listing, or `browse-index.json`; confirm an untoggled live
recipe stays live (quickstart.md scenario 2).

### Tests for User Story 2

- [ ] T033 [P] [US2] Integration test `backend/tests/integration/remove-recipe.test.ts`: the
  per-recipe S3-delete → snapshot-delete → `publishStatus` transition logic, with the S3 client
  mocked

### Implementation for User Story 2

- [ ] T034 [US2] Implement `backend/src/pipeline/remove-recipe.ts` (the Map-state remove task):
  deletes the recipe's rendered page(s) from the public bucket, deletes its
  `RECIPE#<id>/PUBLISHED#<locale>` snapshot(s), sets `publishStatus` to `'not_published'` on
  success, leaves it at its prior value unchanged on failure (FR-010), and resets
  `selectedForNextPublish` to `false` regardless of outcome (FR-005)
- [ ] T035 [US2] Wire `remove-recipe.ts` into `infra/pipeline.ts`'s Unpublish-branch Map state,
  replacing T010's placeholder
- [ ] T036 [US2] Run quickstart.md scenario 2 (Unpublish a recipe) end-to-end against a deployed
  stack and confirm every expected result

**Checkpoint**: Publish and Unpublish are both independently functional.

---

## Phase 5: User Story 3 - The public site reflects a stable, deliberate snapshot (Priority: P1)

**Goal**: Confirm that editing an already-published recipe's draft content, without republishing
it, never changes what the public site shows — the guarantee T023/T030/T034 already implement by
construction (snapshot-table-driven rendering and indexing), verified explicitly here.

**Independent Test**: Edit an already-published recipe's content in the backoffice without
toggling/republishing it; confirm the public site is unchanged; then republish and confirm it
updates (quickstart.md scenario 3).

### Tests for User Story 3

- [ ] T037 [P] [US3] Integration test `backend/tests/integration/stable-snapshot.test.ts`: edits a
  published recipe's draft content via the existing `PUT /recipes/{id}` (001) without
  toggling/republishing it, and asserts its `RECIPE#<id>/PUBLISHED#<locale>` snapshot is untouched

### Implementation for User Story 3

- [ ] T038 [US3] Run quickstart.md scenario 3 (editing without republishing) end-to-end against a
  deployed stack and confirm every expected result

**Checkpoint**: The snapshot-stability guarantee (FR-007, SC-005) is verified.

---

## Phase 6: User Story 4 - Browse and search the public site (Priority: P2)

**Goal**: A visitor can browse published recipes by category and search/filter across them,
client-side, in their chosen locale.

**Independent Test**: Publish recipes across multiple categories and at least two locales; confirm
a visitor can browse by category and find a recipe via search in more than one locale, and that a
recipe missing from a locale doesn't break that locale's listings (quickstart.md scenario 4).

### Tests for User Story 4

- [ ] T039 [P] [US4] Unit test `public-site/tests/unit/templates.test.ts`: fixture recipe/category
  data → expected `category-shell.njk` HTML output (constitution's Eleventy template-rendering
  testing stance)

### Implementation for User Story 4

- [ ] T040 [US4] Implement `public-site/assets/browse.js`: Alpine.js-based client-side
  search/filter/pagination over `browse-index.json` (contracts/public-site-index.md, Principle II)
- [ ] T041 [US4] Wire `browse.js` into `public-site/templates/category-shell.njk`, using
  `mockups/Browse.dc.html` as the visual/layout reference
- [ ] T042 [US4] Run quickstart.md scenario 4 (browse and search) end-to-end against a deployed
  stack, across at least two locales and categories

**Checkpoint**: The public site is fully browsable and searchable.

---

## Phase 7: User Story 5 - Manage the backoffice from its own subdomain (Priority: P3)

**Goal**: The backoffice works identically at `admin.cuisine.libertpierrick.com`.

**Independent Test**: Navigate to `admin.cuisine.libertpierrick.com`, sign in, perform an existing
backoffice action (quickstart.md scenario 5).

### Implementation for User Story 5

- [ ] T043 [US5] Update the Cognito app client's callback/logout URLs in `infra/auth.ts` to use
  `https://admin.cuisine.libertpierrick.com` (built on T009's domain addition)
- [ ] T044 [US5] Run quickstart.md scenario 5 (backoffice on its own subdomain) end-to-end against
  a deployed stack

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Run quickstart.md scenario 6 (concurrent-run guard) end-to-end against a deployed
  stack
- [ ] T046 [P] Run quickstart.md scenario 7 (partial-failure isolation) end-to-end, simulating one
  recipe's render failing while others succeed
- [ ] T047 Update `specs/004-publish-pipeline-and/quickstart.md` with the actual deployed URLs and
  any corrections found during manual validation
- [ ] T048 [P] Update `backend/README.md` and the root `README.md` with the publish/unpublish
  workflow and the two live domains (`cuisine.libertpierrick.com`,
  `admin.cuisine.libertpierrick.com`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3-7)**: All depend on Foundational completion.
  - US1 and US2 share `infra/pipeline.ts`'s shape (T010) but implement independent task Lambdas
    (`render-recipe.ts` vs `remove-recipe.ts`) — no code dependency between them.
  - US3 depends on US1 (needs a published recipe to edit-without-republishing) and US2's existing
    snapshot-delete behavior conceptually, but adds no new implementation of its own — it is a
    verification phase.
  - US4 depends on US1 (needs published recipes to browse) but touches entirely different files
    (`public-site/assets/`).
  - US5 depends only on Foundational (T009's domain addition) — fully independent of US1-US4.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Within Each Phase

- Tests are written before the implementation task(s) they cover, and should fail first.
- Domain/pure-function logic before the Lambda handlers that call it.
- Handlers before their `infra/api.ts`/`infra/pipeline.ts` wiring.
- Each user story's own quickstart-validation task is last in that phase.

### Parallel Opportunities

- All `[P]`-marked Setup tasks (T002, T003) can run together.
- Within Foundational: T005/T006 (repository), T007-T010 (infra), T011/T012 (selection logic),
  T016, T019, T022, T024 can each run in parallel with other `[P]` tasks once their own
  prerequisites (e.g. T004 before T005) are done.
- Once Foundational is complete, **US1, US2, and US5 can be implemented in parallel** (different
  files, no shared dependency beyond Foundational); US4 can start as soon as US1 produces its first
  published recipe for manual validation, though its own files are independent throughout; US3 is
  a verification-only phase best run once US1 (and ideally US2) are done.

---

## Parallel Example: Foundational Phase

```bash
# Once T004 (types.ts) is done, these can run together:
Task: "Implement backend/src/repository/publish-repository.ts"
Task: "Add public S3 bucket to infra/storage.ts"
Task: "Create infra/public-site.ts"
Task: "Add admin.cuisine.libertpierrick.com domain to infra/web.ts"

# Once their respective implementation tasks exist, these tests run together:
Task: "Unit test backend/tests/unit/publish-repository.test.ts"
Task: "Unit test backend/tests/unit/publish-selection.test.ts"
Task: "Integration test backend/tests/integration/start-publish.test.ts"
```

## Parallel Example: User Stories 1, 2, and 5

```bash
# After Foundational completes, three independent workstreams:
Task: "US1 — public-site/templates/recipe-detail.njk, public-site/src/render.ts,
       backend/src/pipeline/render-recipe.ts"
Task: "US2 — backend/src/pipeline/remove-recipe.ts"
Task: "US5 — infra/auth.ts Cognito callback URL update"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (critical — blocks every story).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run quickstart.md scenario 1 independently.
5. Deploy/demo if ready — a single recipe can now go from backoffice draft to live public page.

### Incremental Delivery

1. Setup + Foundational → toggle, trigger/status API, and shared pipeline steps all exist.
2. Add US1 → publish a recipe → validate → demo (MVP).
3. Add US2 → unpublish a recipe → validate.
4. Add US3 → verify the snapshot-stability guarantee holds.
5. Add US4 → browse/search becomes usable.
6. Add US5 → backoffice reachable at its new subdomain.
7. Polish → concurrent-run and partial-failure edge cases, docs.

Each story adds value without breaking a previously-delivered one.

### Parallel Team Strategy

With multiple developers, after Foundational completes: one takes US1 (the render path), one takes
US2 (the remove path) and US5 (independent, small), one takes US4 once US1 has produced its first
published recipe to browse. US3 is best done last, by whoever finishes US1/US2 first, since it only
verifies behavior those two already implement.
