# Feature Specification: Recipe Authoring

**Feature Branch**: `001-recipe-authoring`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Backoffice capability for the site owner to create, edit, and save
a recipe with structured ingredients (grouped, with quantity/unit and optional approximate-volume
equivalents), rich-text steps, a category and tags, and content in multiple languages — saved as a
draft. Publishing the recipe to the public site, AI-assisted translation drafts, and AI-assisted
approximate-measure suggestions are separate, later features built on top of this one."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a new recipe (Priority: P1)

The site owner opens the backoffice and creates a brand-new recipe: a name and description, one or
more groups of structured ingredients, and the preparation steps as formatted text. They save it as
a draft without needing to finish every field or every language first.

**Why this priority**: This is the core value of the whole project — replacing a blog tool's poor
ingredient handling with something structured and purpose-built. Nothing else in the system matters
if a recipe cannot be authored.

**Independent Test**: Can be fully tested by creating a new recipe end to end (name, at least one
ingredient group with at least one ingredient line, step text) and confirming it is saved and
retrievable as a draft — delivers value on its own even before publishing exists.

**Acceptance Scenarios**:

1. **Given** the backoffice is open to "new recipe", **When** the owner enters a name, description,
   one ingredient group containing one ingredient line (quantity, unit, name), and step text, and
   saves, **Then** the recipe exists as a draft and reopening it shows the same content.
2. **Given** a new recipe in progress, **When** the owner saves before entering every field (e.g.
   no description yet), **Then** the save succeeds and the recipe remains a draft with the
   incomplete fields empty, not blocked by validation.
