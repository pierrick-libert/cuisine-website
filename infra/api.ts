import { table, imagesBucket } from './storage';
import { publishPipeline } from './pipeline';

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

// Stateless — translates text via the Claude API, touches no table or bucket (data-model.md:
// "no new persisted entity"). The model name is a plain env var (not the secret) so swapping it
// later is a one-line change here, not a secret rotation.
//
// The API key is passed via `link`, NOT `environment` — `link`ed secrets are encrypted into a
// bundled file and decrypted in-memory by the `sst` runtime package (Resource.AnthropicApiKey.value
// in the handler); a plain `environment` entry would instead show up as a literal, human-readable
// value in the Lambda console's Environment variables tab, which defeats the point of a secret.
const anthropicApiKey = new sst.Secret('AnthropicApiKey');
const translateRecipe = new sst.aws.Function('TranslateRecipeFunction', {
  name: 'CLP-TranslateRecipe',
  handler: 'backend/src/handlers/translate-recipe.handler',
  runtime,
  // ANTHROPIC_WORKSPACE_ID: this API key is a user-scoped key (sk-ant-usr-...), not a
  // workspace-scoped one, so the Anthropic API requires an explicit workspace id on every
  // request (confirmed live — the first real deploy's test call failed with exactly this until
  // this was added). Not sensitive (an identifier, not a credential), so a plain env var is fine.
  environment: { ANTHROPIC_MODEL: 'claude-sonnet-5-5', ANTHROPIC_WORKSPACE_ID: 'wrkspc_01KQt4RPnQYXvaMUcSsNnUgG' },
  link: [anthropicApiKey],
});

// 004-publish-pipeline-and: the toggle is a plain table write (no state-machine access needed).
const toggleRecipePublish = new sst.aws.Function('ToggleRecipePublishFunction', {
  name: 'CLP-ToggleRecipePublish',
  handler: 'backend/src/handlers/toggle-recipe-publish.handler',
  runtime,
  environment,
  link: [table],
});

// `link` only grants IAM for SST-managed resources; `publishPipeline` is a raw Pulumi
// `aws.sfn.StateMachine` (no dedicated SST component exists for Step Functions — see
// infra/pipeline.ts), so `states:StartExecution`/`DescribeExecution` are granted explicitly via
// `permissions` instead.
const pipelineEnvironment = { ...environment, PIPELINE_STATE_MACHINE_ARN: publishPipeline.arn };

// `states:DescribeExecution`'s IAM resource type is an *execution* ARN
// (`...:execution:<state-machine-name>:<execution-name>`), not the state machine ARN itself
// (that's StartExecution's resource type) — granting the state machine ARN here would make every
// DescribeExecution call AccessDenied as soon as a run starts, permanently stuck at
// `running: true` since nothing else ever clears PIPELINE#STATUS (research.md's self-heal
// depends entirely on this call succeeding).
const publishPipelineExecutionArnPattern = $interpolate`arn:aws:states:${aws.getRegionOutput().region}:${aws.getCallerIdentityOutput({}).accountId}:execution:CLP-PublishPipeline:*`;

const startPublish = new sst.aws.Function('StartPublishFunction', {
  name: 'CLP-StartPublish',
  handler: 'backend/src/handlers/start-publish.handler',
  runtime,
  environment: pipelineEnvironment,
  link: [table],
  permissions: [{ actions: ['states:StartExecution'], resources: [publishPipeline.arn] }],
});

const startUnpublish = new sst.aws.Function('StartUnpublishFunction', {
  name: 'CLP-StartUnpublish',
  handler: 'backend/src/handlers/start-unpublish.handler',
  runtime,
  environment: pipelineEnvironment,
  link: [table],
  permissions: [{ actions: ['states:StartExecution'], resources: [publishPipeline.arn] }],
});

const getPublishStatus = new sst.aws.Function('GetPublishStatusFunction', {
  name: 'CLP-GetPublishStatus',
  handler: 'backend/src/handlers/get-publish-status.handler',
  runtime,
  environment,
  link: [table],
  permissions: [{ actions: ['states:DescribeExecution'], resources: [publishPipelineExecutionArnPattern] }],
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
 * Adds the `/recipes*`, `/images`, `/translate`, and the 004-publish-pipeline-and publish routes
 * (no other API surface — see each feature's FR-0XX requirements), each protected by
 * `authorizerId` (every route requires authentication, with no exceptions — Principle III).
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
  api.route('POST /translate', translateRecipe.arn, { auth });
  api.route('PATCH /recipes/{id}/publish-toggle', toggleRecipePublish.arn, { auth });
  api.route('POST /publish', startPublish.arn, { auth });
  api.route('POST /unpublish', startUnpublish.arn, { auth });
  api.route('GET /publish-status', getPublishStatus.arn, { auth });
}
