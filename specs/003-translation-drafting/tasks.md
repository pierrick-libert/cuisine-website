# Tasks: Translation Drafting

**Input**: Design documents from `/specs/003-translation-drafting/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/translate-api.md, quickstart.md

**Tests**: Backend tests are included (unit tests for the rich-text extract/reinsert logic, integration tests for the handler). Frontend component tests are also included for this feature — the project has no existing component-test infrastructure, so this feature introduces it (React Testing Library + jsdom), kept deliberately small and scoped to the one new component, which is designed to be self-contained (owns its own loading/error/confirm logic) specifically so it's fully testable without rendering the much larger `RecipeEditorPage`.

**Organization**: Tasks are grouped by user story (from spec.md, in priority order) to enable independent implementation and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Add `@anthropic-ai/sdk` (`^0.133.0`) and `zod` (`^4.6.7`) to `backend/package.json` dependencies, then `npm install` in `backend/`.
- [X] T002 [P] Add frontend component-test infrastructure: `@testing-library/react` (`^16.3.3`), `@testing-library/jest-dom` (`^7.0.1`), `@testing-library/user-event` (`^14.6.8`), and `jsdom` (`^30.1.2`) as devDependencies in `frontend/package.json`; add a `test` block to `frontend/vite.config.ts` (importing `defineConfig` from `vitest/config` instead of `vite` for proper typing) setting `environment: 'jsdom'` and `setupFiles: ['./tests/setup.ts']`; create `frontend/tests/setup.ts` importing `@testing-library/jest-dom/vitest` for the extended matchers. Verified: all 15 existing frontend tests still pass under jsdom, typecheck and lint clean.

**Checkpoint**: Backend can call the Anthropic API; frontend can render and test a React component.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The API surface every user story needs — a reachable, authenticated `POST /translate` route — must exist before any story's logic can be wired up or tested against it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 In `infra/api.ts`: declare `const anthropicApiKey = new sst.Secret('AnthropicApiKey')`; create a `CLP-Translate` SST `Function` (`nodejs24.x` runtime, `handler: 'backend/src/handlers/translate-recipe.handler'`, `environment: { ANTHROPIC_API_KEY: anthropicApiKey.value, ANTHROPIC_MODEL: 'claude-sonnet-5-5' }` — no `link`, this function touches no table or bucket per data-model.md's "no new persisted entity"); add `api.route('POST /translate', translateRecipe.arn, { auth })` inside the existing `addRecipeRoutes` function, protected by the same Cognito JWT authorizer as every other route (contracts/translate-api.md). Bundling smoke-tested via `sst diff` (fails only at the AWS-credential step, same as every prior infra change this session).

**Checkpoint**: `POST /translate` exists as a routed, authenticated endpoint (its handler file is created in Phase 3 — this task's SST wiring can reference that path before the file exists).

---

## Phase 3: User Story 1 - Draft an English translation from a French recipe (Priority: P1) 🎯 MVP

**Goal**: From the editor, one action produces a complete English draft (name, description, group names, ingredient names, every step) that the owner reviews/edits and saves through the existing Save action.

**Independent Test**: Author a French recipe with a name, description, one ingredient group with one ingredient, and one step; trigger the action; confirm English text appears in every one of those fields with no page reload and nothing persisted until the owner separately saves.

### Implementation for User Story 1

- [X] T004 [US1] Create `backend/src/domain/rich-text-translation.ts`: `extractText(doc: RichTextDoc): string[]` walks a Tiptap/ProseMirror JSON document in traversal order and collects every `{type: "text", text: "..."}` node's `text` value into a flat array; `reinsertText(doc: RichTextDoc, translations: string[]): RichTextDoc` walks the *same original* tree in the same order and returns a new tree with each text node's `text` replaced by the corresponding entry at that index — every other node (`type`, `marks`, `attrs`, child ordering, `image` nodes, `bulletList`/`listItem` nesting) is copied unchanged (data-model.md's "Internal shape" section; FR-002).
- [X] T005 [US1] Create `backend/src/handlers/translate-recipe.ts` (depends on T004): validates `name` is non-empty (`400` otherwise, mirroring `assertNonEmptyName` — FR-006); flattens `name`, `description`, each `groupNames` value, each `ingredientNames` value, and each step's `extractText(...)` output into one ordered array; calls `client.messages.parse()` (`@anthropic-ai/sdk`) with `output_config.format` built via `zodOutputFormat()` from a `z.object({ translations: z.array(z.string()) })` schema (research.md — NOT forced `tool_choice`, which returns 400 on `claude-sonnet-5-5`), prompting translation from `sourceLocale` to `targetLocale`; validates the returned `translations.length` exactly equals the number of strings sent — a mismatch (or any Anthropic API error) is a hard failure response, never a partial/best-effort reinsertion (FR-007, data-model.md's validation rules); on success, reassembles the response shape (`name`, `description`, `groupNames`, `ingredientNames`, `steps`), using `reinsertText(...)` for each step (contracts/translate-api.md). Added a new `TranslationError` to `domain/errors.ts` (mapped to `502`), and `TranslateInput`/`TranslateOutput` to `domain/types.ts`.
- [X] T006 [P] [US1] Create `backend/tests/integration/translate-recipe.test.ts` (depends on T005): mocks the Anthropic client (no real API calls — plan.md's Testing section); covers a `400` on missing/empty `name`, a successful call reassembling every field correctly from a mocked `translations` response, and a mocked response whose `translations` array length doesn't match the input triggering the hard-failure path (not a partial splice). Also covers an Anthropic-call-itself-errors case. Found and fixed a real bug while writing the mock: `vi.mock`'s default-export factory must use a regular `function`, not an arrow function, or `new Anthropic()` throws "is not a constructor" (arrow functions have no `[[Construct]]`). All 4 tests pass.
- [X] T007 [P] [US1] Create `frontend/src/services/translationApi.ts`: a `translateRecipe(input)` function calling `POST /translate` (same `fetch`-wrapper pattern as `recipesApi.ts`, including the `Authorization: Bearer` header via `getAccessToken()`), typed per `contracts/translate-api.md`'s request/response shape — the response reuses `recipesApi.ts`'s existing `RawLocaleContent` type (name/description/groupNames/ingredientNames/steps), no new type needed.
- [X] T008 [US1] Create `frontend/src/components/TranslationDraftButton.tsx` (depends on T007): a **self-contained** component — owns its own `generating`/`error` state so it's fully testable in isolation. Props: the current French locale content to send, `hasExistingEnglishContent: boolean`, and `onDraft(translated: RawLocaleContent)`. On click: if `hasExistingEnglishContent` is true, `window.confirm(...)` first (same pattern as the existing recipe-delete confirmation) — decline aborts with no request made (FR-004); otherwise (or on confirm accept) calls `translationApi.ts`'s function, shows a disabled "Generating…" state while in flight, calls `onDraft` with the result on success (FR-005 — replaces every field, since `onDraft`'s caller replaces the whole locale, never merges), and shows an inline error message on failure without calling `onDraft` (FR-007). Disabled whenever the French `name` is empty (FR-006). Positioned next to the locale tabs per mockups/Backoffice.dc.html, labeled to read naturally for the fixed FR→EN direction (e.g. "Generate translation draft (EN)" while viewing French).
- [X] T009 [P] [US1] Create `frontend/tests/unit/TranslationDraftButton.test.tsx` (depends on T002, T008): component-rendering tests (React Testing Library) covering only the happy/error paths for this phase (the confirm-gate tests belong to US3, T013, extending this same file) — disabled when the French name is empty; clicking shows "Generating…" then calls `onDraft` with the translated content on a mocked successful `translateRecipe`; clicking shows an inline error and never calls `onDraft` when `translateRecipe` rejects. Found and fixed a second real bug: RTL's auto-cleanup needs a *global* `afterEach`, which this project doesn't enable (every test file imports Vitest's APIs explicitly) — wired `afterEach(cleanup)` into the shared `tests/setup.ts` instead of turning on `test.globals`. All 3 tests pass; full frontend suite (18 tests) still green.
- [X] T010 [US1] Wire `TranslationDraftButton` into `frontend/src/pages/RecipeEditorPage.tsx` (depends on T008): pass the current French `localeTexts` content, `hasExistingEnglishContent` computed from whether `localeTexts.en` has any non-empty field, and an `onDraft` handler that populates the English locale's local state and switches `activeLocale` to `"en"` — per FR-003, this never calls `createRecipe`/`updateRecipe` itself; the owner must still click the existing "Save changes" button separately to persist anything. Button only renders while viewing the French tab (the fixed translation direction). Typecheck/lint/test all clean.

**Checkpoint**: User Story 1 is independently functional — generating, reviewing, and saving an English draft works end-to-end.

---

## Phase 4: User Story 2 - Formatting in step text survives translation (Priority: P1)

**Goal**: Bold/italic/bullet-list/image formatting in step text survives translation exactly — only the words change.

**Independent Test**: Author a step with a bolded phrase, an italicized phrase, a bullet list, and an inline image; generate a translation draft; confirm the English version has the same bold/italic spans, the same list structure, and the same image, with only the words translated. Fully testable via backend tests alone, independent of any frontend work.

### Tests for User Story 2

- [X] T011 [P] [US2] Create `backend/tests/unit/rich-text-translation.test.ts` (depends on T004): unit tests for `extractText`/`reinsertText` covering — a step with a bolded phrase (the mark is preserved after reinsertion), an italicized phrase, a bullet list (`bulletList`/`listItem` structure, item count, and order all preserved), an inline image node (left completely untouched, never treated as extractable text), and a paragraph with multiple text runs (order preserved on reinsertion). These are the single most correctness-critical tests in this feature (plan.md's Testing section) — pure functions, no network calls. 9/9 pass.
- [X] T012 [US2] Extend `backend/tests/integration/translate-recipe.test.ts` (depends on T006, T011): add one end-to-end scenario sending a step with mixed formatting (bold + bullet list + image) through the full handler (Anthropic client mocked to return a translations array of the correct length), asserting the reassembled step's Tiptap JSON is structurally identical to the input with only `text` values changed (SC-002). Passes; full backend suite still green (16 unit + 29 integration).

**Checkpoint**: User Stories 1 and 2 both work independently — translation is complete and formatting-safe.

---

## Phase 5: User Story 3 - Confirm before overwriting existing English content (Priority: P2)

**Goal**: Triggering translation on a recipe that already has English content asks for confirmation before replacing anything.

**Independent Test**: Give a recipe existing English content; trigger the action; confirm a warning appears; decline and confirm nothing changed; trigger again and accept to confirm full replacement.

**Note**: The confirm-gate production code is already part of `TranslationDraftButton.tsx` from T008 (US1) — one cohesive component, not meaningfully splittable — so this phase, like US2's, is dedicated test depth for behavior the component already implements, mirroring the same shared-code pattern.

### Tests for User Story 3

- [X] T013 [US3] Extend `frontend/tests/unit/TranslationDraftButton.test.tsx` (depends on T009): add component tests mocking `window.confirm` — declining it aborts with `translateRecipe` never called and the existing English content untouched (FR-004); accepting it proceeds with the call as normal (FR-005, verified at the button level: `onDraft` is called with a complete replacement set of fields, not a merge). Both pass; full frontend suite now 20 tests, all green.

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T014 [P] Add TSDoc to every new export (`rich-text-translation.ts`, `translate-recipe.ts`, `translationApi.ts`, `TranslationDraftButton.tsx`), consistent with the project's existing TSDoc standard (`eslint-plugin-tsdoc`, `tsdoc/syntax` lint rule); confirm `npm run lint` passes clean in both `backend/` and `frontend/`.
- [ ] T015 Update the root `README.md` to mention the new translation-drafting capability, matching its existing documentation style.
- [ ] T016 Run `quickstart.md`'s full validation end-to-end (all four scenarios) as final sign-off — requires a real deploy (`npx sst deploy --stage production`) and a real Anthropic API key set via `sst secret set AnthropicApiKey <key> --stage production`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 and T002 are independent of each other.
- **Foundational (Phase 2)**: Depends on T001 (Setup) — BLOCKS all user stories (the route must exist before anything can call it).
- **User Story 1 (Phase 3)**: Depends on Foundational, and on T002 for its component test (T009). No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational and on T004 (the module it tests) from Phase 3 — built alongside US1 since both share `rich-text-translation.ts`, but independently testable and independently valuable (SC-002 holds even without any frontend work from US1).
- **User Story 3 (Phase 5)**: Depends on T008/T009 (the button and its base test file) from Phase 3 — purely additional tests, no new production code.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T001 and T002 (Phase 1) can run in parallel (different packages).
- T006 and T007 (Phase 3) can run in parallel (different files: backend integration test vs. frontend service).
- T009 (Phase 3) and T011 (Phase 4) can run in parallel once T004/T008 exist — different test files with no dependency on each other.
- T014 (Phase 6) can run in parallel with T015/T016.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: generate a translation draft on a real recipe, confirm it populates correctly and saves through the existing Save action.

### Incremental Delivery

1. Setup + Foundational → the route exists, and component tests are possible.
2. User Story 1 → the whole feature works end-to-end (first real milestone — this is the feature's entire point, per spec.md).
3. User Story 2 → formatting-preservation correctness is explicitly, thoroughly tested (the production code already exists from US1; this phase is about proving it, not building more of it).
4. User Story 3 → the confirm-before-overwrite guarantee is explicitly tested (same relationship to US1 as US2's).
5. Polish → documentation and final end-to-end sign-off.
