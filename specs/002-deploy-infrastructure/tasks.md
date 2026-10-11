---

description: "Task list for feature implementation"
---

# Tasks: Deploy Infrastructure

**Input**: Design documents from `/specs/002-deploy-infrastructure/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth.md, contracts/images-api.md, quickstart.md

**Tests**: Only one test is explicitly called for by the design docs (`create-image-upload-url.test.ts`, per plan.md's Project Structure and quickstart.md's Automated coverage) — infrastructure wiring itself is validated via the quickstart scenarios, not unit tests, per plan.md's Testing rationale.

**Organization**: Tasks are grouped by user story (from spec.md, in priority order) to enable independent implementation and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the SST app itself, shared by every later phase.

- [X] T001 Add `sst` `4.17.2` as a root-level dependency (`package.json` at repo root) and create `sst.config.ts` with `app` name `"CLP"`, `region` `eu-central-1`, and a single `"production"` stage (per research.md's SST app naming convention and plan.md's Constraints — no preview stages).
- [X] T002 [P] Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (`3.1149.0` each, per research.md's verified dependency versions) to `backend/package.json`.
- [X] T003 [P] Create the `.github/workflows/` directory and an empty `.github/workflows/ci.yml` placeholder (filled in Phase 5, US3) so the directory exists for Phase 1 verification.

**Checkpoint**: `sst.config.ts` exists and `npx sst deploy --stage production` can run (with no resources yet).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every user story's deployment depends on — the data table all backend handlers read/write, and the auth provider US2 and the API authorizer both need to already exist.

**⚠️ CRITICAL**: No user story phase can be deployed/validated until this phase is complete.

- [X] T004 Create `infra/storage.ts` defining the existing DynamoDB table (unchanged schema per data-model.md) as an SST `Dynamo` component, with its physical name explicitly set to start with `CLP-` (e.g. `CLP-RecipesTable`) — per research.md, this is required for the already-provisioned `CLP-GitHubActionsPermissions` policy to match it; matches the single-table schema already created by `backend/src/lib/create-table.ts`.
- [X] T005 [P] Create `infra/auth.ts` defining a Cognito User Pool + App Client as SST components: Hosted UI enabled, `selfSignUpEnabled` explicitly set to `false` (FR-004 — no self-service registration anywhere), OAuth2 Authorization Code flow configured per contracts/auth.md's sign-in flow, physical name starting with `CLP-` (e.g. `CLP-UserPool`). Implementation note: the actual App Client (needing the backoffice's callback URL) is created via `addAuthClient(webUrl)`, exported from `infra/auth.ts` and invoked from `sst.config.ts` once `infra/web.ts`'s URL exists (T009) — the Hosted UI domain and self-sign-up-disabled User Pool itself are created here, unconditionally.
- [X] T006 Update `sst.config.ts` to import and instantiate `infra/storage.ts` and `infra/auth.ts`.

**Checkpoint**: Foundation ready — `npx sst deploy --stage production` provisions the DynamoDB table and Cognito User Pool; user story implementation can now begin.

---

## Phase 3: User Story 1 - Use the backoffice from anywhere (Priority: P1) 🎯 MVP

**Goal**: The owner can reach a real, non-`localhost` backoffice URL from any device and it behaves identically to the local dev version, persisting to real cloud storage.

**Independent Test**: Open the deployed backoffice URL on a device that never ran `npm run dev`, create a recipe, close and reopen the browser, confirm it is still there.

### Implementation for User Story 1

- [X] T007 [US1] Create `infra/api.ts` — SST `Function` components wrapping each existing handler in `backend/src/handlers/` (`create-recipe.ts`, `get-recipe.ts`, `list-recipes.ts`, `update-recipe.ts`, `delete-recipe.ts`) plus an `ApiGatewayV2` HTTP API exposing the `/recipes*` routes (per FR-001 and FR-010 — no other API surface), each function linked to the `infra/storage.ts` DynamoDB table for automatic least-privilege IAM (per plan.md's SST rationale), physical Lambda names starting with `CLP-`.
- [X] T008 [US1] Create `infra/web.ts` — an SST `StaticSite` component hosting `frontend/` (built via its existing `npm run build`), fronted by CloudFront, with the underlying bucket's physical name starting with lowercase `clp-` (FR-002). Implementation note: `StaticSite` has no prop to name its own auto-created bucket, so an explicit `clp-web` `sst.aws.Bucket` is created and handed to it via `assets.bucket` — this specific combination is not verified end-to-end against a real deploy yet (see T011).
- [X] T009 [US1] Update `sst.config.ts` to import and instantiate `infra/api.ts` and `infra/web.ts`, exporting the API's base URL and the site's public URL as SST outputs.
- [X] T010 [US1] Update `frontend/src/services/recipesApi.ts` to read the deployed API's base URL from a build-time environment variable populated from the `infra/web.ts` `StaticSite`'s linked API URL, instead of the local dev proxy path used in 001.
- [ ] T011 [US1] Run `npx sst deploy --stage production` and validate quickstart.md's User Story 1 scenario: open the deployed URL on a device that never ran local dev, create a recipe, confirm it persists after reload. **Blocked on the owner's own machine** — this sandbox has no working AWS credentials (`~/.aws/credentials` token is invalid/expired) and the first deploy is meant to run from the owner's machine per quickstart.md, not CI. Deferred until all remaining phases' IaC is written, so it can be validated once instead of per-phase.

**Checkpoint**: User Story 1 is independently deployed and testable — the backoffice works from a real URL, unauthenticated (auth added next).

---

## Phase 4: User Story 2 - Only the owner can access the backoffice (Priority: P1)

**Goal**: No unauthenticated UI or API access is possible anywhere; the only account exists via manual AWS Console creation; the owner can sign in and use the backoffice normally.

**Independent Test**: Attempt to reach the backoffice/API unauthenticated (must be rejected); confirm no registration UI or endpoint exists anywhere; sign in with a manually-provisioned account (must succeed).

### Implementation for User Story 2

- [X] T012 [US2] Add a Cognito JWT authorizer to `infra/api.ts`'s `ApiGatewayV2`, backed by the `infra/auth.ts` User Pool + App Client, applied to every `/recipes*` route (FR-003 — no route is exempt). Implementation note: wired in `sst.config.ts` (not inside `infra/api.ts` itself) via `addRecipeRoutes(authorizer.id)`, since the authorizer depends on the auth client which depends on `web.url` — see the dependency-order comment there.
- [X] T013 [US2] Confirm `infra/auth.ts`'s self-sign-up setting (from T005) is actually enforced post-deploy — no sign-up link appears on the Hosted UI sign-in page (FR-004). Implementation note: enforced via the Cognito-native `adminCreateUserConfig.allowAdminCreateUserOnly: true` (verified against the real Pulumi AWS provider types, `.sst/platform/node_modules/@pulumi/aws/types/input.d.ts`) — there is no literal `selfSignUpEnabled` prop, this is the actual mechanism. Post-deploy visual confirmation (no sign-up link on the real Hosted UI page) is still pending, bundled into T018.
- [X] T014 [P] [US2] Create `frontend/src/services/auth.ts` — redirects to the Cognito Hosted UI sign-in page, exchanges the returned authorization code for tokens with one `POST` to the User Pool's `/oauth2/token` endpoint, stores the access and refresh tokens, and refreshes the access token transparently on expiry (per contracts/auth.md's sign-in flow steps). The Hosted UI domain/client id are fetched at runtime from `/auth-config.json` (see `sst.config.ts`'s `AuthConfig` bucket object) rather than baked in at build time, to avoid a genuine circular dependency (the app client needs the site's own URL).
- [X] T015 [P] [US2] Create `frontend/src/pages/SignInCallbackPage.tsx` — handles the Hosted UI's OAuth2 redirect (`?code=...`), calls `auth.ts`'s token-exchange function, then navigates back into the app.
- [X] T016 [US2] Update `frontend/src/services/recipesApi.ts` (depends on T014) to attach the stored access token as an `Authorization: Bearer <token>` header on every request to the backoffice API.
- [X] T017 [US2] Add a route guard in `frontend/src/App.tsx` that redirects any unauthenticated visitor to the Cognito Hosted UI sign-in page before any backoffice route renders.
- [ ] T018 [US2] Create the one production account manually via the AWS Console (Cognito → the `CLP-*` User Pool → Users → Create user, per quickstart.md Setup) and validate quickstart.md's User Story 2 scenario: unauthenticated UI/API access is rejected (`401` from the API), no sign-up link/endpoint exists anywhere, and sign-in with the manually-created account succeeds. **Blocked on the owner's own machine**, same as T011 — requires a real deploy and a manual AWS Console action.

**Checkpoint**: User Stories 1 and 2 both work independently — the backoffice is live and access-restricted to the owner only.

---

## Phase 5: User Story 3 - Ship changes without a manual deploy step (Priority: P2)

**Goal**: Tests run on every PR; merges to `main` with passing tests deploy automatically via the existing OIDC role; failing tests never deploy.

**Independent Test**: Merge a trivial passing change to `main` and confirm it goes live with no manual action; propose a change with a failing test and confirm it's never deployed.

### Implementation for User Story 3

- [X] T019 [US3] Fill in `.github/workflows/ci.yml`'s test job: on `pull_request`, run `backend`'s `npm run typecheck && npm run lint && npm test` and `frontend`'s `npx tsc --noEmit && npm run lint && npm test` (per the root README's Scripts Reference) — no AWS credentials requested for this job (FR-006). Also starts/creates DynamoDB Local for the backend's integration tests, per its existing local-dev scripts.
- [X] T020 [US3] Add a deploy job to `.github/workflows/ci.yml`: triggered on `push` to `main`, `needs: test`, authenticates via `aws-actions/configure-aws-credentials@v6.3.0` assuming the `AWS_DEPLOY_ROLE_ARN` GitHub Actions secret (no long-lived credential, per FR-007) in region `eu-central-1`, then runs `npx sst deploy --stage production`. **Flag**: this exact GitHub-Actions-OIDC-assumed-role pattern for `sst deploy` is a standard, widely-used construction, not something found in SST's own official docs (SST's documented CI/CD path is their Console's "Autodeploy" feature instead, which this project deliberately isn't using, per the already-provisioned `CLP-GitHubActionsRole` OIDC setup from the earlier brainstorming session) — worth confirming it works cleanly on the first real CI run.
- [ ] T021 [US3] Validate quickstart.md's User Story 3 scenario: merge a trivial passing change to `main` and confirm the `deploy` job runs and completes with no manual action; open a PR with a deliberately failing test and confirm the `test` job fails and the `deploy` job's `needs: test` dependency prevents any deploy. **Blocked on a real merge/PR** against the live repository — deferred alongside T011/T018.

**Checkpoint**: All of User Stories 1–3 work independently — deploys are now fully automatic and test-gated.

---

## Phase 6: User Story 4 - Recipes can include photos (Priority: P2)

**Goal**: Image storage exists; an uploaded image is retrievable afterward via a stable address.

**Independent Test**: Store an image via the upload flow and confirm it can be retrieved afterward via a stable address, independent of any specific upload UI.

### Implementation for User Story 4

- [X] T022 [US4] Add an images S3 bucket to `infra/storage.ts` as an SST `Bucket` component, physical name starting with lowercase `clp-` (e.g. `clp-images`, per data-model.md and research.md's naming convention). Also `access: 'public'` so `imageUrl` is a plain, directly-retrievable address (per FR-008) — upload itself still requires authentication via the presigned PUT URL from the authenticated `POST /images` endpoint, not public write access.
- [X] T023 [US4] Create `backend/src/handlers/create-image-upload-url.ts`: validates the request body's `contentType` is one of `image/jpeg`, `image/png`, or `image/webp` (`400` otherwise, per contracts/images-api.md), generates a server-side ULID object key (never client-supplied, per data-model.md), and returns a `201` with a presigned S3 `PUT` URL (valid 5 minutes, content-type constrained to the requested type) as `uploadUrl`, plus the object's stable `imageUrl`. Note: the 10 MB maximum isn't enforceable on a presigned `PUT` URL itself (that needs a presigned POST policy with a `content-length-range` condition, which this contract didn't call for) — documented here rather than silently assumed.
- [X] T024 [P] [US4] Add a `POST /images` route to `infra/api.ts`, wired to the `create-image-upload-url` function from T023, linked to the `clp-images` bucket from T022 (via an explicit `IMAGES_BUCKET_NAME` environment variable, same pattern as `TABLE_NAME` — avoids depending on SST's generated `Resource` types, which don't exist until a real deploy has run at least once), protected by the same Cognito JWT authorizer added in T012 (FR-003 applies to every route, including this one).
- [X] T025 [P] [US4] Create `backend/tests/integration/create-image-upload-url.test.ts` covering: a request with a missing/invalid `contentType` returns `400`; a request with a valid `contentType` returns `201` with `uploadUrl` and `imageUrl` in the shape documented in contracts/images-api.md. Fixed, non-real AWS credentials are set before importing the handler, since presigning needs *some* credentials to resolve but CI's test job intentionally has none (FR-006). Verified passing (3/3), alongside the full existing backend suite (7 unit + 19 integration, all green).
- [ ] T026 [US4] Validate quickstart.md's User Story 4 scenario: call `POST /images` with a valid `contentType`, `PUT` an image file to the returned `uploadUrl`, then `GET` the returned `imageUrl` and confirm it returns the uploaded image. **Blocked on a real deploy**, deferred alongside T011/T018/T021.

**Checkpoint**: All four user stories are independently functional and validated.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final verification across all stories.

- [ ] T027 [P] Update the root `README.md`'s Deployment section to reflect the now-implemented pipeline (replace the "Not yet implemented" status with the real deploy flow), per the project's existing documentation style.
- [ ] T028 [P] Add TSDoc to every new export introduced by this feature (`backend/src/handlers/create-image-upload-url.ts`, `frontend/src/services/auth.ts`, `frontend/src/pages/SignInCallbackPage.tsx`), consistent with the project's existing TSDoc standard (`eslint-plugin-tsdoc`, `tsdoc/syntax` lint rule).
- [ ] T029 Run quickstart.md's full validation end-to-end (all four scenarios, in order) as final sign-off that SC-001 through SC-005 hold.
- [ ] T030 Validate SC-006: review the repository and its full commit history (`git log -p`) for any committed AWS account id, access key, or other cloud credential capable of modifying infrastructure; confirm none exists.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (needs `infra/storage.ts`'s table). No dependency on other stories.
- **User Story 2 (Phase 4)**: Depends on Foundational (needs `infra/auth.ts`) and on User Story 1 (adds the authorizer to the `infra/api.ts` created in T007; the frontend changes build on the `recipesApi.ts` from T010).
- **User Story 3 (Phase 5)**: Depends on Foundational only for what it deploys — conceptually independent of US1/US2's application code, but in practice deploys whatever stories exist so far; can be built in parallel with US1/US2 and only needs a real `sst.config.ts` from Phase 1.
- **User Story 4 (Phase 6)**: Depends on Foundational (storage) and on `infra/api.ts` existing (T007, from US1) to add its route; independent of US2/US3 otherwise.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Parallel Opportunities

- T002 and T003 (Phase 1) can run in parallel with T001 is sequential (T001 creates the file T002/T003 don't touch, but all three touch different files so can be parallelized once T001's `sst.config.ts` exists for context).
- T005 (Phase 2) can run in parallel with T004 (different files: `infra/auth.ts` vs. `infra/storage.ts`).
- T014 and T015 (Phase 4) can run in parallel (different files).
- T024 and T025 (Phase 6) can run in parallel (different files).
- T027 and T028 (Phase 7) can run in parallel (different files).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: confirm the backoffice is live and usable from a real URL (unauthenticated at this point).
5. Note: shipping US1 alone to the public internet without US2 leaves the backoffice unauthenticated — acceptable only as an internal milestone, not as a stopping point for real use.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → backoffice reachable (internal milestone only, not yet safe to leave live).
3. User Story 2 → backoffice reachable **and** access-restricted — first safe-to-leave-live milestone.
4. User Story 3 → deploys become automatic going forward.
5. User Story 4 → image storage available for the next feature to build on.
6. Polish → documentation and final SC validation.
