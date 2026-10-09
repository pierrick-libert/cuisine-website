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

## TypeScript version

- **Decision**: TypeScript **6.0.3**, not the newer 7.0.2.
- **Rationale**: 7.0.2 is a from-scratch Go-based rewrite of the compiler (released 2026-07-08);
  `typescript-eslint` (needed for linting) has not added support for it yet — its peer dependency
  range is `>=4.8.4 <6.1.0` even on the canary channel as of 2026-10-09, confirmed by checking npm
  directly rather than assuming compatibility. 6.0.3 is the final release on the previous
  JS-based compiler, explicitly positioned as "a bridge to TypeScript 7."
- **Alternatives considered**: TypeScript 7.0.2 with linting disabled or deferred — rejected, the
  constitution's development workflow doesn't call for cutting quality tooling to chase the newest
  compiler; revisit this pin once `typescript-eslint` ships TS7 support.

## Dependency versions (verified against npm/PyPI/nodejs.org on 2026-10-09)

Per project policy (always check actual current versions rather than relying on training-data
defaults), these are the verified-current versions as of research time; re-verify before actually
running the install commands in T002/T003, since time will have passed.

| Package | Verified latest (2026-10-09) |
|---|---|
| `typescript` | 6.0.3 (pinned below 7.x — see TypeScript version decision above) |
| `node` (Lambda target) | 24.21.0 — latest **LTS** ("Krypton"); 26.x exists but is still the non-LTS Current line |
| `react` | 19.3.0 |
| `react-router` | 8.4.0 |
| `@tiptap/core` (and matching `@tiptap/*` extensions) | 3.31.4 |
| `vitest` | 5.0.3 |
| `@aws-sdk/client-dynamodb` / `@aws-sdk/lib-dynamodb` | 3.1148.0 |
| `uv` (Spec Kit tooling, not an app dependency) | 0.12.24 |
| Spec Kit (`specify-cli`) | v1.1.2 (already installed) |

**Output**: all Technical Context items resolved; no `NEEDS CLARIFICATION` markers remain.
