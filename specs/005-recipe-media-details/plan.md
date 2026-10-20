# Implementation Plan: Recipe Media and Serving Details

**Branch**: `005-recipe-media-details` | **Date**: 2026-10-20 | **Spec**: `specs/005-recipe-media-details/spec.md`

**Input**: Feature specification from `specs/005-recipe-media-details/spec.md`

## Summary

Add three new optional recipe-level fields (prep minutes, cook minutes, base servings) and an
optional cover image to the existing `RecipeMeta` entity, with backoffice authoring UI for all
four; thread them through 004's publish pipeline (`render-recipe.ts`, `rebuild-index.ts`) into the
public site's render data and browse index; and make the recipe detail page's servings control and
ingredient quantities (including the already-modeled but never-rendered approximate equivalent)
interactive client-side, scaling proportionally with no page reload and no metric/imperial
conversion.

## Technical Context

**Language/Version**: TypeScript, Node 24 LTS (unchanged from 001-004)

**Primary Dependencies**: Existing stack only — no new dependency. Backend: AWS SDK v3
(`@aws-sdk/client-s3`, `@aws-sdk/lib-dynamodb`). Public site: Eleventy 3.1.7 (Nunjucks), Alpine.js
(CDN, already used by `browse.js`). Frontend: React 19 (existing recipe edit form).

**Storage**: DynamoDB single table (`CLP-RecipesTable`), existing `RECIPE#<id>/META` item extended
with new attributes; existing `RECIPE#<id>/PUBLISHED#<locale>` snapshot item extended with the
cover image URL. S3: existing `clp-cuisine-website-images` bucket (already `access: 'public'`, no
infra change) for cover images; existing `clp-cuisine-website-public` bucket for rendered output.

**Testing**: Vitest (backend unit + integration, public-site unit), existing TDD discipline
(failing test before implementation) — unchanged from 001-004.

**Target Platform**: Same as 004 — Lambda (backend + pipeline), S3+CloudFront (public site),
S3+CloudFront+Cognito (backoffice SPA).

**Project Type**: Web application (existing `backend/`, `frontend/`, `public-site/`, `infra/`
structure from 001-004 — no new top-level project).

**Performance Goals**: N/A beyond existing goals — servings scaling is pure client-side arithmetic
over data already on the page (Principle II), no new network request.

**Constraints**: No new AWS infrastructure (Principle I — the images bucket and its public access
already exist from 002); no metric/imperial conversion (explicitly out of scope, locked during
scoping); all four new fields optional and backward-compatible with every recipe published under
004 (FR-009).

**Scale/Scope**: Same as the rest of the project — on the order of 100-1000 recipes (Principle
IV). Three new User Stories (P1: time/servings fields, P2: cover image, P3: interactive scaling).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Cost Above All**: PASS. No new AWS resource. The images bucket (already `access: 'public'`,
  already pay-per-request) absorbs cover images at no new fixed cost.
- **II. Static-First Public Site**: PASS. Servings scaling is implemented as client-side
  JavaScript over data already embedded in the static page (an inline `<script>` JSON blob or data
  attributes, consistent with how `browse.js` already fetches `browse-index.json` rather than
  hitting a server). No server-side process runs at visitor request time. The constitution's own
  Principle II text names "servings multiplier" as an expected example of this pattern.
- **III. Single Exposed Backend Surface**: PASS. No new backend surface — the existing
  Cognito-authenticated backoffice API gains new fields on the existing `PUT /recipes/{id}`
  contract and reuses the existing `POST /images` endpoint; the public site remains static.
- **IV. Simplicity Over Premature Scale**: PASS. Explicitly excluding metric/imperial conversion
  (a materially more complex feature with no concrete current need) is itself an application of
  this principle, not a deferral the constitution forbids — Principle II lists it as a future
  client-side pattern the architecture supports, not a requirement of every feature.
- **V. Explicit Over Automatic**: PASS. No new costed operation is introduced; uploading a cover
  image or editing time/servings are both routine editing actions (not a Publish/AI-assist
  equivalent) and correctly do not trigger the pipeline themselves — only the existing explicit
  Publish action does.
- **VI. Multi-Language as a First-Class Concern**: PASS (by design choice, documented in
  Assumptions). Prep/cook time, servings, and the cover image are recipe-level, not per-locale,
  matching how ingredient quantity/unit/approxEquivalent are already recipe-level in 001's data
  model split — none of these four new fields are translatable text.
- **VII. Structured Data Over Free Text**: PASS. This feature finally renders the
  `approxEquivalent` structured field that 001 already modeled for exactly this purpose
  (servings scaling) but never displayed.

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-recipe-media-details/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/types.ts              # RecipeMeta gains 4 new optional fields; PublishedSnapshot gains coverImageUrl
│   ├── repository/recipe-repository.ts   # persist/read the 4 new fields
│   ├── handlers/create-recipe.ts, update-recipe.ts  # accept the 4 new fields in RecipeInput
│   └── pipeline/render-recipe.ts, rebuild-index.ts  # thread the fields into render data + browse index
└── tests/

public-site/
├── src/render.ts                    # RecipeRenderData/BrowseIndexEntry shape gains the new fields; ingredientGroups lines become structured, not flattened text
├── templates/recipe-detail.njk      # hero image, prep/cook/servings line, interactive ingredient list
├── templates/category-shell.njk, home.njk  # recipe-card thumbnail
├── assets/recipe.js                 # NEW — Alpine component for servings scaling (mirrors browse.js's existing pattern)
├── assets/style.css                 # hero image, meta line, card thumbnail styles
└── tests/

frontend/
├── src/pages/RecipeEditorPage.tsx          # new fields: prep/cook minutes, servings, cover image upload, alongside existing CategoryTagPicker
├── src/components/CoverImageUpload.tsx     # NEW — the first actual caller of POST /images (002's contracts/images-api.md); StepsEditor.tsx only inserts by URL today, so there is no existing upload UI to reuse, only the backend contract
├── src/services/imagesApi.ts               # NEW — requestImageUploadUrl() + the direct PUT to the presigned URL
├── src/services/recipesApi.ts              # RecipeInput/response types gain the 4 new fields
└── tests/
```

**Structure Decision**: Reuses the existing `backend/` + `frontend/` + `public-site/` + `infra/`
structure from 001-004 unchanged — this feature adds fields and rendering logic within that
structure, it does not introduce a new project or package.
