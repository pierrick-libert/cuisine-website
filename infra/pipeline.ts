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
// No explicit "mark run failed" task is needed on the Catch path: `GET /publish-status`
// (get-publish-status.ts) already self-heals by cross-checking Step Functions' own
// `DescribeExecution` against the stored `PIPELINE#STATUS` item on every poll (research.md
// "Trigger and status-polling pattern") — Step Functions' own execution status is the source of
// truth for failure, not a dedicated write from inside the state machine.

const runtime = 'nodejs24.x' as const;
const environment = { TABLE_NAME: table.name, PUBLIC_BUCKET_NAME: publicSiteBucket.name };

const renderRecipeFn = new sst.aws.Function('RenderRecipeFunction', {
  name: 'CLP-RenderRecipe',
  // `.handler`, not `.renderRecipe` directly — the Map state's event is `{ recipeId }`, which
  // the handler wrapper destructures before calling the pure, string-argument renderRecipe().
  handler: 'backend/src/pipeline/render-recipe.handler',
  runtime,
  environment,
  link: [table, publicSiteBucket],
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
  // Renders every live category's shell page (also via Eleventy) across every published
  // locale — same reasoning as RenderRecipeFunction above.
  timeout: '60 seconds',
  memory: '512 MB',
});

const invalidateCdnFn = new sst.aws.Function('InvalidateCdnFunction', {
  name: 'CLP-InvalidateCdn',
  handler: 'backend/src/pipeline/invalidate-cdn.invalidateCdn',
  runtime,
  environment: { PUBLIC_DISTRIBUTION_ID: publicSite.distributionID },
  // `link` doesn't cover CloudFront invalidation permissions (not an SST-linkable resource
  // property here) — granted explicitly, scoped to this one distribution.
  permissions: [{ actions: ['cloudfront:CreateInvalidation'], resources: [publicSite._distributionArn] }],
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
        Resource: [renderRecipeFn.arn, removeRecipeFn.arn, rebuildIndexFn.arn, invalidateCdnFn.arn],
      },
    ],
  }),
});

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
      PublishEach: {
        Type: 'Map',
        ItemsPath: '$.recipeIds',
        ItemSelector: { 'recipeId.$': '$$.Map.Item.Value' },
        MaxConcurrency: 5,
        Iterator: {
          StartAt: 'RenderRecipe',
          States: {
            RenderRecipe: {
              Type: 'Task',
              Resource: 'arn:aws:states:::lambda:invoke',
              Parameters: { FunctionName: renderRecipeFn.arn, 'Payload.$': '$' },
              End: true,
            },
          },
        },
        Next: 'RebuildIndex',
      },
      UnpublishEach: {
        Type: 'Map',
        ItemsPath: '$.recipeIds',
        ItemSelector: { 'recipeId.$': '$$.Map.Item.Value' },
        MaxConcurrency: 5,
        Iterator: {
          StartAt: 'RemoveRecipe',
          States: {
            RemoveRecipe: {
              Type: 'Task',
              Resource: 'arn:aws:states:::lambda:invoke',
              Parameters: { FunctionName: removeRecipeFn.arn, 'Payload.$': '$' },
              End: true,
            },
          },
        },
        Next: 'RebuildIndex',
      },
      // Shared by both branches — the full browse/search index and category-shell
      // reconciliation, driven entirely by the published-snapshot table (FR-013).
      RebuildIndex: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        Parameters: { FunctionName: rebuildIndexFn.arn },
        Next: 'InvalidateCdn',
      },
      InvalidateCdn: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        Parameters: { FunctionName: invalidateCdnFn.arn },
        End: true,
      },
    },
  }),
});
