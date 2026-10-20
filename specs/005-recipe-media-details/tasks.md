---

description: "Task list for Recipe Media and Serving Details"
---

# Tasks: Recipe Media and Serving Details

**Input**: Design documents from `specs/005-recipe-media-details/`

**Tests**: Included — this project's established convention (001-004) is TDD throughout (failing
test before implementation).

**Organization**: Tasks are grouped by user story (US1: P1, US2: P2, US3: P3) after a Foundational
phase that all three depend on.

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The four new `RecipeMeta` fields and the extended `PublishedSnapshot` must exist
before any user story's handler, pipeline, or render-data work can build on them.

- [ ] T001 Add `prepMinutes: number | null`, `cookMinutes: number | null`,
      `baseServings: number | null`, `coverImageUrl: string | null` to `RecipeMeta` and
      `RecipeWithLocales`/`RecipeInput` in `backend/src/domain/types.ts`; add `coverImageUrl: string
      | null` to `PublishedSnapshot`.
- [ ] T002 [P] Write a failing integration test in `backend/tests/integration/` asserting
      `createRecipe`/`updateRecipe`/`getRecipe` (`backend/src/repository/recipe-repository.ts`)
      persist and return the four new fields, defaulting every one to `null` for a recipe that
      never sets them (matching `withPublishDefaults()`'s existing backward-compatibility pattern
      for 004's own additive fields) — then make it pass by extending
      `recipe-repository.ts`'s `createRecipe`/`updateRecipe`/`assembleRecipe`/`withPublishDefaults`.
- [ ] T003 [P] Write a failing integration test asserting `putPublishedSnapshot`/
      `getPublishedSnapshot` (`backend/src/repository/publish-repository.ts`) persist and return
      `coverImageUrl` — then make it pass by extending both functions and their internal
      `withPublishDefaults()` helper.

**Checkpoint**: Data model ready — user story work can begin.

---

## Phase 2: User Story 1 - Owner records prep/cook time and servings (Priority: P1) 🎯 MVP

**Goal**: The owner can set prep minutes, cook minutes, and base servings on a recipe in the
backoffice; a published recipe shows exactly the fields that are set, next to the category badge.

**Independent Test**: Set the three fields on a recipe in the backoffice, publish it, and confirm
the rendered page shows "Prep X min · Bake Y min" and "Serves N" — see `quickstart.md`'s User
Story 1 section.

### Tests for User Story 1

- [ ] T004 [P] [US1] Write a failing test in `backend/tests/unit/` or
      `backend/tests/integration/` asserting `create-recipe.ts`/`update-recipe.ts`
      (`backend/src/handlers/`) return `400` when `prepMinutes`/`cookMinutes`/`baseServings` is
      present but not a positive integer, and persist them correctly when valid.
- [ ] T005 [P] [US1] Write a failing test in `backend/tests/integration/render-recipe.test.ts` (or
      sibling) asserting `renderRecipe()` (`backend/src/pipeline/render-recipe.ts`) passes
      `prepMinutes`/`cookMinutes`/`baseServings` through to `renderRecipePage` from the recipe's
      current `RecipeMeta` values, `null` when unset.
- [ ] T006 [P] [US1] Write failing tests in `public-site/tests/unit/render.test.ts` asserting
      `renderRecipePage` embeds a "Prep X min · Bake Y min" line and a "Serves N" line when the
      corresponding fields are set, and omits each independently (not a blank/zero placeholder)
      when unset — covering spec.md's per-field-omission Acceptance Scenario 3.

### Implementation for User Story 1

- [ ] T007 [US1] Add request validation (positive-integer check) for `prepMinutes`/
      `cookMinutes`/`baseServings` to `backend/src/handlers/create-recipe.ts` and
      `update-recipe.ts`, returning `400` on an invalid value (makes T004 pass).
- [ ] T008 [US1] Extend `renderRecipe()` in `backend/src/pipeline/render-recipe.ts` to read
      `prepMinutes`/`cookMinutes`/`baseServings` off the fetched `RecipeMeta` and pass them to
      `renderRecipePage` (makes T005 pass).
- [ ] T009 [US1] Add `prepMinutes: number | null`, `cookMinutes: number | null`,
      `baseServings: number | null` to `RecipeRenderData` in `public-site/src/render.ts`.
- [ ] T010 [US1] Update `public-site/templates/recipe-detail.njk`'s hero section to render a
      "Prep X min · Bake Y min" line and a "Serves N" indicator next to the existing category
      badge, each conditionally rendered per field (makes T006 pass).
- [ ] T011 [P] [US1] Add `.recipe-meta`/`.meta-item` styles to `public-site/assets/style.css` for
      the new hero meta line, matching `mockups/Main.dc.html`'s "Prep 25 min · Bake 45 min" text
      styling.
- [ ] T012 [US1] Add number inputs for Prep time, Cook time, and Servings to
      `frontend/src/pages/RecipeEditorPage.tsx`, alongside the existing `CategoryTagPicker`
      (recipe-level, not per-locale — rendered once, not inside the locale tabs), wired to the
      existing save call.
- [ ] T013 [US1] Extend the request/response types in `frontend/src/services/recipesApi.ts` with
      the three new fields.

**Checkpoint**: User Story 1 is independently functional — publish a recipe with these three
fields set (or unset) and the rendered page reflects it correctly.

---

## Phase 3: User Story 2 - Owner attaches a cover image (Priority: P2)

**Goal**: The owner can upload one cover photo per recipe; a published recipe shows it as a hero
image, and its browse/home cards show it as a thumbnail.

**Independent Test**: Upload a cover image to a recipe in the backoffice, publish it, and confirm
the image appears on the recipe's detail page and its card on the home/category pages — see
`quickstart.md`'s User Story 2 section.

### Tests for User Story 2

- [ ] T014 [P] [US2] Write a failing test asserting `create-recipe.ts`/`update-recipe.ts` accept
      and persist an optional non-empty-string `coverImageUrl`, `400` only on a present-but-empty
      value.
- [ ] T015 [P] [US2] Write a failing test asserting `renderRecipe()`
      (`backend/src/pipeline/render-recipe.ts`) passes `coverImageUrl` to `renderRecipePage` and
      writes it onto the `PublishedSnapshot` via `putPublishedSnapshot` (extends T003/T005's test
      file or a sibling).
- [ ] T016 [P] [US2] Write a failing test asserting `rebuildIndex()`
      (`backend/src/pipeline/rebuild-index.ts`) includes each recipe's `coverImageUrl` (sourced
      from the snapshot, never live draft data — per 004's existing drift-avoidance guarantee) in
      that locale's `browse-index.json` entry, `null` when the recipe has none.
- [ ] T017 [P] [US2] Write failing tests in `public-site/tests/unit/render.test.ts` asserting
      `renderRecipePage` embeds a hero `<img>` for a set `coverImageUrl` and omits any image
      element entirely when it is `null` (FR-005 — no broken image, no placeholder box).
- [ ] T018 [P] [US2] Write a failing component test
      `frontend/tests/unit/CoverImageUpload.test.tsx` (pattern: `PublishToggle.test.tsx` — mock
      the image-upload service, assert the component calls it and reports the resulting URL, and
      surfaces an error without crashing on failure).

### Implementation for User Story 2

- [ ] T019 [US2] Add request validation for `coverImageUrl` to `create-recipe.ts`/
      `update-recipe.ts` (makes T014 pass).
- [ ] T020 [US2] Extend `renderRecipe()` to read `coverImageUrl` off `RecipeMeta`, pass it to
      `renderRecipePage`, and include it in the `putPublishedSnapshot` call (makes T015 pass).
- [ ] T021 [US2] Extend the `BrowseIndexEntry` interface and the per-recipe entry built in
      `rebuildIndex()` (`backend/src/pipeline/rebuild-index.ts`) with `coverImageUrl`, sourced from
      `PublishedSnapshot` (makes T016 pass).
- [ ] T022 [US2] Add `coverImageUrl: string | null` to `RecipeRenderData` in
      `public-site/src/render.ts`; update `recipe-detail.njk` to render a hero `<img>` between the
      hero text and the two-column body when set, nothing when `null` (makes T017 pass).
- [ ] T023 [P] [US2] Update `public-site/assets/browse.js`'s recipe-card template fragment (used
      by both `category-shell.njk` and `home.njk`) to render a thumbnail `<img>` bound to
      `recipe.coverImageUrl` with `x-show`, omitted entirely when `null` — never a broken-image
      icon.
