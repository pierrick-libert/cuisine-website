# Phase 0 Research: Deploy Infrastructure

All Technical Context items were resolvable from the prior brainstorming session (captured in
`infra/iam/README.md`) plus a handful of concrete implementation-pattern decisions below.

## SST app naming convention

- **Decision**: `sst.config.ts`'s `app` name is `"CLP"`; every resource that produces a
  name-based ARN (Lambda functions, the DynamoDB table, the images S3 bucket) gets its physical
  name explicitly set (via each component's `name`/`transform`) to start with `CLP-`
  (lowercase `clp-` for the S3 bucket, since bucket names cannot contain uppercase characters).
- **Rationale**: the deploy role's permissions policy (`infra/iam/deploy-role-permissions-policy.json`,
  already created in AWS) scopes Lambda/DynamoDB/S3 access by exactly this prefix. SST's default
  auto-generated naming is not guaranteed to produce it, so without this the deploy role's
  `Allow` statements simply won't match and every deploy will fail with an access-denied error.
- **Alternatives considered**: relying on SST's default naming and loosening the IAM policy
  instead — rejected, re-opens the broad-`Resource: "*"` policy the owner specifically asked to
  avoid.

## Cognito sign-in flow: Hosted UI vs. a custom sign-in form

- **Decision**: Cognito's Hosted UI (OAuth2 Authorization Code flow): the SPA redirects to a
  Cognito-hosted login page, Cognito redirects back with an authorization code, and the SPA
  exchanges it for tokens with one `fetch` call to Cognito's token endpoint.
- **Rationale**: for a single user with no self-service registration, building and maintaining a
  custom sign-in form (handling SRP auth, password reset, error states) is pure overhead with no
  benefit — Hosted UI needs zero frontend auth library and zero custom UI, just a redirect and a
  token-exchange call, consistent with the project's YAGNI stance.
- **Alternatives considered**: `amazon-cognito-identity-js` or AWS Amplify's Auth category for a
  custom in-app sign-in form — rejected, adds a dependency and UI surface for a capability (a
  branded/custom-styled login page) this single-user backoffice has no use for.

## API authorization: Cognito JWT authorizer on API Gateway HTTP API

- **Decision**: API Gateway HTTP API's native JWT authorizer, backed directly by the Cognito User
  Pool and App Client — no Lambda authorizer.
- **Rationale**: HTTP API's JWT authorizer validates the token's signature and claims at the API
  Gateway layer natively, with no additional Lambda invocation (and therefore no additional cost
  or latency) per request, compared to a Lambda authorizer. This is both the cheaper and the
  simpler option.
- **Alternatives considered**: a Lambda authorizer — rejected, strictly more moving parts and
  cost for the same outcome; Cognito Identity Pools (for temporary AWS credentials in the
  frontend) — rejected, this project only needs to prove "is this request from a signed-in user,"
  not grant the frontend direct AWS access.

## Image upload: presigned S3 PUT URL

- **Decision**: one backoffice API endpoint (`POST /images`) that returns a short-lived presigned
  S3 PUT URL and the image's eventual public URL; the frontend uploads the image bytes directly
  to S3 using that URL, not through a Lambda.
- **Rationale**: routing image bytes through a Lambda (`POST /images` with a body) would incur
  Lambda invocation/duration cost and API Gateway's payload size limits for no benefit; a
  presigned URL lets the browser upload directly to S3 while the backoffice API only ever handles
  a tiny JSON request/response.
- **Alternatives considered**: proxying the upload through a Lambda — rejected per above; a
  public-write S3 bucket — rejected, removes the authentication check this feature's User Story 2
  specifically requires (anyone with the bucket's upload endpoint could then write to it).

## Dependency versions (verified 2026-10-11)

| Package | Verified latest |
|---|---|
| `sst` | 4.17.2 |
| `@aws-sdk/client-s3` | 3.1149.0 |
| `@aws-sdk/s3-request-presigner` | 3.1149.0 |
| `aws-actions/configure-aws-credentials` (GitHub Action) | v6.3.0 |
| `typescript-eslint` | 8.71.1 — still requires TypeScript `<6.1.0`, confirming the existing
  6.0.3 pin from 001-recipe-authoring remains correct; not revisited here. |

**Output**: all Technical Context items resolved; no `NEEDS CLARIFICATION` markers remain.
