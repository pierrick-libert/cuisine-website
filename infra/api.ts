import { table } from './storage';

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

// No explicit physical name here — API Gateway HTTP APIs use AWS-assigned opaque ids, not
// controllable names, so the deploy role's permissions policy leaves this service unscoped
// (Resource: "*", documented in infra/iam/README.md) rather than trying to prefix-match it.
export const api = new sst.aws.ApiGatewayV2('Api');

api.route('POST /recipes', createRecipe.arn);
api.route('GET /recipes', listRecipes.arn);
api.route('GET /recipes/{id}', getRecipe.arn);
api.route('PUT /recipes/{id}', updateRecipe.arn);
api.route('DELETE /recipes/{id}', deleteRecipe.arn);
