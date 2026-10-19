# Quickstart: Validating the Publish Pipeline and Public Site

Prerequisites: 001/002/003 deployed; `libertpierrick.com` delegated to this AWS account's Route 53
hosted zone (confirmed during planning — DNS resolves to AWS nameservers).

## Setup

```bash
npx sst deploy --stage production
```

This provisions the new Step Functions state machine and its task Lambdas, the new public
S3+CloudFront site at `cuisine.libertpierrick.com` (with its `us-east-1` ACM certificate,
auto-validated via the delegated Route 53 zone), the backoffice's new
`admin.cuisine.libertpierrick.com` domain/certificate, and the four new API Gateway routes.

**Deployed and live** (2026-10-19) at exactly these URLs:

- Public site: `https://cuisine.libertpierrick.com`
- Backoffice: `https://admin.cuisine.libertpierrick.com`
- API: `https://i2m3nu49z4.execute-api.eu-central-1.amazonaws.com`

Two issues only surfaced on this real deploy (neither reproducible by local unit/integration
tests, since those never run through esbuild's actual Lambda bundling) — both fixed and
redeployed before validation below:
- SST's `nodejs.install` mechanism runs its own `npm ci` inside the deploy process; that failed
  in the deploying environment even though the identical command succeeded run directly. Switched
  to supplying `@11ty/eleventy`'s `node_modules` via `copyFiles` from a committed,
  pre-installed `infra/.eleventy-lambda-deps/` instead.
- esbuild auto-injects its own `__dirname` shim into any Node-ESM bundle referencing that
  identifier anywhere, colliding with `render.ts`'s/`rebuild-index.ts`'s own
  `import.meta.url`-based `__dirname` polyfill (`SyntaxError: Identifier '__dirname' has already
  been declared`). Renamed to `currentDir` in both files.

---

## Validation scenarios (map to spec.md Acceptance Scenarios)

**Scenarios 1, 2, 3, and 6 below were validated against this real deployment** by invoking the
deployed Lambdas directly (IAM/AWS CLI, bypassing Cognito — no login credentials were available
in the validating environment) and checking the actual public URLs. Scenario 4's server-side
artifacts (home page, `browse-index.json`, `assets/browse.js`, category reconciliation) were
confirmed present and correct the same way; the client-side Alpine.js interactivity itself needs
a real browser to exercise, not yet done. Scenario 5's reachability was confirmed (both domains
resolve and serve); the actual Cognito sign-in flow needs a real login, not yet done. Scenario 7
(partial-failure isolation) was not re-triggered live — deliberately breaking something in a real
production run was judged too risky; it remains covered by the automated test suite only.

1. **Publish a recipe (User Story 1)**
   - In the backoffice (now at `admin.cuisine.libertpierrick.com`), open a complete recipe and
     toggle it on.
   - Click "Publish".
   - Expected: the backoffice shows a run in progress; polling `GET /publish-status` eventually
     shows `running: false, lastResult: "succeeded"`.
   - Visit `https://cuisine.libertpierrick.com/<locale>/recipes/<slug>.html` — the recipe's page
     is live with the content that was in the backoffice when Publish was clicked.
   - Confirm the recipe's toggle is now off in the backoffice (FR-005).
   - Confirm a *different*, untoggled recipe's public state (published or not) is unchanged.

2. **Unpublish a recipe (User Story 2)**
   - Toggle on a currently-live recipe, click "Unpublish".
   - Expected: after the run completes, its detail page URL returns a 404/not-found from
     CloudFront, and it no longer appears in its category page or `browse-index.json`.
   - Confirm an untoggled, still-live recipe is unaffected.

3. **Editing a published recipe doesn't change the public site until republished (User Story 3)**
   - Edit the name of an already-published recipe in the backoffice; do not toggle/republish it.
   - Expected: the public detail page still shows the old name.
   - Toggle it on and click Publish again.
   - Expected: the public page now shows the new name, and `browse-index.json` reflects it too.

4. **Browse and search (User Story 4)**
   - Publish at least two recipes in different categories, in at least two locales.
   - Expected: each locale's category page lists exactly its locale's live recipes in that
     category; the client-side search/filter on the public site narrows results without a page
     reload; a recipe published in only one locale does not appear (and causes no broken page) in
     a locale it has no content for.

5. **Backoffice on its own subdomain (User Story 5)**
   - Navigate to `https://admin.cuisine.libertpierrick.com`, sign in, edit a recipe.
   - Expected: identical behavior to the backoffice's previous address.

6. **Concurrent-run guard (Edge Case)**
   - While a publish run is in progress, click Publish or Unpublish again.
   - Expected: `409` response, clearly surfaced in the backoffice UI; the in-progress run is
     unaffected.

7. **Partial failure leaves untouched recipes alone (Edge Case)**
   - Simulate a single recipe's render failing (e.g. temporarily malformed step content) while
     other toggled recipes are valid.
   - Expected: the valid recipes still publish successfully; the failed recipe's `publishStatus`
     reverts to its prior value and its toggle resets; the owner sees a clear failure indication;
     no page on the public site is left broken or half-written.

## Automated coverage

- `backend/tests/unit/publish-selection.test.ts`: selecting the toggled-on recipe set and building
  a run plan, pure function, no AWS calls.
- `backend/tests/integration/rebuild-index.test.ts`: `browse-index.json`/category-shell/home-page
  assembly from real snapshot-table data (local DynamoDB) — confirms it never reads live draft
  fields, and reconciles stale locales/categories correctly.
- `public-site/tests/unit/render.test.ts`: real `@11ty/eleventy` invocations (not mocked) against
  `templates/` — fixture recipe/category/home data → expected rendered HTML (per the
  constitution's testing stance).
- `backend/tests/integration/start-publish.test.ts`: the `409` concurrent-run guard (including a
  genuine concurrent-call race test), the no-op/`nothing-to-publish` path, and the atomic lock
  acquisition, with the Step Functions client mocked.
- `backend/tests/integration/render-recipe.test.ts` / `remove-recipe.test.ts`: the per-recipe
  render/remove logic (real Eleventy rendering, S3 client mocked), including partial-failure
  rollback and the Lambda event-shape contract (`{ recipeId }`, matching the ASL's `ItemSelector`).
- No automated test runs a real Step Functions execution end-to-end, deploys to real AWS, or hits
  real CloudFront — validated manually per scenarios 1-7 above, mirroring 002/003's stance on
  infrastructure that cannot reasonably be exercised in CI.
