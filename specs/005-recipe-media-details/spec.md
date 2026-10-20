# Feature Specification: Recipe Media and Serving Details

**Feature Branch**: `005-recipe-media-details`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Add recipe cover images, prep/cook time, and interactive servings
scaling to the public recipe site — the approved mockup (`mockups/Main.dc.html`) shows a hero
photo, a 'Prep 25 min · Bake 45 min' line next to the category badge, and a servings stepper that
recalculates every ingredient quantity live. These were identified as gaps against the mockup
after 004 shipped, deliberately deferred as a separate feature since they need new recipe fields
and backoffice authoring UI, not just template changes.

Decisions locked during brainstorming (do not re-litigate):
1. One shared cover image per recipe, not per locale — photos aren't language-specific, and
   per-locale images would double upload effort for no benefit on a single-editor site.
2. Interactive servings scaling: a working +/- stepper on the public recipe page recalculates
   every ingredient's displayed quantity client-side, matching the mockup's prototype — not a
   static 'Serves N' label.
3. Metric/Imperial unit toggle is explicitly OUT of scope — this is a personal, single-editor
   European site with metric-only ingredient data; building a real toggle would mean either
   dual-entering every ingredient's quantity in both unit systems or building lossy unit-conversion
   logic, neither of which has a clear use case here.
4. While touching the ingredient rendering code for scaling, also render each ingredient line's
   already-modeled (001) but never-displayed `approxEquivalent` (e.g. '250g flour ≈ 16 tbsp') —
   the mockup shows this and the data has existed, unused, since 001.

Infrastructure note confirmed during scoping: the existing images S3 bucket (`infra/storage.ts`,
provisioned in 002) is already `access: 'public'`, and `POST /images` (002) already issues
presigned upload URLs and public `imageUrl`s — no new infrastructure is needed to serve a cover
image once uploaded; only the recipe data model, backoffice authoring UI, and public-site render
pipeline need to be built to actually attach and display one."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner attaches prep/cook time and servings to a recipe (Priority: P1)

As the site owner, while editing a recipe in the backoffice, I want to record how many people it
serves and how long it takes to prepare and cook, so visitors on the public site know what to
expect before committing to a recipe.

**Why this priority**: This is the smallest independently-shippable slice (three plain numeric
fields, no image upload, no client-side scaling) and is a prerequisite for User Story 3's
interactive scaling, which needs a base servings count to scale from.

**Independent Test**: Can be fully tested by setting prep minutes, cook minutes, and base servings
on a recipe in the backoffice, publishing it, and confirming the rendered public recipe page shows
"Prep 25 min · Bake 45 min" and "Serves 6" (or whichever values were set) next to the category
badge.

**Acceptance Scenarios**:

1. **Given** a recipe being edited in the backoffice, **When** the owner enters prep minutes,
   cook minutes, and base servings and saves, **Then** those values persist and are shown back
   when the recipe is reopened for editing.
2. **Given** a recipe with prep/cook time and servings set, **When** it is published, **Then**
   the rendered public page shows a "Prep X min · Bake Y min" line and the servings count next to
   the category badge, in the hero section.
3. **Given** a recipe where one or more of prep minutes, cook minutes, or servings was never set,
   **When** it is published, **Then** the rendered page omits exactly the fields that are unset,
   without showing a blank, zero, or placeholder value in their place.
4. **Given** an existing recipe published before this feature shipped (no values set for any of
   these fields), **When** the site owner next publishes it unchanged, **Then** the page renders
   successfully with these fields simply absent — no error, no re-authoring required.

---

### User Story 2 - Owner attaches a cover image to a recipe (Priority: P2)

As the site owner, while editing a recipe in the backoffice, I want to upload one cover photo for
the recipe, so the public recipe page and the browse/home recipe cards show a photo instead of
plain text.

**Why this priority**: Independently valuable (a photo meaningfully improves the browse/home
pages even without scaling or time/servings), but ranked below User Story 1 because it depends on
genuinely new upload UI in the backoffice (reusing the existing presigned-upload flow built for
step images in 001/002, but wiring it to a new recipe-level field), rather than just new form
fields.

**Independent Test**: Can be fully tested by uploading a cover image to a recipe in the
backoffice, publishing it, and confirming the image appears as the hero photo on the public recipe
detail page and as a thumbnail on that recipe's card on the home page and its category's browse
page.

