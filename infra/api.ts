import { table, imagesBucket } from './storage';

// Shared by every Lambda below — resource-linking (`link`) grants least-privilege IAM to the
// table; `TABLE_NAME` is set explicitly so the existing handlers' `process.env.TABLE_NAME` read
// (backend/src/repository/table-client.ts) keeps working unchanged.
const runtime = 'nodejs24.x' as const;
const environment = { TABLE_NAME: table.name };

const createRecipe = new sst.aws.Function('CreateRecipeFunction', {
  name: 'CLP-CreateRecipe',
  handler: 'backend/src/handlers/create-recipe.handler',
  runtime,
  environment,
  link: [table],
});

const listRecipes = new sst.aws.Function('ListRecipesFunction', {
  name: 'CLP-ListRecipes',
  handler: 'backend/src/handlers/list-recipes.handler',
  runtime,
  environment,
  link: [table],
});

const getRecipe = new sst.aws.Function('GetRecipeFunction', {
  name: 'CLP-GetRecipe',
  handler: 'backend/src/handlers/get-recipe.handler',
  runtime,
  environment,
  link: [table],
});

const updateRecipe = new sst.aws.Function('UpdateRecipeFunction', {
  name: 'CLP-UpdateRecipe',
  handler: 'backend/src/handlers/update-recipe.handler',
  runtime,
  environment,
  link: [table],
});

const deleteRecipe = new sst.aws.Function('DeleteRecipeFunction', {
  name: 'CLP-DeleteRecipe',
  handler: 'backend/src/handlers/delete-recipe.handler',
  runtime,
  environment,
  link: [table],
});

const createImageUploadUrl = new sst.aws.Function('CreateImageUploadUrlFunction', {
  name: 'CLP-CreateImageUploadUrl',
  handler: 'backend/src/handlers/create-image-upload-url.handler',
  runtime,
  environment: { IMAGES_BUCKET_NAME: imagesBucket.name },
  link: [imagesBucket],
});

// No explicit physical name here — API Gateway HTTP APIs use AWS-assigned opaque ids, not
// controllable names, so the deploy role's permissions policy leaves this service unscoped
// (Resource: "*", documented in infra/iam/README.md) rather than trying to prefix-match it.
//
// Routes aren't added here: every route requires the Cognito JWT authorizer (FR-003), which in
// turn needs the app client's id, which needs the backoffice's deployed URL for its callback
// (infra/web.ts) — which itself needs `api.url` to build. `addRecipeRoutes` breaks that cycle by
// deferring route creation until the authorizer exists; see sst.config.ts's `run()`.
export const api = new sst.aws.ApiGatewayV2('Api');

/**
 * Adds the `/recipes*` and `/images` routes (FR-001, FR-008, FR-010 — no other API surface),
 * each protected by `authorizerId` (FR-003 — every route requires authentication, including
 * `/images`).
 *
 * @param authorizerId - The Cognito JWT authorizer's id, from `api.addAuthorizer(...)`.
 */
export function addRecipeRoutes(authorizerId: $util.Output<string>) {
  const auth = { jwt: { authorizer: authorizerId } };
  api.route('POST /recipes', createRecipe.arn, { auth });
  api.route('GET /recipes', listRecipes.arn, { auth });
  api.route('GET /recipes/{id}', getRecipe.arn, { auth });
  api.route('PUT /recipes/{id}', updateRecipe.arn, { auth });
  api.route('DELETE /recipes/{id}', deleteRecipe.arn, { auth });
  api.route('POST /images', createImageUploadUrl.arn, { auth });
}
