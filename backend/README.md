# Pierrick's Sunday Kitchen — Backend

Node 24 LTS / TypeScript Lambda handlers + DynamoDB for the backoffice recipe API. See
[`../specs/001-recipe-authoring/`](../specs/001-recipe-authoring/) for the spec, plan, and data
model this implements, and [`../specs/001-recipe-authoring/contracts/recipes-api.md`](../specs/001-recipe-authoring/contracts/recipes-api.md)
for the API contract.

## Setup

```bash
npm install
docker run -d -p 8000:8000 amazon/dynamodb-local
npm run create-table:local   # creates the single table against :8000
```

Local DynamoDB doesn't check credentials, but the AWS SDK still needs something present —
`.env.example`'s dummy values are loaded automatically by `npm run dev` / `create-table:local`.
Copy it to `.env.local` (gitignored) to override anything per-developer.

## Run

```bash
npm run dev    # local HTTP server on :3001, mapping to the Lambda handlers directly
```

## Test

```bash
npm run typecheck   # tsc over src/ + tests/
npm run lint
npm test            # unit, then integration (needs DynamoDB Local running, see Setup)
```

## Layout

- `src/handlers/` — one Lambda entrypoint per API operation
- `src/domain/` — types, validation (ingredient lines, category normalization), errors
- `src/repository/` — DynamoDB access (single table, no secondary indexes)
- `src/pipeline/` — the publish/unpublish Step Functions task Lambdas (render-recipe,
  remove-recipe, rebuild-index, invalidate-cdn) — see
  [`../specs/004-publish-pipeline-and/`](../specs/004-publish-pipeline-and/). `render-recipe.ts`
  and `rebuild-index.ts` import directly from `../public-site/src/` (Eleventy rendering) — a
  deliberate cross-package layout, not a published dependency; see that feature's `plan.md`.
- `src/lib/` — id generation, HTTP response helper, local table-creation script
- `src/local-server.ts` — maps plain HTTP requests to the handlers for local development

## Publish pipeline (004-publish-pipeline-and)

The owner marks recipes with a per-recipe toggle (`PATCH /recipes/{id}/publish-toggle`), then
`POST /publish` or `POST /unpublish` starts a Step Functions execution (`infra/pipeline.ts`)
against exactly the currently-toggled recipes — never a live reflection of the backoffice's
current draft state. `GET /publish-status` is polled by the backoffice while a run is in
progress, since a run can exceed API Gateway's 29-second synchronous limit. See
[`contracts/publish-api.md`](../specs/004-publish-pipeline-and/contracts/publish-api.md) and
[`contracts/public-site-index.md`](../specs/004-publish-pipeline-and/contracts/public-site-index.md).