**Acceptance Scenarios**:

1. **Given** a recipe being edited in the backoffice, **When** the owner uploads a cover image,
   **Then** the image is stored in the existing public images bucket and the recipe records its
   URL.
2. **Given** a recipe with a cover image set, **When** it is published, **Then** the rendered
   public recipe page shows the image as a hero photo below the title/description, and the
   recipe's card on the home page and its category's browse page shows it as a thumbnail.
3. **Given** a recipe with no cover image set, **When** it is published, **Then** the rendered
   page and its browse/home cards render without a broken image or placeholder — the image area is
   simply omitted.
4. **Given** a recipe that already has a cover image, **When** the owner uploads a new one and
   saves, **Then** the recipe's cover image updates to the new one on the next publish (the old
   image file is not required to be deleted from the images bucket — orphaned image cleanup is out
   of scope, matching this project's existing images-bucket lifecycle, which has no deletion path
   today either).

---

### User Story 3 - Visitor adjusts servings and sees ingredient quantities recalculate (Priority: P3)

As a site visitor viewing a recipe, I want to change the number of servings with a +/- control and
see every ingredient's quantity update immediately, so I can cook the right amount without doing
the math myself.

**Why this priority**: The most valuable single interaction for an actual cook following the
recipe, but depends on User Story 1's base servings count existing on the recipe, so it is ordered
last.

**Independent Test**: Can be fully tested by publishing a recipe with a base servings count and at
least one ingredient line, opening its public page, clicking the stepper's "+" control, and
confirming every ingredient quantity on the page updates to the proportionally scaled value (and
likewise for "-").

**Acceptance Scenarios**:

1. **Given** a published recipe with base servings of 6 and an ingredient line of "250 g flour",
   **When** a visitor increases the servings control to 12, **Then** that ingredient's displayed
   quantity updates to "500 g" without a page reload.
2. **Given** the same recipe, **When** a visitor decreases servings below 1, **Then** the control
   does not go below 1 serving (scaling down to zero or negative servings is prevented).
