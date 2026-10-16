# Phase 0 Research: Publish Pipeline and Public Recipe Site

## Pipeline orchestration shape

**Decision**: One Step Functions Standard workflow with two entry shapes (Publish vs Unpublish),
each: (1) a Lambda that queries the toggled-on recipe set and builds the run's task list, (2) a
Map state over that list running a per-recipe render (Publish) or remove (Unpublish) task, each of
which also writes/clears that recipe's `publishStatus` and published-snapshot record and resets its
toggle, (3) a single `rebuild-index` task that regenerates the full browse/search index and every
category shell page from the snapshot table (not live draft data), (4) a single
`invalidate-cdn` task, wrapped in a top-level `Catch` that marks the run failed and leaves
untouched recipes exactly as they were (FR-010).

**Rationale**: Matches the constitution's explicit orchestration description (per-locale/per-
category parallel Map states, Catch-based error handling) and keeps the two actions as one state
machine with a branch rather than two near-duplicate machines, since steps 3-4 are identical
regardless of direction.

**Alternatives considered**: Two separate state machines (Publish-only, Unpublish-only) — rejected
as needless duplication, since only the per-recipe task (render vs. remove) differs. Hand-rolled
Lambda-invokes-Lambda coordination — explicitly disallowed by the constitution's Technology Stack
Constraints without justification, and Step Functions' built-in retry/Catch/visibility is exactly
what FR-009/FR-010 need.

## Full index/category rebuild, driven by a snapshot table, not live draft data

**Decision**: Every run rebuilds the full browse/search index and all category shells from a
per-recipe-per-locale **published-snapshot** record (title, slug, category, locale), written only
when that recipe is actually rendered or removed — never from the recipes' current, possibly
since-edited draft content in DynamoDB.

**Rationale**: Surfaced during brainstorming — regenerating the index from live draft data would
let it show a title/category change for a recipe that wasn't toggled this run, while its actual
rendered HTML page (last touched in a prior run) still shows the old content, silently violating
FR-013/FR-007's snapshot guarantee. Reading from the snapshot table instead means the index can
never be ahead of what is actually sitting in the public bucket, while still keeping the rebuild
itself simple (a full scan + rewrite, not an incremental diff).

**Alternatives considered**: Full rebuild from live draft data (rejected — the drift bug above).
Incremental index patching keyed off only the toggled recipes this run (rejected during
brainstorming — correct but meaningfully more complex, and the constitution's Simplicity principle
favors the full-rebuild-from-truth approach at this project's scale).

## Rendering recipes with Eleventy inside a Lambda task

**Decision**: `backend/src/pipeline/render-recipe.ts` invokes Eleventy programmatically
(`public-site/src/render.ts`) against one recipe's data, writing output to the Lambda's `/tmp`,
then uploads the resulting file(s) to the public S3 bucket via `PutObject`, one file per
locale/slug. `infra/public-site.ts`'s `StaticSite` component provisions the bucket, CloudFront
distribution, and custom domain only — its own `build` step (which runs once, at `sst deploy`
time) is not how recipe content reaches the bucket, since it has no access to recipe data and does
not re-run on every Publish click.

**Rationale**: Eleventy's normal CLI/filesystem-watch mode is designed for a build-time, whole-site
regeneration; running it per-recipe inside a Lambda task keeps each Map-state iteration independent
(matching Step Functions' per-item retry semantics) and avoids rebuilding the entire site's HTML on
every run just to change a handful of pages.

**Alternatives considered**: A single Lambda (or Fargate task) that runs Eleventy once over the
entire toggled set outside the Map state — rejected as it would lose Step Functions' per-item
retry/visibility and Catch semantics (FR-010's "leave unaffected recipes untouched on partial
failure" is much simpler to guarantee per-item than inside one large build process).

## Trigger and status-polling pattern

**Decision**: `POST /publish` and `POST /unpublish` each: check the single `PIPELINE#STATUS`
DynamoDB item for an in-progress run (FR-009's guard — reject with a clear error if one exists),
call Step Functions `StartExecution`, record the execution ARN and `running: true` on that item,
and return immediately. `GET /publish-status` reads that same item and additionally calls Step
Functions `DescribeExecution` to report `RUNNING`/`SUCCEEDED`/`FAILED`, clearing the `running` flag
once the pipeline's own final task (success) or Catch handler (failure) has updated it. The
backoffice polls this endpoint while a run is in progress.

**Rationale**: API Gateway's 29-second synchronous timeout cannot cover a multi-recipe render run;
fire-and-forget plus polling was confirmed as the desired pattern during brainstorming. A single
DynamoDB item is the simplest possible run-lock at this project's scale (Principle IV) — no queue,
no distributed lock service.

**Alternatives considered**: Synchronous blocking call with a long client timeout — rejected
(fragile against gateway/browser timeouts, no progress feedback, confirmed against during
brainstorming). Fire-and-forget with no status UI — rejected; the owner explicitly wanted visible
run status, independent of the toggle (FR-008).

## Custom domains via SST, now that DNS is delegated to Route 53

**Decision**: Both `infra/web.ts` (existing backoffice `StaticSite`) and the new
`infra/public-site.ts` (`StaticSite`) declare a `domain` using SST's Route 53-integrated DNS
helper, now that `libertpierrick.com`'s NS records point at this AWS account's Route 53 hosted
zone (confirmed live during planning). This lets `sst deploy` create the `cuisine` and
`admin.cuisine` DNS records and the required `us-east-1` ACM certificate (CloudFront's hard
regional requirement for certs) automatically on every deploy, with no manual DNS step.

**Rationale**: The project's deploy pipeline (002) is fully automatic on merge to main; a domain
setup that required a manual GoDaddy DNS copy-paste for every new or renewed certificate would
break that automation. Route 53 delegation (already done, confirmed via DNS resolution during
planning) removes that manual step entirely.

**Alternatives considered**: Keep DNS at GoDaddy directly and manually add CNAME validation
records per cert — rejected once Route 53 delegation was already in place; manual-record
maintenance was only the right call before delegation existed, to avoid migrating a zone that
still had unrelated live records in it (since resolved: the owner removed those records before
delegating).

## Backoffice migration to its own subdomain

**Decision**: Add `domain: 'admin.cuisine.libertpierrick.com'` to the existing backoffice
`StaticSite` (`infra/web.ts`) rather than creating a second, parallel backoffice resource — the
underlying bucket/CloudFront/Cognito setup is otherwise unchanged.

**Rationale**: This is purely a domain addition to already-working infrastructure (User Story 5);
no behavioral change to the backoffice itself is in scope.

**Alternatives considered**: None meaningfully different — adding a custom domain to an existing
SST `StaticSite` is a single, well-supported configuration change, not an architectural decision
with real alternatives.
