# Feature Specification: Publish Pipeline and Public Recipe Site

**Feature Branch**: `004-publish-pipeline-and`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "The Step Functions-orchestrated publish pipeline, plus the
public-facing static recipe site it renders — the original motivating use case for this project.
The owner marks specific recipes with a per-recipe toggle, then presses either 'Publish' (renders
and makes live every currently-toggled recipe) or 'Unpublish' (removes every currently-toggled
recipe from the public site); either action leaves untouched every recipe that isn't toggled, and
resets the toggle to off for every recipe it acted on. The public site reflects the last publish
run's output, not the backoffice's current draft state, so an owner can edit a recipe without that
change appearing publicly until they deliberately publish it again. Specific recipes can be kept
permanently unpublished even once complete. The public site is served at
`cuisine.libertpierrick.com`; the backoffice is migrated to `admin.cuisine.libertpierrick.com` as
part of this feature. Recipe-detail-page interactivity (servings multiplier, metric/imperial
toggle) is explicitly out of scope — a separate, later feature."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish selected recipes to the public site (Priority: P1)

The owner marks one or more complete recipes with the publish toggle, then clicks "Publish."
Those recipes become visible on the public site, with their own detail pages and appearing in the
relevant category pages and search/browse index. Recipes the owner did not toggle are completely
unaffected, whether or not they were already live.

**Why this priority**: This is the core value of the entire project — recipes authored in the
backoffice becoming an actual, visitable public site. Nothing else in this feature matters without
this working.

**Independent Test**: Can be fully tested by toggling one complete recipe, clicking "Publish," and
confirming its detail page, category listing, and search/browse entry all appear on the public
site, while an untoggled recipe (published or not) is unchanged.

**Acceptance Scenarios**:

1. **Given** a complete recipe with its publish toggle on, **When** the owner clicks "Publish,"
   **Then** the recipe's detail page becomes reachable on the public site, in every locale it has
   content for.
2. **Given** a recipe whose publish toggle is off, **When** the owner clicks "Publish," **Then**
   that recipe's public state (live or not) is completely unchanged.
3. **Given** several recipes toggled on, **When** the owner clicks "Publish," **Then** every one of
   them becomes live and every toggle the action acted on resets to off afterward.
4. **Given** a recipe just published, **When** a visitor browses its category or uses search/
   browse on the public site, **Then** the recipe appears there too, not only at its own direct
   address.

---

### User Story 2 - Remove selected recipes from the public site (Priority: P1)

The owner marks one or more currently-live recipes with the publish toggle, then clicks
"Unpublish." Those recipes stop being reachable on the public site and disappear from category
listings and the search/browse index. Recipes the owner did not toggle remain exactly as they
were, whether live or not.

**Why this priority**: The owner must be able to permanently or temporarily take a recipe private
again (e.g. it needs rework, or was never meant to be public) — without this, "publish" would be a
one-way door, which the owner explicitly rejected during planning.

**Independent Test**: Can be fully tested by toggling a currently-live recipe, clicking
"Unpublish," and confirming it is no longer reachable on the public site or in any listing, while
an untoggled live recipe stays live.

**Acceptance Scenarios**:

1. **Given** a live recipe with its publish toggle on, **When** the owner clicks "Unpublish,"
   **Then** the recipe's detail page is no longer reachable on the public site.
2. **Given** a live recipe whose publish toggle is off, **When** the owner clicks "Unpublish,"
   **Then** that recipe remains live and unchanged.
3. **Given** an unpublished recipe, **When** a visitor browses its former category or searches for
   it, **Then** it no longer appears anywhere on the public site.
4. **Given** several recipes toggled on, **When** the owner clicks "Unpublish," **Then** every
   toggle the action acted on resets to off afterward.

---

### User Story 3 - The public site reflects a stable, deliberate snapshot (Priority: P1)

A visitor browsing the public site always sees exactly what the last Publish/Unpublish run
produced — never a half-finished edit the owner is still working on in the backoffice, and never a
recipe the owner has decided to keep private.

**Why this priority**: Without this guarantee, editing a live recipe in the backoffice would risk
exposing unfinished or incorrect content to visitors mid-edit — an explicit requirement from
planning, and a direct application of the project's "explicit over automatic" principle.

**Independent Test**: Can be fully tested by editing a field on an already-published recipe
without clicking Publish again, and confirming the public site still shows the old content
unchanged; then clicking Publish and confirming the new content appears.

**Acceptance Scenarios**:

