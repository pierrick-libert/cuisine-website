# Tasks: Recipe Authoring

**Input**: Design documents from `/specs/001-recipe-authoring/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/recipes-api.md,
quickstart.md

**Tests**: Included — the project's constitution and plan.md's Development Workflow explicitly
call for unit tests on validation/conversion logic and integration tests on Lambda handlers.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, per plan.md's Project Structure

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create the `backend/` and `frontend/` directory structure per plan.md's Project
      Structure (`backend/src/{handlers,domain,repository,lib}`,
      `backend/tests/{unit,integration}`, `frontend/src/{components,pages,services}`,
      `frontend/tests/unit`)
- [X] T002 Initialize `backend/package.json`: TypeScript 7.x on Node 24 LTS, `@aws-sdk/client-dynamodb`,
      `@aws-sdk/lib-dynamodb`, Vitest (per research.md)
- [X] T003 [P] Initialize `frontend/package.json`: React 19 + TypeScript, React Router, Tiptap
      (per research.md)
- [X] T004 [P] Configure ESLint + Prettier for `backend/` and `frontend/`
- [X] T005 [P] Add an npm script to start `amazon/dynamodb-local` via Docker for integration tests
      (per research.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Define shared TypeScript types for Recipe (META item), Ingredient Group/Line, Locale
      Content, and Category in `backend/src/domain/types.ts`, matching the item shapes in
      data-model.md exactly (including that `unit` and `approxEquivalent` are optional per
      FR-004/FR-005, and that ingredient/step *names* live only in locale items, never in the
      META item)
- [X] T007 [P] Implement ULID generation helper in `backend/src/lib/id.ts` (used for `recipeId`,
      `categoryId`, `groupId`, `lineId`, step ids)
- [X] T008 [P] Implement category name normalization in `backend/src/domain/category.ts`: lowercase
      + trim the display name into `normalizedName`, quoting FR-008 verbatim as the function's
      doc comment — "'Dessert' and 'dessert' resolve to the same category rather than creating a
      duplicate"
- [X] T009 Implement the single-table DynamoDB client wrapper in
      `backend/src/repository/table-client.ts` (PK/SK as defined in data-model.md, no secondary
      indexes per constitution Principle IV)
- [X] T010 Implement recipe repository primitives (get/put/delete by `PK`/`SK`, list via full Scan)
      in `backend/src/repository/recipe-repository.ts` (depends on T006, T009)
- [X] T011 [P] Implement category repository (find-by-`normalizedName`-or-create) in
      `backend/src/repository/category-repository.ts` (depends on T006, T008, T009)
- [X] T012 Add an npm script `create-table:local` in `backend/package.json` that creates the single
      table (PK/SK, on-demand billing) against local DynamoDB, per quickstart.md's Setup section
- [ ] T013 Scaffold the backoffice SPA shell — React Router routes for `RecipeListPage` and
      `RecipeEditorPage`, and a stub API client — in `frontend/src/App.tsx` and
      `frontend/src/services/recipesApi.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Create a new recipe (Priority: P1) 🎯 MVP

**Goal**: The owner can create a brand-new recipe — name, ingredient groups/lines, rich-text
steps — and save it as a draft, even with some fields left incomplete.

**Independent Test**: Create a recipe end to end (name, one ingredient group with one line, step
text), save, and confirm it is retrievable with identical content — matches spec.md US1 Acceptance
Scenarios 1-3.

### Tests for User Story 1

- [X] T014 [P] [US1] Integration test for `POST /recipes` in
      `backend/tests/integration/create-recipe.test.ts`: asserts `400` when `name` is empty/missing
      (FR-002), and `201` when `ingredientGroups`/`steps` are empty arrays (FR-010 — partial drafts
      are valid)
- [X] T015 [P] [US1] Unit test for ingredient line validation in
      `backend/tests/unit/ingredient-validation.test.ts`: `quantity` required, `unit` and
      `approxEquivalent` optional (FR-004, FR-005)
- [X] T016 [P] [US1] Unit test for category normalization in `backend/tests/unit/category.test.ts`
      covering FR-008's case-insensitivity

### Implementation for User Story 1

- [X] T017 [US1] Implement `POST /recipes` handler in `backend/src/handlers/create-recipe.ts`
      (depends on T010, T011; validates FR-001/FR-002, accepts partial content per FR-010)