- [ ] T024 [P] [US2] Add `.hero-image`/`.recipe-card img` thumbnail styles to
      `public-site/assets/style.css`, matching `mockups/Main.dc.html`'s hero photo and
      `mockups/Browse.dc.html`'s card thumbnail sizing.
- [ ] T025 [US2] Create `frontend/src/services/imagesApi.ts`: `requestImageUploadUrl(contentType)`
      calling `POST /images` (002's existing route, no frontend caller today — confirmed in
      research.md) and a helper that `PUT`s the file to the returned `uploadUrl`.
- [ ] T026 [US2] Create `frontend/src/components/CoverImageUpload.tsx`: a file picker that calls
      `imagesApi.ts`, shows a preview once uploaded, and reports the resulting `imageUrl` to its
      parent (makes T018 pass).
- [ ] T027 [US2] Wire `CoverImageUpload` into `frontend/src/pages/RecipeEditorPage.tsx` (recipe-
      level, alongside the Phase 2 time/servings fields) and extend
      `frontend/src/services/recipesApi.ts`'s types with `coverImageUrl`.

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 4: User Story 3 - Visitor scales servings interactively (Priority: P3)

**Goal**: A visitor can change the displayed servings count on a published recipe and see every
ingredient quantity (and its approximate equivalent, when recorded) recalculate live, client-side,
with no page reload — and no servings control at all when the recipe has no base servings set.

**Independent Test**: Publish a recipe with base servings and at least one ingredient with a
recorded `approxEquivalent`; open its page; use the stepper; confirm every quantity updates — see
`quickstart.md`'s User Story 3 section.

### Tests for User Story 3

