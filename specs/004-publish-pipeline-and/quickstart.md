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

## Validation scenarios (map to spec.md Acceptance Scenarios)

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
- `backend/tests/unit/rebuild-index.test.ts`: `browse-index.json`/category-shell assembly from
  fixture snapshot-table data — confirms it never reads live draft fields.
- `public-site/tests/unit/templates.test.ts`: fixture recipe/category data → expected rendered
  HTML (per the constitution's testing stance).
- `backend/tests/integration/start-publish.test.ts`: the `409` concurrent-run guard and the
  no-op/`nothing-to-publish` path, with the Step Functions client mocked.
- `backend/tests/integration/render-recipe.test.ts`: the per-recipe render/S3-write logic, with
  the S3 client mocked.
- No automated test runs a real Step Functions execution end-to-end or hits real CloudFront —
  validated manually per scenarios 1-7 above, mirroring 002/003's stance on infrastructure that
  cannot reasonably be exercised in CI.