- [X] T018 [US1] Implement `GET /recipes/{id}` handler in `backend/src/handlers/get-recipe.ts`,
      assembling the META item and its `LOCALE#*` items into the response shape in
      contracts/recipes-api.md (depends on T010)
- [X] T019 [US1] Implement `GET /recipes` (list) handler in `backend/src/handlers/list-recipes.ts`
      using a full table Scan grouped in memory, per constitution Principle IV (depends on T010)
- [X] T020 [P] [US1] Build `IngredientGroupEditor` and `IngredientLineRow` components in
      `frontend/src/components/IngredientGroupEditor.tsx` and
      `frontend/src/components/IngredientLineRow.tsx` — quantity/unit/name fields, add-group and
      add-line actions (reorder uses move-up/down controls rather than pointer drag-and-drop, to
      avoid a drag-and-drop library dependency for a single-user tool)
- [X] T021 [P] [US1] Build the `StepsEditor` rich-text component (Tiptap; bold/italic + inline
      images per FR-006) in `frontend/src/components/StepsEditor.tsx` (image insertion is by URL —
      an upload pipeline is out of this feature's scope per spec.md Assumptions)
- [X] T022 [US1] Build `RecipeEditorPage` wiring `IngredientGroupEditor` + `StepsEditor` + a save
      action calling `POST /recipes` in `frontend/src/pages/RecipeEditorPage.tsx` (depends on T020,
      T021)
- [X] T023 [US1] Build `RecipeListPage` showing saved drafts via `GET /recipes` in
      `frontend/src/pages/RecipeListPage.tsx` (depends on T019)
- [X] T024 [US1] Implement `createRecipe`/`getRecipe`/`listRecipes` methods in
      `frontend/src/services/recipesApi.ts` (depends on T017, T018, T019)

**Checkpoint**: User Story 1 is fully functional and independently testable — a recipe can be
created and viewed end to end.

---

## Phase 4: User Story 2 - Edit an existing draft recipe (Priority: P1)

**Goal**: The owner can reopen a draft and change it — quantities, reordering, deletions,
category/tags — per FR-012/FR-013.

**Independent Test**: Open a Story-1 draft, change a quantity, reorder two ingredient lines, save,
and confirm the new state persists and the old state is gone — matches spec.md US2 Acceptance
Scenarios 1-4.

### Tests for User Story 2

- [ ] T025 [P] [US2] Integration test for `PUT /recipes/{id}` in
      `backend/tests/integration/update-recipe.test.ts`: quantity update, line/group reorder, and
      delete-of-group/line/step
- [ ] T026 [P] [US2] Integration test for `DELETE /recipes/{id}` in
      `backend/tests/integration/delete-recipe.test.ts` (FR-013)
- [ ] T027 [P] [US2] Unit test for reorder logic in `backend/tests/unit/reorder.test.ts`: array
      order is display order (data-model.md), reordering/deleting one group/line never corrupts
      unrelated content (SC-004)

### Implementation for User Story 2

- [ ] T028 [US2] Implement `PUT /recipes/{id}` handler in `backend/src/handlers/update-recipe.ts`
      (depends on T010, T011), including the server-side "last locale cannot be removed" rule from
      contracts/recipes-api.md
- [ ] T029 [US2] Implement `DELETE /recipes/{id}` handler in
      `backend/src/handlers/delete-recipe.ts` (FR-013; depends on T010)
- [ ] T030 [US2] Add drag-to-reorder and delete actions to `IngredientGroupEditor`/
      `IngredientLineRow` in `frontend/src/components/IngredientGroupEditor.tsx` and
      `frontend/src/components/IngredientLineRow.tsx` (depends on T020)
- [ ] T031 [P] [US2] Build `CategoryTagPicker` (existing-or-new category, free-form tags) in
      `frontend/src/components/CategoryTagPicker.tsx`
- [ ] T032 [US2] Wire `RecipeEditorPage`'s save action to `PUT /recipes/{id}` for existing recipes,
      add the delete-recipe action, and integrate `CategoryTagPicker` in
      `frontend/src/pages/RecipeEditorPage.tsx` (depends on T022, T028, T029, T031)

**Checkpoint**: User Stories 1 and 2 both work — full create/edit/delete lifecycle.

---

## Phase 5: User Story 3 - Author content in multiple languages (Priority: P2)

**Goal**: The owner can add a second language's content to a recipe while quantities, units, and
structure stay shared rather than re-entered, per FR-009.

**Independent Test**: Take a Story-1 recipe (English only), add French content via a second locale
tab, save, and confirm both languages are independently retrievable with unchanged quantities —
matches spec.md US3 Acceptance Scenarios 1-3.

### Tests for User Story 3

- [ ] T033 [P] [US3] Integration test in `backend/tests/integration/multi-locale.test.ts`: add a
      second locale via `PUT /recipes/{id}`, confirm both locales retrievable independently and
      ingredient quantities/units unchanged (FR-009)
- [ ] T034 [P] [US3] Unit test in `backend/tests/unit/locale-content.test.ts` confirming
      locale-keyed ingredient/step text does not leak across locales

### Implementation for User Story 3

- [ ] T035 [US3] Extend `get-recipe`/`update-recipe` handlers to assemble/accept multiple
      `LOCALE#*` items without duplicating structural fields, in
      `backend/src/handlers/get-recipe.ts` and `backend/src/handlers/update-recipe.ts` (depends on
      T018, T028)
- [ ] T036 [US3] Build `LocaleTabs` component (switch active locale; indicate which locales have
      content) in `frontend/src/components/LocaleTabs.tsx`
- [ ] T037 [US3] Wire `RecipeEditorPage` to the active locale from `LocaleTabs` — groups/lines/
      steps structure stays shared while translatable text swaps per locale — in
      `frontend/src/pages/RecipeEditorPage.tsx` (depends on T022, T036)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T038 [P] Add `backend/README.md` and `frontend/README.md` with run instructions matching
      quickstart.md
- [ ] T039 Run quickstart.md's validation scenarios end to end manually and record the results in
      `specs/001-recipe-authoring/quickstart.md` (append an "Executed" note)
- [ ] T040 [P] Pass over error-handling/logging consistency across all handlers in
      `backend/src/handlers/`
- [ ] T041 [P] Accessibility pass (keyboard navigation, labels) on `IngredientGroupEditor`,
      `StepsEditor`, and `LocaleTabs` in `frontend/src/components/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3-5)**: all depend on Foundational completion; US1 and US2 are both P1
  (US2 builds on US1's handlers/components but is independently testable once US1 exists); US3 is
  additive on top of US1/US2
- **Polish (Phase 6)**: depends on the user stories you choose to complete

### User Story Dependencies

- **User Story 1 (P1)**: no dependency on other stories — this is the MVP
- **User Story 2 (P1)**: reuses US1's handlers/components (update/delete vs. create/get) but is
  independently testable against a recipe already created in US1
- **User Story 3 (P2)**: extends US1/US2's handlers and editor page to carry a second locale;
  independently testable against a recipe already created in US1

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel with T001/T002
- Foundational: T007, T008, T011 in parallel once T006/T009 land
- Within each story: all `[P]`-marked test tasks run in parallel; `[P]`-marked component tasks
  (e.g. T020/T021, T031) run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests, in parallel:
Task: "Integration test for POST /recipes in backend/tests/integration/create-recipe.test.ts"
Task: "Unit test for ingredient line validation in backend/tests/unit/ingredient-validation.test.ts"
Task: "Unit test for category normalization in backend/tests/unit/category.test.ts"

# Components, in parallel:
Task: "Build IngredientGroupEditor + IngredientLineRow in frontend/src/components/"
Task: "Build StepsEditor (Tiptap) in frontend/src/components/StepsEditor.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (User Story 1)
3. **STOP and VALIDATE** against quickstart.md's User Story 1 scenario
4. This alone delivers the project's core value: structured recipe authoring, replacing the
   blog-tool ingredient pain point — before editing, multi-language, publishing, or AI assistance
   exist

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. User Story 1 → validate → this is the MVP
3. User Story 2 → validate → full single-language authoring lifecycle
4. User Story 3 → validate → multi-language authoring
5. Polish

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task
- Publishing, AI-assisted translation/approximate-measure suggestions, and category-management
  tooling are explicitly out of scope (spec.md Assumptions) — no tasks for them exist here by
  design
- Commit after each task or logical group, per this repo's existing workflow
