# Implementation Plan: Deploy Infrastructure

**Branch**: `002-deploy-infrastructure` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-deploy-infrastructure/spec.md`

## Summary

Provision the Recipe Authoring backend and backoffice frontend as real AWS infrastructure via
SST v4; protect the backoffice API and SPA with Cognito authentication (self-sign-up disabled —
accounts exist only via manual AWS Console creation); establish a GitHub Actions pipeline that
tests every PR and deploys automatically on merge to main using the already-created OIDC deploy
role; and provision an S3 bucket for recipe images with a minimal presigned-upload endpoint.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24.x LTS — unchanged from 001-recipe-authoring
(pinned below the newer 7.x because `typescript-eslint` still does not support it as of
2026-10-11, re-verified).

**Primary Dependencies**: SST v4.17.2 (infrastructure-as-code, Pulumi-based); `@aws-sdk/client-s3`
+ `@aws-sdk/s3-request-presigner` (3.1149.0) for the image-upload endpoint; no new frontend
dependency for auth (Cognito's Hosted UI is a plain redirect + one token-exchange `fetch` call —
see research.md).

**Storage**: The existing DynamoDB table (unchanged schema) plus a new S3 bucket for images.

**Testing**: Vitest (existing, unchanged). Infrastructure itself is validated via the quickstart
scenarios below rather than unit tests, since there is no meaningful way to unit-test "is this
Lambda actually deployed" — the existing backend/frontend test suites continue to gate every PR.

**Target Platform**: AWS, eu-central-1 — Lambda, API Gateway HTTP API (with a Cognito JWT
authorizer), DynamoDB, S3, CloudFront, Cognito User Pool. GitHub Actions for CI/deploy.

**Project Type**: Web application infrastructure (extends the existing `backend/`/`frontend/`
monorepo structure with an SST app and a CI workflow — no new application "project").

**Performance Goals**: Not performance-sensitive — standard web latency expectations, no specific
target, consistent with 001's plan.

**Constraints**: Cost Above All (every resource pay-per-use, no fixed-cost item); single
production stage only (Constitution Principle IV — no preview environments, no multi-region); no
long-lived AWS credential anywhere in the repository or CI configuration.

**Scale/Scope**: Single owner/user; personal-project traffic volume (matches 001).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Cost Above All | PASS | SST + Lambda + HTTP API + DynamoDB on-demand + S3 + CloudFront + Cognito are all pay-per-use; Cognito's free tier (50,000 MAUs) comfortably covers a single user. No fixed-cost resource introduced. |
| II. Static-First Public Site | N/A / consistent | The public recipe site itself is a separate, later feature — but the backoffice SPA is hosted the same static-first way (S3+CloudFront via SST's `StaticSite`), matching the principle's spirit even though it doesn't literally apply here. |
| III. Single Exposed Backend Surface | PASS | Still only the backoffice API is exposed; this feature adds authentication to it rather than introducing a second surface. The image-upload endpoint is part of the same backoffice API, not a new surface. |
| IV. Simplicity Over Premature Scale | PASS | One SST stage ("production"), no per-PR preview environments, no multi-region — matches what was explicitly decided during brainstorming. |
| V. Explicit Over Automatic | PASS | Secrets are set explicitly by the owner via `sst secret set`, never auto-populated; the automatic-deploy-on-merge behavior was itself an explicit, deliberate decision (the "costed action" here is the deliberate act of merging, not a routine save). |
| VI. Multi-Language as First-Class | N/A | No locale-related change in this feature. |
| VII. Structured Data Over Free Text | N/A | No recipe data-model change in this feature. |

No violations — Complexity Tracking is not needed for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/002-deploy-infrastructure/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── images-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
sst.config.ts                  # SST app entry point — app name/naming convention, region, stage

infra/
├── iam/                       # Existing — the already-completed manual OIDC/IAM setup
├── auth.ts                    # NEW — CognitoUserPool + Client (self-sign-up disabled, Hosted UI)
├── storage.ts                 # NEW — Dynamo table + images S3 bucket (explicit CLP-/clp- names)
├── api.ts                     # NEW — Function(s) + ApiGatewayV2 + routes, Cognito JWT authorizer
└── web.ts                     # NEW — StaticSite hosting the backoffice SPA

backend/
├── src/
│   ├── handlers/
│   │   └── create-image-upload-url.ts   # NEW — presigned S3 upload URL endpoint
│   └── ...                              # existing handlers, unchanged
└── tests/
    └── integration/
        └── create-image-upload-url.test.ts  # NEW

frontend/
└── src/
    ├── services/
    │   ├── auth.ts             # NEW — Cognito Hosted UI redirect + token exchange/storage
    │   └── recipesApi.ts       # MODIFIED — attach the stored access token as a Bearer header
    └── pages/
        └── SignInCallbackPage.tsx  # NEW — handles the Hosted UI's OAuth2 redirect back

.github/
└── workflows/
    └── ci.yml                  # NEW — PR test job; main-branch test+deploy job via OIDC
```

**Structure Decision**: Infrastructure code lives in `infra/*.ts` files imported by a root
`sst.config.ts` (SST's required entry-point location), alongside the existing `infra/iam/`
reference docs from the prior brainstorming session. `backend/` and `frontend/` keep their
existing structure from 001, gaining one new handler and one new service module respectively —
no restructuring of either package.

## Complexity Tracking

*No Constitution Check violations — section intentionally left empty.*
