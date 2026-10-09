# Implementation Plan: Recipe Authoring

**Branch**: `001-recipe-authoring` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-recipe-authoring/spec.md`

## Summary

Build the backoffice capability for the site owner to create, edit, and save draft recipes:
structured ingredient groups/lines, rich-text steps, category/tags, and independent per-locale
text content. This is a backend API (Node/TypeScript Lambdas behind API Gateway, DynamoDB storage)
plus a backoffice SPA (React) that calls it. No publishing, no AI assistance, and no public site
changes are in scope — this feature's boundary is "saved as a draft, retrievable in the
backoffice," per the spec's Assumptions.

## Technical Context

**Language/Version**: TypeScript 7.x on Node.js 26.x (Lambda runtime) for the backend; TypeScript
+ React 19 for the backoffice SPA.

**Primary Dependencies**: AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) for data
access; API Gateway (HTTP API) as the Lambda trigger; a lightweight rich-text editor library for
the steps WYSIWYG (resolved in research.md); React Router for the SPA's two views (recipe list,
recipe editor).

**Storage**: AWS DynamoDB, single table, per the project constitution (no GSIs; full-scan + in-
memory grouping for listing).

**Testing**: Vitest for unit tests (validation/domain logic); integration tests for Lambda handlers
against a local DynamoDB (resolved in research.md).

**Target Platform**: AWS Lambda (Node 26.x) + API Gateway HTTP API for the backend; any evergreen
desktop browser for the backoffice SPA (single user, not a public-facing surface).

**Project Type**: Web application (backend + frontend).

**Performance Goals**: Not a scale-sensitive feature (single user, infrequent use) — a generous,
easy-to-meet target of API responses under 500ms p95 is sufficient; no specific throughput goal.

**Constraints**: Must fit AWS free tier / pay-per-use pricing (Constitution Principle I) — HTTP API
+ Lambda + DynamoDB on-demand, no fixed-cost resources.

**Scale/Scope**: On the order of 100–1000 recipes total; exactly one concurrent editor.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Cost Above All | PASS | HTTP API + Lambda + DynamoDB on-demand are all pay-per-use; no fixed-cost resource introduced. |
| II. Static-First Public Site | N/A | This feature only touches the backoffice; the public static site is untouched. |
| III. Single Exposed Backend Surface | PASS | This feature *is* the one allowed backend surface (the backoffice API). No second API/endpoint is introduced. |
| IV. Simplicity Over Premature Scale | PASS | Single DynamoDB table, no GSIs; recipe listing uses a full scan grouped in memory, matching the project's chosen default at this scale. |
| V. Explicit Over Automatic | PASS | Saving a draft is a plain DynamoDB write with no side effects — it does not trigger publishing or any AI call, both out of scope here. |
| VI. Multi-Language as First-Class | PASS | Data model stores locale content as independent per-locale items from the start, not bolted on. |
| VII. Structured Data Over Free Text | PASS | Ingredients are structured fields; steps are rich text, as the constitution explicitly allows. |

No violations — Complexity Tracking is not needed for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/001-recipe-authoring/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── recipes-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── handlers/          # Lambda entrypoints: one per API operation
│   │   ├── create-recipe.ts
│   │   ├── update-recipe.ts
│   │   ├── get-recipe.ts
│   │   ├── list-recipes.ts
│   │   └── delete-recipe.ts
│   ├── domain/             # Recipe/IngredientGroup/IngredientLine/LocaleContent/Category
│   │                       # types, validation, and category case-fold normalization
│   ├── repository/         # DynamoDB access (recipe-repository.ts, category-repository.ts)
│   └── lib/                # id generation, shared helpers
└── tests/
    ├── unit/               # domain/validation logic
    └── integration/        # handlers against local DynamoDB

frontend/
├── src/
│   ├── components/
│   │   ├── IngredientGroupEditor.tsx
│   │   ├── IngredientLineRow.tsx
│   │   ├── StepsEditor.tsx       # rich-text WYSIWYG
│   │   ├── LocaleTabs.tsx
│   │   └── CategoryTagPicker.tsx
│   ├── pages/
│   │   ├── RecipeListPage.tsx
│   │   └── RecipeEditorPage.tsx
│   └── services/
│       └── recipesApi.ts
└── tests/
    └── unit/
```

**Structure Decision**: Web application structure (`backend/` + `frontend/`), matching this
feature's shape of a Lambda API plus a browser SPA. This mirrors the overall project architecture
(backoffice is the one exposed backend surface; the public static site is a separate, later
feature and will live in its own top-level directory, e.g. `site/`, when built).

## Complexity Tracking

*No Constitution Check violations — section intentionally left empty.*