- [ ] T028 [US3] Write a failing test in `public-site/tests/unit/render.test.ts` asserting
      `renderRecipePage`'s `ingredientGroups` lines are now structured
      (`{ quantity, unit, name, approxEquivalent }`), not a pre-flattened `text` string, and that
      this structured data (and `baseServings`) is embedded in the rendered HTML in a form a
      client-side script can read (e.g. a JSON blob on the Alpine `x-data` root, or `data-*`
      attributes per line).
- [ ] T029 [US3] Write a failing test asserting that when `baseServings` is `null`, the rendered
      page falls back to the 004 behavior exactly — static ingredient text, no stepper control, no
      embedded structured-scaling data beyond what's needed to show the line once (FR-007).
- [ ] T030 [US3] Write a failing test in `backend/tests/integration/` asserting `renderRecipe()`
      builds the new structured `ingredientGroups` shape (quantity/unit/name/approxEquivalent per
      line, from `RecipeMeta.ingredientGroups` + that locale's `ingredientNames`) instead of
      calling the old `formatIngredientLine` string-concatenation helper.

### Implementation for User Story 3

- [ ] T031 [US3] Change `RecipeRenderData.ingredientGroups` in `public-site/src/render.ts` from
      `Array<{ name, lines: Array<{ text }> }>` to
      `Array<{ name, lines: Array<{ quantity, unit, name, approxEquivalent }> }>` (makes T028
      pass).
- [ ] T032 [US3] Replace `render-recipe.ts`'s `formatIngredientLine` call with code that builds the
      new structured line shape directly from `RecipeMeta.ingredientGroups` and the locale's
      `content.ingredientNames`/`groupNames`, keeping `approxEquivalent` intact (makes T030 pass);
      delete `formatIngredientLine` once nothing calls it.
- [ ] T033 [US3] Create `public-site/assets/recipe.js`: an Alpine component
      `recipeDetail(baseServings, groups)` holding `servings` state (initialized to
      `baseServings`, clamped to a minimum of 1), an `inc()`/`dec()` pair, and a `scaled(line)`
      helper computing `quantity * (servings / baseServings)` — and the same for
      `line.approxEquivalent.quantity` when present — formatted to at most one decimal place with
      a trailing `.0` dropped (mirrors `mockups/Main.dc.html`'s own `fmt()`/`renderVals()`
      prototype). No automated test for this plain script, consistent with `browse.js`'s existing
      precedent (also untested directly) — validated live via `quickstart.md`'s User Story 3 steps
      instead.
- [ ] T034 [US3] Update `public-site/templates/recipe-detail.njk`: when `recipe.baseServings` is
      set, wire the ingredients card to `x-data="recipeDetail(...)"` from `recipe.js`, render the
      +/- stepper and the current servings count, and render each line's quantity/unit/name and
      (when present) its approximate equivalent via Alpine bindings reading `scaled(line)`; when
      `recipe.baseServings` is `null`, keep the current static-text rendering path (makes T029
      pass) — ensure `uploadStaticAssets()` in `backend/src/pipeline/rebuild-index.ts` also
      uploads `recipe.js` alongside `browse.js`/`style.css`.
- [ ] T035 [P] [US3] Add `.servings-stepper` styles to `public-site/assets/style.css`, matching
      `mockups/Main.dc.html`'s servings control and metric/imperial-toggle-free ingredient layout
      (the toggle itself is explicitly out of scope, FR-010).

**Checkpoint**: All three user stories are independently functional and composable (a recipe can
have any combination of time/servings/image set).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Run `quickstart.md`'s full validation end-to-end against a real deployed recipe,
      including the "Regression check" section confirming a pre-005 recipe (no new fields at all)
      still publishes and renders without error (FR-009, SC-002).
- [ ] T037 [P] Confirm `public-site`, `backend`, and `frontend` typecheck/lint/test all pass
      (`npm run typecheck`, `npm run lint`, `npm test` in each package).

## Dependencies & Execution Order

- **Phase 1 (Foundational)** blocks every user story — `RecipeMeta`/`PublishedSnapshot` must carry
  the new fields before any handler, pipeline, or render-data work can use them.
- **User Story 1 (P1)** has no dependency on US2/US3 beyond Phase 1, and is the MVP slice.
- **User Story 2 (P2)** has no dependency on US1 beyond Phase 1 (shares the same `RecipeEditorPage`
  file as US1's T012, so sequence T012 before T027 if working serially to avoid a merge conflict
  on that one file — they are otherwise independent).
- **User Story 3 (P3)** depends on US1's `baseServings` field existing (Phase 1 covers this) but
  not on US1's or US2's actual UI/pipeline work being done first — it reads `RecipeMeta` directly.
  It does restructure `ingredientGroups` rendering, which US1/US2 do not touch, so there is no file
  conflict.
- Within each story: write the failing tests first, confirm they fail for the right reason, then
  implement until green — the established project convention (001-004).

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 (US1) → stop and validate via `quickstart.md`'s User Story 1
section → deploy. Then Phase 3 (US2), then Phase 4 (US3), each independently validated and
deployed the same way 004's User Stories were (small PRs, CI green, merge, live-verify, as
established in this project's git history).
