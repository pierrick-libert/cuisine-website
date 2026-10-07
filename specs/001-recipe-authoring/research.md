# Phase 0 Research: Recipe Authoring

All Technical Context items were resolvable from the project constitution and prior design
session; no items required external research beyond confirming a concrete library choice. Each
entry below follows Decision / Rationale / Alternatives considered.

## API Gateway type

- **Decision**: API Gateway **HTTP API** (not REST API).
- **Rationale**: Cheaper per-request and lower-latency than REST API for this feature's simple
  CRUD surface; no need for REST API's extra features (request validation models, usage plans)
  at single-user scale.
- **Alternatives considered**: REST API — rejected, higher cost with no benefit here.

## Rich-text editor library (steps WYSIWYG)

- **Decision**: Tiptap (ProseMirror-based).
- **Rationale**: Widely used, actively maintained, supports exactly what FR-006 needs (bold/
  italic, inline images) without pulling in a full page-builder's worth of features; stores
  content as structured JSON that's straightforward to persist and re-render both in the
  backoffice and later in the public Eleventy templates.
- **Alternatives considered**: Slate — more flexible but more assembly required for a fairly
  standard formatting toolbar; a plain `contenteditable` — rejected, reinventing editor
  behavior (undo/redo, paste handling) that Tiptap already solves.

## Local DynamoDB for integration tests

- **Decision**: `amazon/dynamodb-local` Docker image, started for the integration test run.
- **Rationale**: Matches production DynamoDB's API exactly (unlike a mock), catches real
  key-schema/condition-expression mistakes, and has no ongoing cost since it only runs during
  tests.
- **Alternatives considered**: mocking the AWS SDK client — rejected, would not catch key-schema
  or expression errors, which is exactly what this layer most needs covered.

## ID generation

- **Decision**: ULIDs for recipe and category ids.
- **Rationale**: Lexicographically sortable (useful if a creation-order listing is ever wanted)
  and avoids any coordination/collision concern of a sequential counter in a serverless
  environment.
- **Alternatives considered**: UUIDv4 — works but loses sort-order-by-creation for free;
  a DynamoDB-backed counter — rejected as unnecessary coordination overhead.

## Category case-insensitive uniqueness (FR-008)

- **Decision**: store a normalized (lowercased, trimmed) form of the category name as part of its
  key/lookup path; the user-facing display name keeps its original casing.
- **Rationale**: Satisfies FR-008 ("Dessert" and "dessert" resolve to the same category) with a
  simple normalization function, no separate uniqueness-checking service needed.
- **Alternatives considered**: case-sensitive categories with manual dedup by the owner — rejected,
  spec explicitly requires this to be handled by the system, not left to user discipline.

## Testing framework

- **Decision**: Vitest.
- **Rationale**: Fast, TypeScript-native, minimal config — matches a small, single-developer
  project better than a heavier test runner.
- **Alternatives considered**: Jest — works equally well technically; Vitest chosen for faster
  startup and native ESM/TS support without extra transform configuration.

**Output**: all Technical Context items resolved; no `NEEDS CLARIFICATION` markers remain.