3. **Given** a new recipe, **When** the owner adds a second ingredient group (e.g. "For the
   filling") with its own ingredient lines, **Then** both groups and their lines are saved and
   displayed in the order they were added.

---

### User Story 2 - Edit an existing draft recipe (Priority: P1)

The site owner reopens a previously saved draft recipe and changes it: edits text, adds or removes
ingredient lines or groups, reorders groups/lines/steps, or changes the category/tags — then saves
again.

**Why this priority**: Recipes are iterated on (the owner "adjusts recipes to their taste" per the
project's own motivation) — authoring is not a one-shot action, so editing must be as solid as
creation.

**Independent Test**: Can be fully tested by opening a draft created in User Story 1, changing an
ingredient quantity and reordering two ingredient lines, saving, and confirming the new state
persists and the old state is gone.

**Acceptance Scenarios**:

1. **Given** an existing draft recipe, **When** the owner changes an ingredient's quantity and
   saves, **Then** reopening the recipe shows the updated quantity.
2. **Given** an existing draft recipe with two ingredient lines in a group, **When** the owner
   reorders them and saves, **Then** the new order persists.
3. **Given** an existing draft recipe, **When** the owner deletes an ingredient line, an entire
   ingredient group, or a step, **Then** the deleted item no longer appears after saving.
4. **Given** an existing draft recipe, **When** the owner changes its category or tags, **Then**
   the updated category/tags persist.

---

### User Story 3 - Author content in multiple languages (Priority: P2)

The site owner adds content for a second language (e.g. French) to a recipe that already has
English content: a translated name/description, translated ingredient names, and translated step
text — while quantities, units, and the recipe's structure (groups, ordering, category) stay shared
across languages rather than being re-entered.

**Why this priority**: Multi-language support is a primary purpose of the site, but a recipe is
already independently valuable in a single language (User Story 1), so this is additive rather than
blocking.

**Independent Test**: Can be fully tested by taking a recipe authored in English only, switching to
a second locale in the editor, entering translated text fields, saving, and confirming both
languages' content are retrievable independently while the ingredient quantities/units are not
duplicated per language.

**Acceptance Scenarios**:

1. **Given** a recipe with only English content, **When** the owner switches to French and enters a
   translated name, description, ingredient names, and steps, **Then** saving preserves both the
   English and French content as independently readable versions of the same recipe.
2. **Given** a recipe with English and French content, **When** the owner changes an ingredient's
   quantity (a structural, non-text property), **Then** the change applies to the recipe regardless
   of which locale tab is active — it is not duplicated or out of sync between languages.
3. **Given** a recipe with English content only, **When** the owner views it without adding a
   second language, **Then** the recipe remains fully valid and saveable with just one language.

---

### Edge Cases

- What happens when the owner tries to save a recipe with no name at all? (A name is the minimum
  identifying information needed to find and open a draft again — the system MUST require it.)
- What happens when an ingredient group is created with zero ingredient lines in it? (Allowed while
  in progress, but should be visibly empty/incomplete rather than silently dropped.)
- What happens when the owner deletes the last remaining ingredient group or the last remaining
  locale's content from a recipe? (The recipe MUST still be left in a valid, saveable state —
  either the action is prevented, or a recipe is allowed to be temporarily empty of ingredients
  while still a draft.)
- What happens when very long step text or a very large number of ingredient lines is entered? (The
  system MUST continue to save and reopen correctly; no arbitrary low limit is assumed.)
- What happens when the same category name is entered with different casing on two different
  recipes (e.g. "Dessert" vs "dessert")? (Treated as the same category, to avoid accidental
  duplicate categories.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the owner to create a new recipe with at least a name and one
  locale's content.
- **FR-002**: The system MUST require a non-empty recipe name before a recipe can be saved, even as
  a draft.
- **FR-003**: The system MUST allow a recipe's ingredients to be organized into zero or more named
  groups (e.g. "For the dough"), each containing zero or more ingredient lines.
- **FR-004**: Each ingredient line MUST capture a quantity, an optional unit (some ingredients are
  counted, not measured), and a name.
- **FR-005**: The system MUST allow an ingredient line to optionally record an approximate
  volume-equivalent measure (e.g. "≈ 5 tbsp") alongside its quantity, entered manually in this
  feature (AI-assisted suggestion of this value is a separate, later feature).
- **FR-006**: The system MUST allow the owner to record a recipe's steps/instructions as formatted
  (rich) text, including basic emphasis (bold/italic) and inline images.
- **FR-007**: The system MUST allow the owner to assign a recipe to exactly one category and zero
  or more free-form tags.
- **FR-008**: The system MUST treat category names as equivalent regardless of letter case, so that
  "Dessert" and "dessert" resolve to the same category rather than creating a duplicate.
- **FR-009**: The system MUST allow a recipe's name, description, ingredient names, and step text to
  be entered and edited independently per language, while quantity, unit, approximate-equivalent,
  ingredient/step ordering, and category/tags are shared across all languages of the same recipe
  (not duplicated per language).
- **FR-010**: The system MUST allow the owner to save a recipe as a draft at any point, whether or
  not every field or every language is complete.
- **FR-011**: The system MUST allow the owner to reopen any previously saved draft recipe and see
  all of its previously saved content, across all languages it has content for.
- **FR-012**: The system MUST allow the owner to reorder ingredient groups, ingredient lines within
  a group, and steps.
- **FR-013**: The system MUST allow the owner to delete an ingredient line, an ingredient group, a
  step, or an entire draft recipe.
- **FR-014**: The system MUST NOT require all languages to have content before a recipe can be
  saved — a recipe with only one language of content is a valid, complete draft.

### Key Entities

- **Recipe**: A single dish, identified by a stable id and a required name. Holds its draft/
  published status (this feature only ever produces drafts), its category, its tags, and its
  structure (ingredient groups and their ordering, steps and their ordering). Has one set of
  locale content per language it has been authored in.
- **Ingredient Group**: A named subsection of a recipe's ingredient list (e.g. "For the filling"),
  with an explicit order relative to other groups in the same recipe.
- **Ingredient Line**: A single ingredient within a group — a quantity, an optional unit, a name
  (per-locale text), and an optional approximate volume-equivalent measure — with an explicit order
  relative to other lines in the same group.
- **Locale Content**: The translatable portion of a recipe for one language — its name,
  description, ingredient-line names, and step text. A recipe may have locale content for one or
  more languages.
- **Category**: A single label a recipe is filed under (e.g. "Dessert"), case-insensitively unique.
- **Tag**: A free-form label a recipe can carry zero or more of (e.g. "apple", "autumn").

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can author a complete new recipe (name, description, at least two
  ingredient groups, and step text) in a single sitting without data loss.
- **SC-002**: 100% of saved draft recipes, when reopened, show exactly the content that was present
  at the last save — no silent loss of groups, lines, steps, or locale content.
- **SC-003**: Adding a second language of content to an existing recipe requires re-entering only
  translatable text (name, description, ingredient names, step text) — quantities, units, and
  structure are never re-entered.
- **SC-004**: Reordering or deleting an ingredient group, ingredient line, or step never corrupts or
  loses unrelated content elsewhere in the same recipe.

## Assumptions

- Only one editor (the site owner) uses the backoffice; this feature does not need to handle
  simultaneous edits to the same recipe by multiple people.
- Authentication/access control for the backoffice exists independently of this feature; these
  scenarios assume the owner is already signed in.
- Publishing a recipe to the public static site is a separate, later feature — this feature's scope
  ends at "saved as a draft, retrievable in the backoffice."
- AI-assisted translation drafting and AI-assisted approximate-measure suggestions are separate,
  later features — this feature only requires that the corresponding fields (locale text,
  approximate-equivalent) can be entered and edited manually.
- Category management beyond assigning an existing-or-new category label to a recipe (e.g. a
  dedicated category list/merge/rename tool) is out of scope for this feature.
