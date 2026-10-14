# Quickstart: Validating Translation Drafting

Prerequisites: 002-deploy-infrastructure is deployed (a real `POST /translate` route requires the
deployed API Gateway + Cognito setup); an Anthropic API key set as this app's `AnthropicApiKey`
secret (`sst secret set AnthropicApiKey <key> --stage production`, per research.md).

## Setup

```bash
npx sst deploy --stage production
```

This adds the `CLP-Translate` function and the `/translate` route to the already-deployed API
Gateway — no new top-level infrastructure (no new bucket, table, or auth setup).

## Validation scenarios (map to spec.md Acceptance Scenarios)

1. **Draft an English translation from a French recipe (User Story 1)**
   - In the backoffice, open or create a recipe with French content: a name, a description, one
     ingredient group with one ingredient, and one step.
   - Click "Generate translation draft".
   - Expected: the English locale tab becomes active and shows translated text in every one of
     those fields, without a page reload.
   - Edit some of the drafted English text, then click "Save changes".
   - Expected: reopening the recipe shows the edited English content persisted, exactly like any
     other locale edit.

2. **Formatting in step text survives translation (User Story 2)**
   - Author a step with a bolded phrase, an italicized phrase, a bullet list, and an inserted
     image (by URL, per 001's existing step editor).
   - Generate a translation draft.
   - Expected: the English step has an equivalent phrase still bolded, still italicized, the same
     number of bullet items in the same order (translated), and the same image, unchanged.

3. **Confirm before overwriting existing English content (User Story 3)**
   - On a recipe that already has English content, click "Generate translation draft".
   - Expected: a confirmation prompt appears before anything changes.
   - Decline it.
   - Expected: the existing English content is completely unchanged.
   - Click the action again and accept.
   - Expected: every English field (name, description, group names, ingredient names, every step)
     is replaced by the new draft.

4. **A failed translation leaves everything untouched**
   - Temporarily set an invalid value for the `AnthropicApiKey` secret (or simulate by any other
     means that forces the Anthropic call to fail) and click "Generate translation draft".
   - Expected: a clear error message appears; the French content and any existing English content
     are both completely unchanged.
   - Restore the valid secret value afterward.

## Automated coverage

- `backend/tests/unit/rich-text-translation.test.ts`: the extract/reinsert tree-walking logic
  (formatting preservation), tested in isolation with no network calls.
- `backend/tests/integration/translate-recipe.test.ts`: the handler's validation (`400` on empty
  `name`) and its translated-count-mismatch failure path, with the Anthropic client mocked — no
  real Anthropic API calls in this suite.
- No automated test exercises a real Anthropic API call (would require a real API key and incur
  real cost on every CI run) — validated manually per scenario 1-2 above.
