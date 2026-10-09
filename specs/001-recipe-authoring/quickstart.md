# Quickstart: Validating Recipe Authoring

Prerequisites: Node.js 26.x, Docker (for local DynamoDB).

## Setup

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
cd backend && npm install && npm run create-table:local   # creates the single table against :8000
cd ../frontend && npm install
```

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
   - On a recipe with only one locale, attempt to remove that locale's content entirely via the
     API → expected: rejected per the contract's last-locale constraint.

## Automated coverage

- `backend/tests/unit`: category normalization, ingredient/step validation rules.
- `backend/tests/integration`: each endpoint in `contracts/recipes-api.md` against local DynamoDB,
  covering the acceptance scenarios above.
- `frontend/tests/unit`: ingredient group/line reorder and delete logic, locale tab switching
  (content isolation between locales).