1. **Given** a live, published recipe, **When** the owner edits its content in the backoffice but
   does not publish again, **Then** the public site continues to show the previously-published
   version.
2. **Given** a recipe the owner has never toggled on, **When** the owner finishes writing it,
   **Then** it never appears on the public site, regardless of how complete it is.
3. **Given** a recipe actively being published, **When** a visitor requests the public site during
   that run, **Then** they see either the complete previous snapshot or the complete new one —
   never a partially-updated mix of pages, index, and category listings.

---

### User Story 4 - Browse and search the public site (Priority: P2)

A visitor to `cuisine.libertpierrick.com` can browse recipes by category and search/filter across
all currently-published recipes, in their chosen language, without a page reload for each
interaction.

**Why this priority**: Publishing individual recipes (User Stories 1-3) already delivers value —
each recipe is independently reachable at its own address — but a real site needs browsing and
search to be usable day-to-day; this builds directly on the published output those stories
produce.

**Independent Test**: Can be fully tested by publishing several recipes across different
categories, then confirming a visitor can browse by category and find a specific recipe via
search, in more than one supported locale.

**Acceptance Scenarios**:

1. **Given** published recipes in multiple categories, **When** a visitor opens a category page,
   **Then** they see every currently-published recipe in that category, in their chosen locale.
2. **Given** published recipes, **When** a visitor searches or filters on the public site,
   **Then** matching results update without a full page reload.
3. **Given** a recipe published in only one locale, **When** a visitor browses in a locale that
   recipe has no content for, **Then** that recipe does not appear as broken or empty — it is
   simply absent from that locale's listings.

---

### User Story 5 - Manage the backoffice from its own subdomain (Priority: P3)

The owner accesses the backoffice at `admin.cuisine.libertpierrick.com` instead of the previous
auto-generated address, with everything working exactly as before.

**Why this priority**: Lower risk and smaller in scope than the publishing mechanism itself — the
backoffice is already fully functional at its current address — but was explicitly included in
this feature's scope during planning, since both subdomains belong to the same DNS/certificate
setup this feature introduces.

**Independent Test**: Can be fully tested by navigating to `admin.cuisine.libertpierrick.com`,
signing in, and performing an existing backoffice action (e.g. editing a recipe) exactly as
before.

**Acceptance Scenarios**:

1. **Given** the feature is deployed, **When** the owner navigates to
   `admin.cuisine.libertpierrick.com`, **Then** they reach the same backoffice, sign in the same
   way, and every existing capability works unchanged.

---

### Edge Cases

- What happens if the owner clicks "Publish" or "Unpublish" while a previous run triggered by
  either button is still in progress? (The system must not start a second, overlapping run against
  the same recipes; the owner must be told a run is already in progress.)
- What happens if a publish run fails partway through (e.g. one recipe fails to render)? (Recipes
  unaffected by the failure keep their prior public state; the owner sees a clear failure
  indication and can retry; the public site is never left showing a broken or partial page.)
- What happens to a recipe's category and search/browse listing if the owner changes its category
  after it was published, but doesn't toggle and republish it? (The public listing keeps showing
  the recipe under its previously-published category until the owner republishes it — consistent
  with User Story 3's "stable snapshot" guarantee.)
- What happens if every locale of a published recipe is later removed from the backoffice's draft
  content entirely? (Out of scope for this feature: recipe deletion/content-removal handling is
  unchanged from the existing recipe-authoring feature; this feature only concerns the toggle-
  driven publish/unpublish action itself.)
