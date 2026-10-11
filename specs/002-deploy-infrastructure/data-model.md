# Phase 1 Data Model: Deploy Infrastructure

This feature introduces no changes to the existing recipe/category DynamoDB schema from
001-recipe-authoring. It introduces two entities, neither of which gets a new DynamoDB item type.

## Account

Per spec.md's Key Entities, an Account is a Cognito User Pool user. It is **not modeled or stored
anywhere in this project's own data** — Cognito is the entire system of record for it. The
application never creates, lists, or persists account data; it only validates a bearer token's
signature and claims (via the API Gateway JWT authorizer) on each request.

| Field (Cognito-managed, not ours) | Notes |
|---|---|
| username / email | Set manually by the owner via the AWS Console when creating the account. |
| password | Set by the owner (or reset via Cognito's own, non-self-service admin flow). |

No validation rules, no state transitions — this project has no code path that creates, modifies,
or lists accounts.

## Image

An uploaded recipe photo, stored as a plain S3 object. Per spec.md's Assumptions, associating an
image with a specific recipe is a later feature's concern — this feature only needs the object to
exist and be retrievable.

| Field | Notes |
|---|---|
| S3 object key | Generated server-side (ULID-based, consistent with 001's id generation) when a presigned upload URL is issued — never client-supplied, to avoid key collisions or path traversal. |
| Public URL | The bucket's (or CloudFront's, if fronted by one) URL for that key — returned alongside the presigned upload URL so the frontend can reference the image immediately after a successful upload. |

No metadata (filename, size, content type beyond what S3 itself tracks) is persisted anywhere —
there is no DynamoDB item for an Image in this feature, matching the spec's explicit scope
boundary (storage + retrieval only, no association, no processing pipeline).

## Validation rules (from Functional Requirements)

- FR-008 requires only that an uploaded image be retrievable afterward via a stable address — no
  additional validation (file type, size limits) is required by the spec; a reasonable default
  (the presigned URL's own size/content-type constraints, set when issuing it) is applied in the
  contract below rather than a persisted rule.
