# Feature Specification: Translation Drafting

**Feature Branch**: `003-translation-drafting`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Add AI-assisted translation drafting to the backoffice recipe editor
using the Claude API. Fixed direction for now: French (authored) to English (drafted). Whole-recipe,
single-click generation (name, description, group names, ingredient names, every step's rich text);
the owner expects to manually polish the draft afterward. If English already has content, confirm
before overwriting. Rich-text formatting (bold/italic/bullet lists/images) must be preserved exactly
in the translated steps. The AI never auto-saves or auto-publishes anything — the draft only
populates the editor's in-browser state; the owner still has to use the existing Save action.
Builds on 001-recipe-authoring (the editor, the multi-locale data model) and 002-deploy-infrastructure
(the deployed, Cognito-authenticated backend)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draft an English translation from a French recipe (Priority: P1)

The owner has written a recipe in French in the backoffice. From the editor, they trigger one
action that produces a complete English draft — name, description, ingredient group names,
ingredient names, and every step's text — which they then review and polish by hand before saving.

**Why this priority**: This is the entire point of the feature. Without it, there is no reason to
build anything else here — it is the one user-facing capability this feature exists to deliver.

**Independent Test**: Can be fully tested by authoring a French recipe with a name, description, at
least one ingredient group with one ingredient, and at least one step, triggering the translation
action, and confirming English text appears in every one of those fields without requiring a page
reload or any other feature.

**Acceptance Scenarios**:

1. **Given** a recipe with French content and no English content yet, **When** the owner triggers
   "Generate translation draft", **Then** an English draft appears for the recipe's name,
   description, ingredient group names, ingredient names, and step text, without saving anything
   to persistent storage yet.
2. **Given** a freshly generated English draft, **When** the owner edits any of the drafted text,
   **Then** their edit is preserved exactly like editing any other locale's content today.
3. **Given** a freshly generated English draft the owner is satisfied with, **When** the owner uses
   the existing save action, **Then** the English content is persisted exactly as it would be if
   the owner had typed it by hand.

---

### User Story 2 - Formatting in step text survives translation (Priority: P1)

A recipe's steps contain rich text — bold or italic emphasis, bullet lists, inline images. When the
owner generates an English draft, that formatting appears unchanged in the English version; only
the words themselves are translated.

**Why this priority**: Step text routinely uses emphasis (ingredient names in bold, etc.) and the
mockup/constitution both already describe steps as rich text — a translation feature that silently
discards formatting would make every recipe with any formatting worse after translating it, not
better, undermining the feature's entire value proposition.

**Independent Test**: Can be fully tested by authoring a step with bold text, italic text, a bullet
list, and an inline image, generating a translation draft, and confirming the English version has
the same bold/italic spans, the same list structure, and the same image, with only the surrounding
words translated.

**Acceptance Scenarios**:

1. **Given** a step containing a bolded phrase, **When** a translation draft is generated,
   **Then** the translated step has an equivalent phrase (in English) still bolded.
2. **Given** a step containing a bullet list, **When** a translation draft is generated, **Then**
   the translated step has the same number of list items in the same order, each translated.
3. **Given** a step containing an inline image, **When** a translation draft is generated,
   **Then** the translated step still contains that exact image, unchanged.

---

### User Story 3 - Confirm before overwriting existing English content (Priority: P2)

If the recipe already has some English content — whether from a previous translation draft or
content the owner typed by hand — triggering the translation action again asks for confirmation
before replacing it.

**Why this priority**: Prevents an accidental click from silently destroying English text the owner
may have already spent time refining; valuable as a safety net, but the feature is still usable
without it for a recipe's first translation (no existing content to lose).

**Independent Test**: Can be fully tested by giving a recipe existing English content, triggering
the translation action, confirming a warning appears, declining it and confirming nothing changed,
then triggering it again and accepting to confirm the English content is fully replaced.

**Acceptance Scenarios**:

1. **Given** a recipe whose English locale already has any content, **When** the owner triggers
   "Generate translation draft", **Then** they are asked to confirm before anything is overwritten.
2. **Given** that confirmation prompt, **When** the owner declines, **Then** the existing English
   content is left completely unchanged and no translation request is made.
3. **Given** that confirmation prompt, **When** the owner accepts, **Then** every English field
   (name, description, group names, ingredient names, every step) is replaced by the new draft.

---

### Edge Cases

- What happens when the French content has no name yet (an incomplete draft)? The action is
  unavailable or clearly disabled — there is nothing meaningful to translate (mirrors FR-002 from
  001-recipe-authoring, which already requires a name to save at all).
- What happens when the translation request fails (network issue, AI service error, or a malformed
  response)? The owner sees a clear error message; the existing French content and any existing
  English content are completely unaffected — a failed attempt must never leave the recipe in a
  partially-translated or corrupted state.
- What happens if the owner navigates away or starts editing while a translation draft is being
  generated? Out of scope to guard against for this feature — the action is a single blocking
  request the owner is expected to wait out, consistent with how saving already works.
- What happens with a very long recipe (many steps, long descriptions)? No special handling is
  specified; the action may simply take longer. If it becomes a real problem in practice, that is a
  future refinement, not a requirement here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single action, available while viewing a recipe's French
  content, that generates an English draft translation of that recipe's name, description, every
  ingredient group's name, every ingredient's name, and every step's text.
- **FR-002**: The system MUST preserve a step's rich-text formatting (at minimum: bold, italic,
  bullet lists, and inline images) exactly in the translated draft — translation MUST change only
  the words, never the structure or formatting.
