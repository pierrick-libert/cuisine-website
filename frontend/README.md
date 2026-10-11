# Pierrick's Sunday Kitchen — Backoffice

React 19 / Vite SPA for creating and editing recipes. See
[`../specs/001-recipe-authoring/`](../specs/001-recipe-authoring/) for the spec and plan this
implements.

## Setup

```bash
npm install
```

The dev server proxies `/recipes` to the backend at `http://localhost:3001` (see
[`vite.config.ts`](vite.config.ts)) — start the backend first (see
[`../backend/README.md`](../backend/README.md)).

## Run

```bash
npm run dev     # SPA on :5173
```

## Test

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build   # production build via vite
```

## Layout

- `src/pages/` — `RecipeListPage`, `RecipeEditorPage`
- `src/components/` — `IngredientGroupEditor`/`IngredientLineRow`, `StepsEditor` (Tiptap),
  `CategoryTagPicker`, `LocaleTabs`
- `src/services/recipesApi.ts` — API client, including the split between the backend's raw
  (structure + per-locale text) shape and the editor's flat display shape
- `src/lib/localeEditing.ts` — merge/split helpers between shared structure and per-locale text
- `src/lib/reorder.ts` — the array-reorder helper used by group/line/step move-up/move-down
