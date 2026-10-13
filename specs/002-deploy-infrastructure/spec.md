# Feature Specification: Deploy Infrastructure

**Feature Branch**: `002-deploy-infrastructure`

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "Deploy the Recipe Authoring backend and backoffice frontend to
real AWS infrastructure, establishing the deployment pipeline and auth for all future features
built on this project. Provision the existing backend (Lambda handlers, DynamoDB table) and
backoffice frontend as real, reachable infrastructure; add Cognito-based authentication to the
backoffice with self-sign-up disabled entirely (accounts are created manually, by the owner,
through the AWS Console only); establish an automatic deploy-on-merge-to-main pipeline via
GitHub Actions, authenticated to AWS via OIDC (no long-lived credentials); and provision storage
for recipe images."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use the backoffice from anywhere (Priority: P1)

The owner opens the backoffice from a real web address — not `localhost` — on any device, and
creates, edits, views, and deletes recipes exactly as they could locally, with changes persisted
in real cloud storage rather than a local database.

**Why this priority**: Nothing built so far (recipe authoring) is actually usable by the owner
outside their own development machine until this exists. This is the floor everything else sits
on.

**Independent Test**: Can be fully tested by opening the backoffice's real URL on a different
device than the one it was built on, creating a recipe, and confirming it is still there after
closing and reopening the browser.

**Acceptance Scenarios**:

1. **Given** the backoffice is deployed, **When** the owner navigates to its public URL, **Then**
   the recipe list and editor load and function the same as the local development version.
2. **Given** a recipe created through the deployed backoffice, **When** the owner reloads the
   page or returns later, **Then** the recipe is still present, confirming it was persisted to
   real cloud storage, not an ephemeral local process.

---

### User Story 2 - Only the owner can access the backoffice (Priority: P1)

An unauthenticated visitor who finds the backoffice's URL cannot view, create, edit, or delete
any recipe. The owner signs in with credentials that were created for them manually, in advance,
through the AWS Console — there is no sign-up option anywhere in the product.

**Why this priority**: The backoffice holds the owner's only copy of their adjusted recipes and
is reachable from the public internet once deployed (User Story 1) — it must not be open to
anyone who finds the URL. Per the project's constitution, this is explicitly a single-editor
system, not a multi-tenant one.

**Independent Test**: Can be fully tested by attempting to reach the backoffice or call its API
without signing in (must be rejected), confirming no registration form or endpoint exists
anywhere in the product, and then signing in with a manually-provisioned account (must succeed).

**Acceptance Scenarios**:

1. **Given** the deployed backoffice, **When** an unauthenticated visitor attempts to view or
   modify any recipe (via the UI or by calling the API directly), **Then** the request is
   rejected.
2. **Given** the deployed backoffice, **When** anyone looks for a way to create a new account
   (in the UI or as an API call), **Then** no such capability exists anywhere in the product.
3. **Given** an account the owner created manually through the AWS Console, **When** the owner
   signs in with it, **Then** they reach the backoffice and can use it normally.

---

### User Story 3 - Ship changes without a manual deploy step (Priority: P2)

The owner merges an approved change into the main branch. The change becomes live automatically,
without the owner running any deployment command, and only after the project's automated tests
have passed.

**Why this priority**: Valuable once User Stories 1 and 2 exist — it removes ongoing manual
toil for every future change, but the project is already usable without it (the owner could
deploy by hand in the meantime).

**Independent Test**: Can be fully tested by merging a trivial, passing change to main and
confirming it appears live with no manual action, and separately by proposing a change with a
failing test and confirming it is never deployed.

**Acceptance Scenarios**:

1. **Given** a change merged into the main branch, **When** its automated tests pass,
   **Then** it is deployed to the live environment with no manual step from the owner.
2. **Given** a proposed change whose automated tests fail, **When** that change is merged,
   **Then** it is never deployed to the live environment.
3. **Given** the automated deployment process, **When** it authenticates to the cloud provider,
   **Then** it does so without any long-lived credential stored in the project.

---

### User Story 4 - Recipes can include photos (Priority: P2)

The owner (through the backoffice, in a later feature that builds on this one) can associate a
photo with a recipe and have it reliably stored and retrievable via a stable address.

**Why this priority**: A direct, explicit need raised during planning — recipes are expected to
include photos — but the backoffice is already valuable for text/structured content without it,
and the actual upload *experience* is a separate, later feature; this story is only about the
storage existing and working.