3. **Given** an ingredient line that has an approximate volume equivalent recorded (e.g. "250 g
   flour ≈ 16 tbsp"), **When** servings are scaled, **Then** the approximate equivalent's quantity
   scales proportionally too (e.g. to "≈ 32 tbsp" at double servings).
4. **Given** a recipe with no base servings set (User Story 1's field left empty), **When** it is
   published, **Then** the public page shows ingredient quantities as plain static text with no
   servings stepper at all — scaling is only offered when there is a base count to scale from.
5. **Given** a recipe whose ingredient line has no unit (a counted ingredient, e.g. "6 apples"),
   **When** servings are scaled, **Then** the quantity scales the same way and is shown without a
   unit, exactly as it is today.

---

### Edge Cases

- A scaled quantity that is not a whole number (e.g. scaling "3 eggs" from 6 to 4 servings yields
  2 eggs exactly, but scaling "250 g flour" from 6 to 4 servings yields a repeating decimal) MUST
  be rounded for display to one decimal place, with a trailing ".0" dropped (matching the
  mockup's own rounding approach) — never shown with more precision than that.
- The servings stepper has no fixed upper bound in these requirements beyond "greater than zero";
  the owner's authored base servings value is itself not constrained to a particular range beyond
  being a positive whole number.
- A recipe published under 004 (before this feature existed) has no cover image, prep/cook time,
  or base servings recorded anywhere — publishing it again after this feature ships MUST succeed
  and simply render without these optional elements, per User Story 1 Acceptance Scenario 4 and
  User Story 2 Acceptance Scenario 3.
- If the owner clears a previously-set prep minutes, cook minutes, base servings, or cover image
  value and republishes, the rendered page MUST stop showing that element (the publish pipeline
  renders from current draft data for these fields, the same as every other recipe field — only
  the published-snapshot index itself is append-only per 004's design, not per-recipe field
  values).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the site owner record, per recipe (not per locale), an optional
  preparation time in minutes, an optional cook time in minutes, and an optional base servings
  count, editable alongside the recipe's existing category assignment.
- **FR-002**: The system MUST let the site owner upload one optional cover image per recipe (not
  per locale), using the existing presigned-upload backend endpoint (`POST /images`, 002) — which
  has no frontend caller today (the in-step image button only inserts by URL) — via new backoffice
  upload UI built in this feature.
- **FR-003**: When a recipe with prep time, cook time, and/or base servings set is published, the
  rendered public recipe page MUST display exactly the fields that are set, each clearly labeled
  (e.g. "Prep", "Bake", "Serves"), and MUST omit any field left unset — never a blank, zero, or
  placeholder in its place.
- **FR-004**: When a recipe with a cover image set is published, the rendered public recipe page
  MUST display it as a hero image, and the recipe's entry in the browse index (used to render
  recipe cards on the home page and category pages) MUST carry the image so cards can show it as a
  thumbnail.
- **FR-005**: When a recipe has no cover image, the rendered recipe page and its browse/home cards
  MUST render without a broken image, placeholder box, or empty `<img>` element.
- **FR-006**: When a recipe has a base servings count set, the rendered public recipe page MUST
  offer a client-side control to increase or decrease the displayed servings count (minimum 1),
  and changing it MUST recalculate every ingredient line's displayed quantity — and approximate
  equivalent, when one is recorded — proportionally, without a page reload.
- **FR-007**: When a recipe has no base servings count set, the rendered public recipe page MUST
  show ingredient quantities as static text with no servings control, exactly as it does before
  this feature (FR-006 only activates when a base servings count exists).
- **FR-008**: Scaled quantities MUST be rounded to at most one decimal place for display, with a
  trailing ".0" dropped, regardless of how many decimal places the underlying scaling arithmetic
  produces.
- **FR-009**: The system MUST continue to successfully publish and render recipes that have none
  of this feature's new fields set (including every recipe published before this feature existed)
  — these fields are all optional and additive, never required.
- **FR-010**: This feature MUST NOT introduce any metric/imperial unit conversion or toggle —
  ingredient quantities and units continue to be shown exactly as authored, only scaled by the
  servings multiplier.

### Key Entities

- **Recipe (extended)**: gains three new recipe-level (not per-locale) optional attributes —
  preparation time in minutes, cook time in minutes, and a base servings count — alongside a
  fourth, a cover image URL, pointing at an object in the existing public images bucket. All four
  are independent of each other and of any particular locale's translated content.
- **Published recipe snapshot (extended, from 004)**: gains the cover image URL, so the
  browse/home index can render a thumbnail without a separate lookup back to the recipe's draft
  data (consistent with 004's design: the index is built only from snapshot data, never live draft
  data).
- **Ingredient line (unchanged structure, newly fully rendered)**: already carries an optional
  approximate volume equivalent (quantity + unit) per line, authored in 001 but never rendered on
  the public site until this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A recipe with prep time, cook time, base servings, and a cover image set, once
  published, shows all four on its public page without any manual post-processing step beyond the
  normal Publish action already in place from 004.
- **SC-002**: Every recipe published under 004 before this feature shipped continues to publish
  and render successfully afterward, with no error and no required re-authoring, simply omitting
  the new optional fields.
- **SC-003**: A visitor can change a recipe's displayed servings count and see every ingredient
  quantity on the page update within the same interaction, with no network request and no visible
  page reload.
- **SC-004**: Scaled ingredient quantities are never displayed with more than one decimal place of
  precision.

## Assumptions

- Cover images are a single photo per recipe, shared across every locale — not per-locale, per
  User Story 2 and the locked scoping decision.
- Prep time, cook time, and base servings are recipe-level facts (like quantities and units
  already are, per 001's data model split), not translatable per-locale text — they need no
  localization.
- The existing images S3 bucket and `POST /images` presigned-upload endpoint (built in 002) are
  reused as-is; no new upload endpoint, bucket, or access-control change is needed, since the
  bucket is already `access: 'public'`.
- No unit conversion (metric/imperial) is in scope — only proportional scaling of the
  already-authored quantity and unit, per the locked scoping decision.
- Orphaned cover images left behind in the images bucket after a replacement upload are not
  cleaned up, consistent with this project's existing images-bucket lifecycle (step images already
  have no deletion path either).
- A recipe's base servings count, when set, is a positive whole number; this feature does not
  define behavior for a zero, negative, or fractional authored base servings value beyond normal
  input validation at the authoring form.