- **FR-003**: The system MUST NOT persist a generated draft automatically — a draft only populates
  what the owner is currently editing, and is saved (or discarded) exactly the way any other edit
  to the recipe already is.
- **FR-004**: If the recipe's English content already has any text in any field, the system MUST
  ask the owner to confirm before replacing it with a new draft.
- **FR-005**: On confirmation (or when there was nothing to confirm), the system MUST replace every
  field the draft covers — it MUST NOT merge a draft with existing English content field-by-field.
- **FR-006**: The system MUST require the recipe to have a name before the translation action is
  available, consistent with the existing requirement that every recipe have a name.
- **FR-007**: If generating a draft fails for any reason, the system MUST leave both the existing
  French content and any existing English content completely unchanged, and MUST clearly inform the
  owner that the attempt failed.
- **FR-008**: The translation action MUST be a deliberate, explicit action the owner takes on one
  recipe at a time — the system MUST NOT translate recipes automatically or in bulk.
- **FR-009**: The system MUST require the owner to be signed in to use the translation action,
  consistent with every other backoffice capability.

### Key Entities

- **Translation draft**: Not a stored entity — a point-in-time, non-persisted result (recipe name,
  description, group names, ingredient names, and step text, all in the target language) that
  exists only in the editor until the owner saves or discards it. Carries no id of its own and has
  no relationship to the recipe's stored data until an explicit save turns it into ordinary English
  locale content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can go from a French-only recipe to a complete, saveable English draft in
  one action, without manually retyping any of the recipe's text.
- **SC-002**: 100% of translated steps that contained bold, italic, bullet-list, or inline-image
  formatting retain that same formatting in the translated output.
- **SC-003**: 100% of translation attempts on a recipe with existing English content require
  explicit confirmation before any English text is replaced.
- **SC-004**: 100% of failed translation attempts leave the recipe's existing content (French and
  English) byte-for-byte unchanged.
- **SC-005**: 0% of translation drafts are saved to persistent storage without the owner separately
  choosing to save.

## Assumptions

- The direction is fixed at French (source, already authored) → English (drafted) for this feature.
  Supporting other language pairs, or letting the owner pick source/target locales in the UI, is
  explicitly out of scope — a future feature can extend this if needed.
- The owner is the only person who authors or reviews translations (single-editor project, per the
  constitution) — no reviewer/approval workflow beyond the owner's own save action is needed.
- Translation quality is "a good starting draft the owner polishes," not "publication-ready without
  review" — the constitution already requires a human review step before any AI-assisted text is
  published, which this feature's design (draft-only, never auto-saved) satisfies by construction.
- Bulk translation (translating many recipes at once) and any terminology/glossary consistency
  tooling across recipes are both out of scope — this feature is a single-recipe, single-click,
  one-direction action only.
- This feature depends on 001-recipe-authoring's existing multi-locale editor and data model, and
  002-deploy-infrastructure's deployed, authenticated backend — both already exist and are not
  modified by this feature beyond adding the new translation capability itself.
- The publish pipeline and the public-facing site are separate, later features, explicitly out of
  scope here, as already identified as the next feature after this one.