- What happens when the owner wants to see a recipe's current actual public status (not just the
  toggle)? (The backoffice shows each recipe's current status — e.g. live, not published,
  publishing, unpublishing — independently of the one-shot toggle.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the owner mark any individual recipe with a persistent, per-recipe
  toggle, independent of that recipe's current public status.
- **FR-002**: System MUST provide two distinct, explicit actions — "Publish" and "Unpublish" —
  each of which acts only on recipes currently toggled on at the moment the action is triggered.
- **FR-003**: The "Publish" action MUST render and make live, on the public site, every recipe
  toggled on when it is triggered, without changing the public status of any recipe not toggled
  on.
- **FR-004**: The "Unpublish" action MUST remove from the public site every recipe toggled on when
  it is triggered, without changing the public status of any recipe not toggled on.
- **FR-005**: System MUST reset the toggle to off, for every recipe a Publish or Unpublish action
  acted on, once that action completes.
- **FR-006**: System MUST allow a recipe to remain permanently unpublished regardless of its
  completeness, until the owner explicitly toggles and publishes it.
- **FR-007**: The public site MUST reflect only the content produced by the most recently
  completed Publish/Unpublish run — never the backoffice's current, possibly-since-edited draft
  content for any recipe.
- **FR-008**: System MUST show, per recipe in the backoffice, its current actual public status
  (e.g. live, not published, publishing in progress, unpublishing in progress), independent of and
  in addition to the one-shot toggle state.
- **FR-009**: System MUST prevent a new Publish or Unpublish run from starting while one triggered
  by either action is already in progress, and MUST inform the owner when this happens.
- **FR-010**: If a Publish or Unpublish run fails partway through, the system MUST leave every
  recipe not involved in the failure in its prior public state, and MUST make the failure clearly
  visible to the owner.
- **FR-011**: The public site MUST serve every currently-published recipe's detail page, in every
  locale that recipe has content for, as pre-rendered content requiring no server-side processing
  to view.
- **FR-012**: The public site MUST let a visitor browse published recipes by category and
  search/filter across them, within their chosen locale, updating results without a full page
  reload.
- **FR-013**: The public site's browse/search index and category listings MUST, at all times,
  reflect exactly the same content as what was actually last rendered to each recipe's detail
  page — never content from a more recent, not-yet-published edit.
- **FR-014**: System MUST serve the public site at `cuisine.libertpierrick.com` and the backoffice
  at `admin.cuisine.libertpierrick.com`.
- **FR-015**: A recipe published in only some locales MUST appear, on the public site, solely
  within those locales' browsing/search/category surfaces — never as a broken or empty page in a
  locale it has no content for.

### Key Entities

- **Recipe publish state**: Per recipe, tracks whether it is currently selected for the next
  Publish/Unpublish action (the one-shot toggle, always reset to off once acted on) and its
  current actual public status (e.g. live, not published, publishing, unpublishing) — these are
  two independent pieces of state, not one.
- **Published snapshot**: The record of what was actually last rendered to the public site for a
  given recipe (its title, category, slug, and locale, per locale) — distinct from that recipe's
  current, possibly newer, draft content in the backoffice. This is what the public site's browse/
  search index and category listings are built from, guaranteeing they never show content ahead of
  what visitors can actually reach.
- **Publish run**: One execution of the Publish or Unpublish action against the recipes toggled on
  when it started — has a status (in progress, succeeded, failed) the owner can observe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A recipe toggled on and published becomes reachable on the public site, with its
  content matching what was in the backoffice at the moment of publishing.
- **SC-002**: 100% of recipes not toggled on when Publish or Unpublish is clicked retain their
  prior public status, unchanged.
- **SC-003**: 100% of recipes acted on by a Publish or Unpublish run have their toggle reset to
  off once that run completes.
- **SC-004**: A visitor can find any currently-published recipe either by browsing its category or
  via search, in any locale that recipe has content for, without a full page reload.
- **SC-005**: Editing an already-published recipe's content without republishing it never changes
  what visitors see on the public site.
- **SC-006**: A failed publish/unpublish run never leaves the public site showing a broken, blank,
  or partially-rendered page for any recipe.
- **SC-007**: The owner can perform every existing backoffice capability from
  `admin.cuisine.libertpierrick.com` exactly as they could from its previous address.
- **SC-008**: The public site's category listings and search/browse index never disagree with what
  a recipe's own detail page actually shows.

## Assumptions

- Recipe-detail-page interactivity (servings multiplier, metric/imperial unit toggle) is out of
  scope for this feature, per the project's constitution and explicit planning decision — it is a
  separate, later feature building on the static pages this feature produces.
- DNS for `libertpierrick.com` is already delegated to this project's AWS account (confirmed
  during planning); provisioning the actual DNS records and certificates for both subdomains is
  part of this feature's implementation, not a prerequisite outside it.
- A Publish or Unpublish run may take longer than a typical synchronous web request; the owner is
  shown an in-progress status and the eventual result rather than waiting on a blocking request.
- The existing recipe-authoring data model (001) and its locale/category structure are reused
  unchanged as the source of draft content; this feature only adds publish-related state alongside
  it, per the Key Entities above.
- Single-owner scale (on the order of 100-1000 recipes, infrequent publish runs) applies, per the
  project's constitution — no pagination, rate-limiting, or multi-run-queueing design beyond
  FR-009's single-run-at-a-time guarantee is needed.
