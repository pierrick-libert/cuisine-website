import { table, publicSiteBucket } from './storage';
import { publicSite } from './public-site';

// 004-publish-pipeline-and: the Publish/Unpublish state machine (constitution's "AWS Step
// Functions orchestrates the multi-step publish pipeline... using per-locale/per-category
// parallel Map states and built-in Catch-based error handling"). No dedicated SST component
// exists for Step Functions, so the state machine itself is a raw `aws.sfn.StateMachine` with an
// inline Amazon States Language definition; each task state invokes one of these Lambdas.
//
// The state machine's input is `{ action: 'publish' | 'unpublish', recipeIds: string[] }` —
// already selected by start-publish.ts/start-unpublish.ts before `StartExecution` is called
// (data-model.md's validation rule: the recipe set a run acts on is fixed at start time).
//
// The state machine writes its own result to PIPELINE#STATUS via FinishRun (both the normal-
// completion path and every Catch target reach it) rather than relying only on `GET
// /publish-status`'s reactive `DescribeExecution` self-heal (research.md) — that self-heal
// remains a backstop for the rare case FinishRun itself never runs, not the primary mechanism.
//
// Each Map tolerates up to 100% per-item failure (ToleratedFailurePercentage) so one recipe's
// render/remove failure never prevents RebuildIndex/InvalidateCdn from running for every recipe
// that *did* succeed (FR-010, SC-008) — render-recipe.ts/remove-recipe.ts already isolate a
// failed recipe's own state (publishStatus reverted, toggle reset) independently of this.

const runtime = 'nodejs24.x' as const;
const environment = { TABLE_NAME: table.name, PUBLIC_BUCKET_NAME: publicSiteBucket.name };

// Shared by every function below that renders via public-site/src/render.ts: esbuild bundles a
// function's own source into one file, so neither the .njk templates (static assets, not JS
// esbuild would even parse) nor @11ty/eleventy itself (dynamic requires/config loading, a poor
// bundling candidate) survive a normal bundle. `copyFiles` places the templates at the function
// package root (public-site/src/render.ts's TEMPLATES_DIR resolves them there via
// LAMBDA_TASK_ROOT at runtime); `nodejs.install` has SST install Eleventy into the package's
// node_modules instead of trying to bundle it.
const eleventyRenderingConfig = {
  copyFiles: [{ from: 'public-site/templates', to: 'templates' }],
  nodejs: { install: { '@11ty/eleventy': '3.1.7' } },
};

const renderRecipeFn = new sst.aws.Function('RenderRecipeFunction', {
  name: 'CLP-RenderRecipe',
  // `.handler`, not `.renderRecipe` directly — the Map state's event is `{ recipeId }`, which
  // the handler wrapper destructures before calling the pure, string-argument renderRecipe().
  handler: 'backend/src/pipeline/render-recipe.handler',
  runtime,
  environment,
  link: [table, publicSiteBucket],
  ...eleventyRenderingConfig,
  // Eleventy rendering (public-site/src/render.ts) is heavier than this project's other
  // handlers; a generous timeout and memory bound keep a single Map-state iteration reliable
  // without over-provisioning the whole pipeline.
  timeout: '30 seconds',
  memory: '512 MB',
});

const removeRecipeFn = new sst.aws.Function('RemoveRecipeFunction', {
  name: 'CLP-RemoveRecipe',
  // `.handler`, not `.removeRecipe` directly — same ASL event-shape reasoning as RenderRecipeFunction above.
  handler: 'backend/src/pipeline/remove-recipe.handler',
  runtime,
  environment,
  link: [table, publicSiteBucket],
});

const rebuildIndexFn = new sst.aws.Function('RebuildIndexFunction', {
  name: 'CLP-RebuildIndex',
  handler: 'backend/src/pipeline/rebuild-index.rebuildIndex',
  runtime,
  environment,
  link: [table, publicSiteBucket],
  ...eleventyRenderingConfig,
  // Renders every live category's shell page (also via Eleventy) across every published
  // locale — same reasoning as RenderRecipeFunction above.
  timeout: '60 seconds',
  memory: '512 MB',
});

// Built from the public, documented `distributionID` rather than the underscore-prefixed
// `_distributionArn` internal property, which isn't part of Router's stable API.
const callerIdentity = aws.getCallerIdentityOutput({});
const publicDistributionArn = $interpolate`arn:aws:cloudfront::${callerIdentity.accountId}:distribution/${publicSite.distributionID}`;

const invalidateCdnFn = new sst.aws.Function('InvalidateCdnFunction', {
  name: 'CLP-InvalidateCdn',
  handler: 'backend/src/pipeline/invalidate-cdn.invalidateCdn',
  runtime,
  environment: { PUBLIC_DISTRIBUTION_ID: publicSite.distributionID },
  // `link` doesn't cover CloudFront invalidation permissions (not an SST-linkable resource
  // property here) — granted explicitly, scoped to this one distribution.
  permissions: [{ actions: ['cloudfront:CreateInvalidation'], resources: [publicDistributionArn] }],
});

