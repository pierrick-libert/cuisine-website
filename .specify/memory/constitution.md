<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1 (wording-only — project renamed to "Pierrick's Sunday Kitchen")
- Modified principles: none
- Added sections: none
- Removed sections: none
- Templates requiring updates: none (no principle content changed)
- Follow-up TODOs: none
-->

# Pierrick's Sunday Kitchen Constitution

## Core Principles

### I. Cost Above All
Every architectural and implementation decision MUST default to the option with the lowest
ongoing AWS cost, preferring services with zero or near-zero idle cost (pay-per-request/pay-per-
invocation) over anything with a fixed or idle cost. A service with a fixed or idle cost MAY be
introduced only with an explicit, written justification in the relevant spec or plan explaining
why no pay-per-use alternative meets the requirement.
Rationale: this is a personal project funded out of pocket; runaway or creeping infrastructure
cost is the primary risk the project must guard against, ahead of scalability or developer
convenience.

### II. Static-First Public Site
The public-facing recipe site MUST be served as pre-rendered static HTML/CSS/JS from S3 behind
CloudFront. No server-side process may run at visitor request time. All per-locale recipe pages,
category shell pages, and the browse/search JSON index are generated ahead of time by the publish
pipeline. Interactivity that must react live in the browser (servings multiplier, metric/imperial
toggle, client-side browse/search/pagination) MUST be implemented as client-side JavaScript over
data already embedded in or fetched alongside the static page, never via a server round-trip.
Rationale: static hosting has no idle cost and no server to patch, fail, or scale, directly
serving Principle I, and the dataset size (low hundreds to ~1000 recipes) makes client-side
filtering and rendering entirely practical.

### III. Single Exposed Backend Surface
The only part of the system exposed as a live backend is the backoffice: a Cognito-authenticated
single-user SPA calling an API Gateway + Lambda API on its own subdomain. No other backend surface
(a second API, a public-facing server endpoint, a webhook receiver reachable by the public site)
may be introduced without amending this constitution first.
Rationale: minimizing the attack surface and operational surface to one authenticated entry point
keeps the system simple to reason about and cheap to run, matching the single-editor, personal-use
scope of the project.

### IV. Simplicity Over Premature Scale (YAGNI)
Data modeling, indexing, and infrastructure MUST fit the project's actual scale (on the order of
100–1000 recipes, one editor, infrequent publishes) rather than a hypothetical larger scale.
Specifically: full DynamoDB table scans with in-memory grouping are the default access pattern;
secondary indexes (GSIs) or additional data stores MUST NOT be added until a concrete, measured
need exists that a scan can no longer satisfy. The same standard applies to any other component:
justify complexity by a present requirement, not a future one.
Rationale: every added index, queue, or service is a maintenance and cost liability; at this
project's scale the simplest access pattern is also the cheapest and the easiest to debug.

