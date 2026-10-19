import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { listRecipes } from '../repository/recipe-repository.js';
import { getPipelineStatus, setPipelineStatus } from '../repository/publish-repository.js';
import { buildPublishPlan, type PublishPlan } from './publish-selection.js';

const sfn = new SFNClient({});
const STATE_MACHINE_ARN = process.env.PIPELINE_STATE_MACHINE_ARN ?? '';

export type StartRunResult =
  | { outcome: 'already-running' }
  | { outcome: 'nothing-to-do' }
  | { outcome: 'started'; executionArn: string | null };

/**
 * Shared logic behind `POST /publish` and `POST /unpublish` (contracts/publish-api.md): rejects
 * if a run is already in progress (FR-009), otherwise selects the toggled-on recipes
 * (publish-selection.ts) and starts the pipeline's Step Functions execution for `action`.
 */
export async function startRun(action: PublishPlan['action']): Promise<StartRunResult> {
  const status = await getPipelineStatus();
  if (status.running) return { outcome: 'already-running' };

  const recipes = await listRecipes();
  const plan = buildPublishPlan(recipes, action);
  if (plan.recipeIds.length === 0) return { outcome: 'nothing-to-do' };

  const result = await sfn.send(
    new StartExecutionCommand({ stateMachineArn: STATE_MACHINE_ARN, input: JSON.stringify(plan) }),
  );
  const executionArn = result.executionArn ?? null;

  await setPipelineStatus({
    running: true,
    executionArn,
    action,
    startedAt: new Date().toISOString(),
    lastResult: null,
  });

  return { outcome: 'started', executionArn };
}