**Independent Test**: Can be fully tested by storing an image and confirming it can be retrieved
afterward via a stable address, independent of any specific upload UI.

**Acceptance Scenarios**:

1. **Given** image storage has been provisioned, **When** an image is uploaded to it, **Then** it
   can be retrieved afterward via a stable address.

---

### Edge Cases

- What happens if someone finds and calls a backoffice API endpoint directly, bypassing the UI
  entirely, without signing in first? (Must be rejected the same as an unauthenticated UI visit —
  User Story 2's protection is not only a UI-level gate.)
- What happens if a change is merged directly to main without going through a pull request (e.g.
  a direct push)? (The same test gate and deploy behavior apply — the protection is "tests must
  pass before deploy," not "a pull request must exist.")
- What happens if the automated deployment process itself fails partway (e.g. a transient cloud
  provider error)? (The live environment must not be left in a worse state than before the
  attempt; a retry of the same deployment must be possible.)
- What happens when the owner needs to add a second account later (e.g. for a family member
  helping with recipes)? (Still a manual AWS Console action per User Story 2 — no in-product
  capability is added for this in this feature.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provision the existing backend (API + data storage) as reachable, real
  cloud infrastructure, replacing the local-only development setup.
- **FR-002**: System MUST provision the backoffice frontend as a real, publicly reachable address.
- **FR-003**: System MUST require the owner to authenticate before any backoffice functionality
  (viewing, creating, editing, or deleting a recipe) can be used, whether accessed through the UI
  or its underlying API.
- **FR-004**: System MUST NOT provide any self-service account registration capability, in the UI
  or as a callable API — the only way an account is created is a manual action outside the
  product itself.
- **FR-005**: System MUST automatically deploy an approved, merged change to the live environment
  without requiring the owner to run a manual deployment step.
- **FR-006**: System MUST run the project's automated tests on every proposed change before it is
  eligible to be merged, and MUST NOT deploy any change whose automated tests have failed.
- **FR-007**: System MUST authenticate its automated deployment process to the cloud provider
  without storing a long-lived credential in the project's source code or configuration.
- **FR-008**: System MUST provide storage for images that supports uploading an image and
  retrieving it afterward via a stable address.
- **FR-009**: System MUST keep sensitive configuration values (such as a third-party API key used
  by a later feature) out of the project's source code and version history.
- **FR-010**: System MUST NOT expose any backend capability to the public internet other than the
  authenticated backoffice — no other API surface is introduced by this feature.

### Key Entities

- **Account**: A credential set that lets one person sign in to the backoffice. Created
  exclusively by manual action outside the product (not by the product itself). This feature
  expects exactly one in regular use (the owner).
- **Image**: A stored photo associated with a recipe (the association itself is a later feature's
  concern) — identified by a stable, retrievable address once uploaded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can perform every recipe-authoring action (create, view, edit, delete)
  from the backoffice's real address, from any device, with no local process running.
- **SC-002**: 100% of unauthenticated attempts to view or modify a recipe through the backoffice
  or its API are rejected.
- **SC-003**: 100% of merges to main with passing tests become live with zero manual deployment
  steps from the owner.
- **SC-004**: 100% of merges to main with failing tests result in no deployment.
- **SC-005**: An uploaded image remains retrievable via the same stable address indefinitely
  (barring deliberate deletion).
- **SC-006**: A review of the project's repository and its full commit history finds no cloud
  credential capable of modifying infrastructure.

## Assumptions

- The one-time AWS account setup this feature depends on (OIDC identity provider, the deploy
  role and its scoped permissions policy) is already complete, documented under `infra/iam/`, and
  is not itself a task of this feature — this feature's automated deployment process uses it.
- A single live environment ("production") is sufficient; no separate staging or per-change
  preview environments are needed.
- The owner is the only backoffice user for the foreseeable future; no multi-user role or
  permission model is needed beyond "signed in" vs. "not signed in."
- The public-facing recipe site, the recipe-publishing pipeline, and AI-assisted authoring
  features are separate, later features and are out of scope here — this feature only concerns
  the backoffice and the infrastructure it runs on.
- Image storage in this feature covers upload and retrieval only; any resizing, thumbnailing, or
  image-processing pipeline is out of scope.