### V. Explicit Over Automatic
Any action that costs money beyond negligible storage (an AI API call, a publish that triggers
the render/Step Functions pipeline and a CloudFront invalidation) MUST be triggered by an explicit,
dedicated user action (e.g., clicking "Generate translation draft," clicking "Publish all pending
changes"). Routine, frequent actions (saving a draft, editing a title or a field) MUST NOT trigger
such costed operations automatically or as a side effect.
Rationale: decoupling cheap, frequent actions (save) from costed, deliberate actions (publish, AI
assist) avoids wasted spend and keeps the editing experience fast, and was a specific lesson
learned while designing the publish pipeline (a full scan/render on every keystroke-level edit is
wasteful even though individually cheap).

### VI. Multi-Language as a First-Class Concern
Every recipe and every category MUST support per-locale content (name, slug, description,
ingredient names, step text) as a core part of the data model, not a bolt-on. Category URL slugs
MUST be localized per-locale (e.g. `/en/category/starter` vs `/fr/category/entree`), matching how
recipe slugs are already localized. AI-assisted translation (via the Claude API) MUST always
produce an editable draft that a human reviews before it is published; it MUST NOT silently
replace or auto-publish translated content.
Rationale: multi-language support for family and friends in different countries is a primary
purpose of the site, not an afterthought, and translation quality still needs a human review step.

### VII. Structured Data Over Free Text (Where It Matters)
Ingredients MUST be stored as structured data (quantity, unit, name, optional group, optional
approximate-volume equivalent) rather than free text, to support servings scaling, metric/imperial
conversion, and approximate-measure suggestions. Step/instruction content MAY be rich text
(WYSIWYG), since it does not need to be computed over.
Rationale: this structure is what makes the servings multiplier, unit toggle, and "no scale"
approximate equivalents possible — the exact pain point with existing blog/WordPress recipe tools
that motivated building a custom site in the first place.

## Technology Stack Constraints

- **Backoffice & publish pipeline runtime**: Node.js/TypeScript Lambdas only. Elixir was
  deliberately evaluated and dropped in favor of keeping the Lambda + static-site architecture
  simple and idiomatic; it MUST NOT be reintroduced without amending this constitution.
- **Data store**: DynamoDB (single table, per-locale items for recipes and categories, no GSIs by
  default per Principle IV). An external SQL database (e.g. a managed Postgres/MySQL free tier)
  MUST NOT be introduced; it was evaluated and rejected due to the operational cost of managing
  serverless-to-SQL connection pooling and the lack of any relational query this project needs.
- **Publish orchestration**: AWS Step Functions orchestrates the multi-step publish pipeline
  (fetch data → render per locale → rebuild indexes → reconcile category shells → invalidate
  CloudFront → update status), using per-locale/per-category parallel Map states and built-in
  Catch-based error handling. Hand-rolled Lambda-invokes-Lambda coordination MUST NOT replace this
  without justification, since Step Functions already provides the retry/visibility this project
  needs at negligible cost.
- **Static site generation**: Eleventy generates per-locale recipe detail pages and category shell
  pages from recipe data at publish time.
  
- **Client-side interactivity**: Alpine.js (or an equivalently lightweight library) powers the
  servings multiplier, metric/imperial toggle, and the browse/category JSON-index-driven search,
  filter, and pagination. A heavier SPA framework MUST NOT be introduced for the public site.
- **Authentication**: AWS Cognito protects the backoffice (single user).
- **AI assistance**: the Claude API provides on-demand, explicitly-triggered translation drafts
  and ingredient approximate-volume-equivalent suggestions (Principle V and VI).
- **Domains**: the public site and the backoffice are served from separate subdomains of the
  project's own domain (e.g. `myrecipes.com` and `admin.myrecipes.com`), each with its own
  CloudFront distribution.

## Development Workflow

- **Testing stance**: unit tests cover ingredient unit-conversion/scaling math, Eleventy template
  rendering (fixture recipe data → expected HTML), and category slug/shell reconciliation logic.
  Integration tests cover backoffice API Lambda handlers against a local DynamoDB. The static
  public output itself does not require end-to-end automated tests beyond its template unit tests,
  since it has no runtime server logic to regress.
- **Design workflow**: UI changes affecting the public site or backoffice are mocked up visually
  (e.g. via Claude Design canvases) and approved before implementation planning begins.
- **Spec-driven workflow**: feature work follows the Spec Kit flow (`/speckit-specify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`); every plan MUST be checked against
  this constitution before implementation starts.

## Governance

This constitution supersedes any conflicting ad hoc practice. Amendments are made via
`/speckit-constitution` and MUST:
- State the principle(s) added, removed, or redefined and the rationale for the change.
- Bump `CONSTITUTION_VERSION` per semantic versioning: MAJOR for backward-incompatible principle
  removals/redefinitions, MINOR for new principles or materially expanded guidance, PATCH for
  wording/clarification-only changes.
- Update `LAST_AMENDED_DATE` to the date of the amendment.

Every `/speckit-plan` MUST include a compliance check against these principles before
implementation tasks are generated; any deviation MUST be justified in that plan's complexity
tracking section or the deviation MUST be removed in favor of a compliant approach.

**Version**: 1.0.1 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-11
