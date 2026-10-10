# Quickstart: Validating Recipe Authoring

Prerequisites: Node.js 24.x LTS, Docker (for local DynamoDB).

## Setup

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
cd backend && npm install && npm run create-table:local   # creates the single table against :8000
cd ../frontend && npm install
```

Local DynamoDB doesn't check credentials but the AWS SDK still requires something present; `npm
run dev`/`create-table:local` already load `.env.example`'s dummy values automatically (copy it to
`.env.local` to override any of them per-developer — `.env.local` is gitignored).

```bash
cd backend && npm run dev     # local Lambda-equivalent server, e.g. on :3001
cd frontend && npm run dev    # SPA dev server, e.g. on :5173, proxying /recipes to :3001
```

## Validation scenarios (map to spec.md Acceptance Scenarios)

1. **Create a recipe (User Story 1)**
   - Open the SPA, start a new recipe, enter a name, one ingredient group with one line
     (quantity/unit/name), and step text. Save.
   - Expected: no validation error; reopening the recipe from the list shows the same content.
   - Also try saving with only the name filled in → expected: succeeds, no other field required.

2. **Edit a recipe (User Story 2)**
   - Reopen the recipe above, change the ingredient's quantity, reorder two lines, save.
   - Expected: reopening shows the updated quantity and new order.
   - Delete an ingredient group entirely, save, reopen → expected: group is gone, nothing else
     changed.

3. **Multi-language content (User Story 3)**
   - On the same recipe, switch the locale tab to a second language, enter a translated name/
     description/ingredient names/steps, save.
   - Expected: switching back to the first locale still shows its own content unchanged; the
     ingredient quantities/units (not locale-specific) are identical in both tabs.

4. **Edge cases**
   - Try to save a brand-new recipe with no name at all → expected: rejected (`400` from
     `POST /recipes`), consistent with FR-002.
   - Create an ingredient group, add zero lines to it, save → expected: succeeds, group shown
     empty in the UI.
   - Note: there is no "remove a locale's content" action in this feature (a `PUT` only ever adds
     or edits one locale; it never deletes another) — see tasks.md's T028 scoping note.

## Automated coverage

- `backend/tests/unit`: category normalization, ingredient/step validation rules.
- `backend/tests/integration`: each endpoint in `contracts/recipes-api.md` against local DynamoDB,
  covering the acceptance scenarios above.
- `frontend/tests/unit`: ingredient group/line reorder and delete logic, locale tab switching
  (content isolation between locales).

## Executed (2026-10-09)

Ran the full create → get → update (quantity change + add a second locale) → delete flow over
real HTTP against the local dev server (`npm run dev`) and local DynamoDB, not just via direct
handler calls (which is what the automated integration tests do) — this is what actually caught a
real bug: DynamoDB's internal `PK`/`SK` attributes were leaking into every API response. Fixed in
`backend/src/repository/recipe-repository.ts` (a `stripKeys` helper) and covered by a new
regression test (`backend/tests/integration/get-recipe.test.ts`). Also fixed the `dev`/
`create-table:local` npm scripts, where `tsx watch --flag file.ts` needs `watch` before the flags
(`tsx watch --flag file.ts`, not `tsx --flag watch file.ts`) or `tsx` mis-parses `watch` as the
entry file. All other scenarios above passed as expected on the first try. Automated suite: 23
backend tests, 15 frontend tests, all passing.

