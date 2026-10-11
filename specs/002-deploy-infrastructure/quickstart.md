# Quickstart: Validating Deploy Infrastructure

Prerequisites: completion of `infra/iam/README.md`'s one-time AWS setup (already done — the
`CLP-GitHubActionsRole`/`CLP-GitHubActionsPermissions` exist and `AWS_DEPLOY_ROLE_ARN` is set as a
GitHub Actions secret), `uv`/`node`/`npm` as in 001's quickstart, and `sst` installed
(`npm install` at the repo root picks it up as a dependency).

## Setup (first deploy, from your own machine, not CI)

```bash
npx sst deploy --stage production
```

This bootstraps SST's state/asset buckets (`sst-state-*`, `sst-asset-*`), creates the Cognito User
Pool, the DynamoDB table, the images S3 bucket, the Lambda functions + API Gateway, and the
backoffice's static-site hosting — all named with the `CLP-`/`clp-` prefix the deploy role's
permissions policy expects.

Create the one production account manually, via the AWS Console: Cognito → User Pools → the
`CLP-*` pool → Users → **Create user** (no self-sign-up link exists anywhere to do this instead).

## Validation scenarios (map to spec.md Acceptance Scenarios)

1. **Use the backoffice from anywhere (User Story 1)**
   - Open the backoffice's deployed URL (the `StaticSite` component's output) on a device that
     never ran `npm run dev`.
   - Expected: after signing in (scenario 2 below), the recipe list and editor load and behave
     the same as the local dev version; a created recipe is still present after closing and
     reopening the browser.

2. **Only the owner can access it (User Story 2)**
   - Without signing in, open the backoffice URL and also try calling an API route directly (e.g.
     `curl <api-url>/recipes`).
   - Expected: both are rejected (`401` from the API; the SPA redirects to Hosted UI sign-in).
   - Look for any sign-up link or form anywhere in the product.
   - Expected: none exists.
   - Sign in with the manually-created account from Setup above.
   - Expected: succeeds, reaches the backoffice.

3. **Ship changes without a manual deploy step (User Story 3)**
   - Merge a trivial, passing change to `main`.
   - Expected: GitHub Actions' `deploy` job runs and completes with no manual action; the change
     is live.
   - Open a PR with a deliberately failing test; observe the `test` job fails and merging is
     blocked (or, if merged anyway via admin override, confirm the `deploy` job's `needs: test`
     dependency prevents it from running).

4. **Recipes can include photos (User Story 4)**
   - Call `POST /images` with a valid `contentType`, then `PUT` an image file to the returned
     `uploadUrl`.
   - Expected: a subsequent `GET` of `imageUrl` returns the uploaded image.

## Automated coverage

- `backend/tests/integration/create-image-upload-url.test.ts`: contentType validation, presigned
  URL shape.
- No automated test for the Cognito/API Gateway authorizer wiring itself (infrastructure
  configuration, not application logic) — validated manually per scenario 2 above.