const finishRunFn = new sst.aws.Function('FinishPublishRunFunction', {
  name: 'CLP-FinishPublishRun',
  handler: 'backend/src/handlers/finish-publish-run.handler',
  runtime,
  environment,
  link: [table],
});

const pipelineRole = new aws.iam.Role('CLP-PublishPipelineRole', {
  name: 'CLP-PublishPipelineRole',
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { Service: 'states.amazonaws.com' }, Action: 'sts:AssumeRole' }],
  }),
});

new aws.iam.RolePolicy('CLP-PublishPipelinePolicy', {
  name: 'CLP-PublishPipelinePolicy',
  role: pipelineRole.id,
  policy: $jsonStringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'lambda:InvokeFunction',
        Resource: [renderRecipeFn.arn, removeRecipeFn.arn, rebuildIndexFn.arn, invalidateCdnFn.arn, finishRunFn.arn],
      },
    ],
  }),
});

// Standard retry for transient Lambda failures (throttling, service exceptions) — applied to
// every task that invokes a Lambda, per code review Important 6.
const lambdaRetry = [
  {
    ErrorEquals: ['Lambda.ServiceException', 'Lambda.AWSLambdaException', 'Lambda.SdkClientException', 'Lambda.TooManyRequestsException'],
    IntervalSeconds: 2,
    MaxAttempts: 3,
    BackoffRate: 2,
  },
];

/** Every non-Map state's Catch target — mark the run failed, then stop. */
const catchToMarkFailed = [{ ErrorEquals: ['States.ALL'], Next: 'MarkFailed' }];

export const publishPipeline = new aws.sfn.StateMachine('CLP-PublishPipeline', {
  name: 'CLP-PublishPipeline',
  roleArn: pipelineRole.arn,
  definition: $jsonStringify({
    Comment: 'Publish/Unpublish pipeline (004-publish-pipeline-and)',
    StartAt: 'ChooseAction',
    States: {
      ChooseAction: {
        Type: 'Choice',
        Choices: [{ Variable: '$.action', StringEquals: 'unpublish', Next: 'UnpublishEach' }],
        Default: 'PublishEach',
      },
      // One Map-state iteration per toggled recipe (research.md "Pipeline orchestration shape")
      // — per-item retry/visibility, instead of a hand-rolled loop over recipeIds.
      // ToleratedFailurePercentage: 100 — a single recipe's failure must never prevent
      // RebuildIndex/InvalidateCdn from running for the recipes that did succeed (FR-010).
      PublishEach: {
        Type: 'Map',
        ItemsPath: '$.recipeIds',
        ItemSelector: { 'recipeId.$': '$$.Map.Item.Value' },
        MaxConcurrency: 5,
        ToleratedFailurePercentage: 100,
        Iterator: {
          StartAt: 'RenderRecipe',
          States: {
            RenderRecipe: {
              Type: 'Task',
              Resource: 'arn:aws:states:::lambda:invoke',
              Parameters: { FunctionName: renderRecipeFn.arn, 'Payload.$': '$' },
              Retry: lambdaRetry,
              End: true,
            },
          },
        },
        Catch: catchToMarkFailed,
        Next: 'RebuildIndex',
      },
      UnpublishEach: {
        Type: 'Map',
        ItemsPath: '$.recipeIds',
        ItemSelector: { 'recipeId.$': '$$.Map.Item.Value' },
        MaxConcurrency: 5,
        ToleratedFailurePercentage: 100,
        Iterator: {
          StartAt: 'RemoveRecipe',
          States: {
            RemoveRecipe: {
              Type: 'Task',
              Resource: 'arn:aws:states:::lambda:invoke',
              Parameters: { FunctionName: removeRecipeFn.arn, 'Payload.$': '$' },
              Retry: lambdaRetry,
              End: true,
            },
          },
        },
        Catch: catchToMarkFailed,
        Next: 'RebuildIndex',
      },
      // Shared by both branches — the full browse/search index and category-shell
      // reconciliation, driven entirely by the published-snapshot table (FR-013). Always runs,
      // even when some Map items failed (ToleratedFailurePercentage above).
      RebuildIndex: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        Parameters: { FunctionName: rebuildIndexFn.arn },
        Retry: lambdaRetry,
        Catch: catchToMarkFailed,
        Next: 'InvalidateCdn',
      },
      InvalidateCdn: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        Parameters: { FunctionName: invalidateCdnFn.arn },
        Retry: lambdaRetry,
        Catch: catchToMarkFailed,
        Next: 'MarkSucceeded',
      },
      MarkSucceeded: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        Parameters: { FunctionName: finishRunFn.arn, Payload: { result: 'succeeded' } },
        End: true,
      },
      // Reached either directly (Catch above) or after a failed MarkSucceeded attempt itself.
      MarkFailed: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        Parameters: { FunctionName: finishRunFn.arn, Payload: { result: 'failed' } },
        Next: 'RunFailed',
      },
      RunFailed: { Type: 'Fail' },
    },
  }),
});
