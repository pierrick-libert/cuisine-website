# Tasks: Translation Drafting

**Input**: Design documents from `/specs/003-translation-drafting/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/translate-api.md, quickstart.md

**Tests**: Backend tests are included (unit tests for the rich-text extract/reinsert logic, integration tests for the handler) — explicitly called for in plan.md's Testing section and spec.md's User Story 2. No frontend component tests are added: the project has no existing component-test infrastructure (React Testing Library/jsdom) for any page or component, and introducing one is out of scope for this feature — the confirm-dialog/button UI is validated manually per quickstart.md.

**Organization**: Tasks are grouped by user story (from spec.md, in priority order) to enable independent implementation and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Add `@anthropic-ai/sdk` (`^0.133.0`) and `zod` (`^4.6.7`) to `backend/package.json` dependencies, then `npm install` in `backend/`.

**Checkpoint**: Dependencies available for the handler to import.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The API surface every user story needs — a reachable, authenticated `POST /translate` route — must exist before any story's logic can be wired up or tested against it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 In `infra/api.ts`: declare `const anthropicApiKey = new sst.Secret('AnthropicApiKey')`; create a `CLP-Translate` SST `Function` (`nodejs24.x` runtime, `handler: 'backend/src/handlers/translate-recipe.handler'`, `environment: { ANTHROPIC_API_KEY: anthropicApiKey.value, ANTHROPIC_MODEL: 'claude-sonnet-5-5' }` — no `link`, this function touches no table or bucket per data-model.md's "no new persisted entity"); add `api.route('POST /translate', translateRecipe.arn, { auth })` inside the existing `addRecipeRoutes` function, protected by the same Cognito JWT authorizer as every other route (contracts/translate-api.md).

**Checkpoint**: `POST /translate` exists as a routed, authenticated endpoint (its handler file is created in Phase 3 — this task's SST wiring can reference that path before the file exists; `sst dev`/`deploy` only needs it to exist by the time of an actual deploy).

---

## Phase 3: User Story 1 - Draft an English translation from a French recipe (Priority: P1) 🎯 MVP

**Goal**: From the editor, one action produces a complete English draft (name, description, group names, ingredient names, every step) that the owner reviews/edits and saves through the existing Save action.

**Independent Test**: Author a French recipe with a name, description, one ingredient group with one ingredient, and one step; trigger the action; confirm English text appears in every one of those fields with no page reload and nothing persisted until the owner separately saves.

### Implementation for User Story 1

- [ ] T003 [US1] Create `backend/src/domain/rich-text-translation.ts`: `extractText(doc: RichTextDoc): string[]` walks a Tiptap/ProseMirror JSON document in traversal order and collects every `{type: "text", text: "..."}` node's `text` value into a flat array; `reinsertText(doc: RichTextDoc, translations: string[]): RichTextDoc` walks the *same original* tree in the same order and returns a new tree with each text node's `text` replaced by the corresponding entry at that index — every other node (`type`, `marks`, `attrs`, child ordering, `image` nodes, `bulletList`/`listItem` nesting) is copied unchanged (data-model.md's "Internal shape" section; FR-002).
- [ ] T004 [US1] Create `backend/src/handlers/translate-recipe.ts` (depends on T003): validates `name` is non-empty (`400` otherwise, mirroring `assertNonEmptyName` — FR-006); flattens `name`, `description`, each `groupNames` value, each `ingredientNames` value, and each step's `extractText(...)` output into one ordered array; calls `client.messages.parse()` (`@anthropic-ai/sdk`) with `output_config.format` built via `zodOutputFormat()` from a `z.object({ translations: z.array(z.string()) })` schema (research.md — NOT forced `tool_choice`, which returns 400 on `claude-sonnet-5-5`), prompting translation from `sourceLocale` to `targetLocale`; validates the returned `translations.length` exactly equals the number of strings sent — a mismatch (or any Anthropic API error) is a hard failure response, never a partial/best-effort reinsertion (FR-007, data-model.md's validation rules); on success, reassembles the response shape (`name`, `description`, `groupNames`, `ingredientNames`, `steps`), using `reinsertText(...)` for each step (contracts/translate-api.md).
- [ ] T005 [P] [US1] Create `backend/tests/integration/translate-recipe.test.ts` (depends on T004): mocks the Anthropic client (no real API calls — plan.md's Testing section); covers a `400` on missing/empty `name`, a successful call reassembling every field correctly from a mocked `translations` response, and a mocked response whose `translations` array length doesn't match the input triggering the hard-failure path (not a partial splice).
- [ ] T006 [P] [US1] Create `frontend/src/services/translationApi.ts`: a `translateRecipe(input)` function calling `POST /translate` (same `fetch`-wrapper pattern as `recipesApi.ts`, including the `Authorization: Bearer` header via `getAccessToken()`), typed per `contracts/translate-api.md`'s request/response shape.
- [ ] T007 [US1] Create `frontend/src/components/TranslationDraftButton.tsx` (depends on T006): renders the "Generate translation draft" action (mockups/Backoffice.dc.html's position, next to the locale tabs — label adjusted to read naturally for the fixed FR→EN direction, e.g. "Generate translation draft (EN)" while viewing French); disabled when the French `name` is empty (FR-006); shows a disabled "Generating…" state while the request is in flight; calls `translationApi.ts`'s function with the current in-browser French locale content; on success, calls an `onDraft` callback with the translated locale content (component itself holds no page-level state, matching the project's existing component style).
- [ ] T008 [US1] Wire `TranslationDraftButton` into `frontend/src/pages/RecipeEditorPage.tsx` (depends on T007): on a successful draft, populate the English locale's local `localeTexts` state and switch `activeLocale` to `"en"` — per FR-003, this never calls `createRecipe`/`updateRecipe` itself; the owner must still click the existing "Save changes" button separately to persist anything.
- [ ] T009 [US1] In `RecipeEditorPage.tsx` (depends on T008): surface a translation failure using the same inline error-message pattern already used for save failures (FR-007) — existing French and English state must be completely unaffected by a failed attempt.

**Checkpoint**: User Story 1 is independently functional — generating, reviewing, and saving an English draft works end-to-end.

---

## Phase 4: User Story 2 - Formatting in step text survives translation (Priority: P1)

**Goal**: Bold/italic/bullet-list/image formatting in step text survives translation exactly — only the words change.

**Independent Test**: Author a step with a bolded phrase, an italicized phrase, a bullet list, and an inline image; generate a translation draft; confirm the English version has the same bold/italic spans, the same list structure, and the same image, with only the words translated. Fully testable via backend tests alone, independent of any frontend work.

### Tests for User Story 2

- [ ] T010 [P] [US2] Create `backend/tests/unit/rich-text-translation.test.ts` (depends on T003): unit tests for `extractText`/`reinsertText` covering — a step with a bolded phrase (the mark is preserved after reinsertion), an italicized phrase, a bullet list (`bulletList`/`listItem` structure, item count, and order all preserved), an inline image node (left completely untouched, never treated as extractable text), and a paragraph with multiple text runs (order preserved on reinsertion). These are the single most correctness-critical tests in this feature (plan.md's Testing section) — pure functions, no network calls.
- [ ] T011 [US2] Extend `backend/tests/integration/translate-recipe.test.ts` (depends on T005, T010): add one end-to-end scenario sending a step with mixed formatting (bold + bullet list + image) through the full handler (Anthropic client mocked to return a translations array of the correct length), asserting the reassembled step's Tiptap JSON is structurally identical to the input with only `text` values changed (SC-002).

**Checkpoint**: User Stories 1 and 2 both work independently — translation is complete and formatting-safe.

---

## Phase 5: User Story 3 - Confirm before overwriting existing English content (Priority: P2)

**Goal**: Triggering translation on a recipe that already has English content asks for confirmation before replacing anything.

**Independent Test**: Give a recipe existing English content; trigger the action; confirm a warning appears; decline and confirm nothing changed; trigger again and accept to confirm full replacement.

### Implementation for User Story 3

- [ ] T012 [US3] In `RecipeEditorPage.tsx` (depends on T008): before invoking the translation action, check whether `localeTexts.en` already has any non-empty field; if so, use `window.confirm` (same pattern already used for recipe deletion) before proceeding — declining aborts with no request made and no change to existing content (FR-004); accepting replaces every field the draft covers (name, description, every group name, every ingredient name, every step) rather than merging field-by-field (FR-005).

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T013 [P] Add TSDoc to every new export (`rich-text-translation.ts`, `translate-recipe.ts`, `translationApi.ts`, `TranslationDraftButton.tsx`), consistent with the project's existing TSDoc standard (`eslint-plugin-tsdoc`, `tsdoc/syntax` lint rule); confirm `npm run lint` passes clean in both `backend/` and `frontend/`.
- [ ] T014 Update the root `README.md` to mention the new translation-drafting capability, matching its existing documentation style.
- [ ] T015 Run `quickstart.md`'s full validation end-to-end (all four scenarios) as final sign-off — requires a real deploy (`npx sst deploy --stage production`) and a real Anthropic API key set via `sst secret set AnthropicApiKey <key> --stage production`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the route must exist before anything can call it).
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational and on T003 (the module it tests) from Phase 3 — in practice built alongside US1 since both share `rich-text-translation.ts`, but independently testable and independently valuable (SC-002 holds even if no frontend work from US1 existed yet).
- **User Story 3 (Phase 5)**: Depends on T008 (the button wired into the page) from Phase 3 — a frontend-only addition layered on top of US1's UI, touches no backend code.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T005 and T006 (Phase 3) can run in parallel (different files: backend integration test vs. frontend service).
- T010 (Phase 4) can run in parallel with T005/T006 once T003 exists — it tests the same module T004 consumes, but is a separate file with no dependency on the handler itself.
- T013 (Phase 6) can run in parallel with T014/T015.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: generate a translation draft on a real recipe, confirm it populates correctly and saves through the existing Save action.

### Incremental Delivery

1. Setup + Foundational → the route exists.
2. User Story 1 → the whole feature works end-to-end (first real milestone — this is the feature's entire point, per spec.md).
3. User Story 2 → formatting-preservation correctness is explicitly, thoroughly tested (the production code already exists from US1; this phase is about proving it, not building more of it).
4. User Story 3 → the safety-net confirmation guard layers on top, with zero backend changes.
5. Polish → documentation and final end-to-end sign-off.
