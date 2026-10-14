# Implementation Plan: Translation Drafting

**Branch**: `003-translation-drafting` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-translation-drafting/spec.md`

## Summary

Add a single, explicit "Generate translation draft" action to the backoffice recipe editor that
calls the Claude API to translate a recipe's French content (name, description, ingredient group
names, ingredient names, every step's rich text) into an English draft, preserving step formatting
exactly. The draft only populates the editor's in-browser state — it is never auto-saved or
auto-published, consistent with the project's "explicit over automatic" principle. A new stateless
backend endpoint (`POST /translate`) does the actual translation; no database or recipe-id
involved.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24.x LTS — unchanged from 001/002.

**Primary Dependencies**: `@anthropic-ai/sdk` (0.133.0) for the Claude API call; `zod` (4.6.7) to
define the structured-output schema via the SDK's `zodOutputFormat()` helper. No new frontend
dependency.

**Storage**: None for this feature — the new endpoint is stateless (no DynamoDB, no S3). The
existing recipe data model (001) and its persistence are completely unchanged.

**Testing**: Vitest (existing, unchanged). The rich-text extract/reinsert tree-walking logic is
unit-tested as pure functions (no network). The handler's integration test mocks the Anthropic
client — no real Anthropic API calls in CI, mirroring how 002's CI test job needs no AWS
credentials either.

**Target Platform**: AWS Lambda behind the existing API Gateway HTTP API (same Cognito JWT
authorizer as every other route) — extends 002's already-deployed infrastructure, no new AWS
service introduced.

**Project Type**: Web application (extends the existing `backend/`/`frontend/` monorepo — one new
backend handler, one new frontend service call and UI affordance, no new "project").

**Performance Goals**: Not performance-sensitive — a single Claude API call per click, a few
seconds is acceptable (same stance as 001/002's plans).

**Constraints**: Cost Above All (Claude API billed per-token, pay-per-use; no new fixed-cost AWS
resource); Explicit Over Automatic (the action is only ever user-triggered, never automatic or
bulk, per FR-008); the Anthropic API key is a secret, never logged or exposed to the frontend.

**Scale/Scope**: Single owner, one recipe translated at a time — matches 001/002.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Cost Above All | PASS | Claude API is billed per-token (pay-per-use); the new Lambda is pay-per-invocation. No fixed-cost resource introduced. |
| II. Static-First Public Site | N/A | This feature only touches the backoffice; no public-site change. |
| III. Single Exposed Backend Surface | PASS | `POST /translate` is added to the existing backoffice API Gateway — not a new surface. |
| IV. Simplicity Over Premature Scale | PASS | Stateless endpoint, no new data store, no indexing, a single Claude call per request. |
| V. Explicit Over Automatic | PASS | This principle names this exact feature as its canonical example ("clicking 'Generate translation draft'") — the action is a single, deliberate, one-recipe-at-a-time click, never automatic or bulk (FR-008). |
| VI. Multi-Language as a First-Class Concern | PASS | Directly implements this principle's AI-translation clause: produces an editable draft, never silently replaces or auto-publishes (FR-003, FR-004, FR-005). |
| VII. Structured Data Over Free Text | N/A | No change to ingredient storage; reinforces (doesn't violate) the existing allowance for rich-text step content. |

No violations — Complexity Tracking is not needed for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/003-translation-drafting/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── translate-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── handlers/
│   │   └── translate-recipe.ts         # NEW — POST /translate
│   ├── domain/
│   │   └── rich-text-translation.ts    # NEW — Tiptap JSON extract/reinsert (pure functions)
│   └── ...                             # existing handlers/repository, unchanged
└── tests/
    ├── unit/
    │   └── rich-text-translation.test.ts # NEW
    └── integration/
        └── translate-recipe.test.ts    # NEW — Anthropic client mocked

frontend/
└── src/
    ├── services/
    │   └── translationApi.ts           # NEW — calls POST /translate
    ├── components/
    │   └── TranslationDraftButton.tsx  # NEW — the "Generate translation draft" action
    └── pages/
        └── RecipeEditorPage.tsx        # MODIFIED — wires the new button in

infra/
├── storage.ts                          # unchanged
└── api.ts                              # MODIFIED — new Function + route + sst.Secret
```

**Structure Decision**: Follows 001/002's existing `backend/`/`frontend/`/`infra/` layout exactly —
one new handler, one new pure-function module (the part most worth unit-testing in isolation), one
new frontend service module and one new small component, and `infra/api.ts` gains one more
function/route/secret alongside the ones already there. No new top-level directory, no
restructuring of either package.

## Complexity Tracking

*No Constitution Check violations — section intentionally left empty.*
