# Quickstart: Recipe Media and Serving Details

Validates the three user stories end-to-end once implemented. Assumes the backoffice and public
site are deployed (004's state) and the owner can log into the backoffice.

## Prerequisites

- A test recipe exists (or create one via the backoffice) with at least one ingredient line with a
  non-null `unit` and a recorded `approxEquivalent`, and assigned to a category.
- `backend`, `public-site`, `frontend` dependency installs and local test runners from 001-004
  still apply unchanged (`npm test` in each package).

## User Story 1 — prep/cook time and servings fields

1. Open the test recipe in the backoffice editor.
2. Set Prep time = 25, Cook time = 45, Servings = 6. Save.
3. Reload the editor — confirm the three values are shown back (FR-001 Acceptance Scenario 1).
4. Toggle the recipe for publish and run Publish (existing 004 flow).
5. Fetch the rendered page (`GET /<locale>/recipes/<slug>.html` from the public bucket, or via the
   live CloudFront URL) and confirm it contains a "Prep 25 min · Bake 45 min" line and a servings
   indicator (FR-003).
6. Clear Cook time only, save, republish, and confirm the rendered page now omits exactly the Bake
   portion while still showing Prep and Serves (spec.md Edge Cases — per-field omission).

## User Story 2 — cover image

1. In the backoffice editor, use the new cover image upload control to pick a small test JPEG.
2. Confirm the upload completes and a preview appears (FR-002 Acceptance Scenario 1).
3. Save, publish, and fetch the rendered recipe page — confirm a hero `<img>` pointing at the
   images bucket is present (FR-004).
4. Fetch that locale's `browse-index.json` — confirm the recipe's entry carries the same
   `coverImageUrl`, and that the home page / category page for that recipe renders a thumbnail
   (FR-004).
5. Remove the recipe's cover image (clear the field), republish, and confirm the hero image element
   and the card thumbnail are both gone entirely — no broken image, no placeholder box (FR-005).

## User Story 3 — interactive servings scaling

1. On the published recipe page from User Story 1/2 (servings = 6, an ingredient of "250 g flour"
   with `approxEquivalent` "16 tbsp"), open it in a browser.
2. Click the stepper's "+" control until servings shows 12.
3. Confirm, without a page reload, the flour line now reads "500 g" and its approximate equivalent
   reads "≈ 32 tbsp" (FR-006, Acceptance Scenario 1 and 3).
4. Click "-" repeatedly past 1 — confirm the control stops at 1 and never goes to 0 or negative
   (Acceptance Scenario 2).
5. Open a different recipe that has no `baseServings` set — confirm it shows ingredient quantities
   as plain static text with no stepper control at all (FR-007, Acceptance Scenario 4).
6. Scale a recipe with a non-round result (e.g. a recipe with servings base 6, an ingredient of
   "250 g", scaled to 4 servings → 166.67g) and confirm it displays as "166.7" with at most one
   decimal place, never more (FR-008).

## Regression check — recipes published under 004 before this feature

1. Find (or simulate, via DynamoDB) a recipe item that predates this feature — has no
   `prepMinutes`/`cookMinutes`/`baseServings`/`coverImageUrl` attributes at all on its `META` item.
2. Publish it (or confirm an already-published one still passes a `rebuildIndex()` run without
   error).
3. Confirm its rendered page shows no time/servings/image elements and no stepper, and its browse
   index entry has `"coverImageUrl": null` — no error anywhere in the pipeline (FR-009, SC-002).
