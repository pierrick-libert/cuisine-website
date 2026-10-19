import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { listRecipes } from '../repository/recipe-repository.js';
import { getPipelineStatus, setPipelineStatus, tryAcquirePipelineLock } from '../repository/publish-repository.js';
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
 *
 * @remarks
 * The lock is acquired *atomically* (`tryAcquirePipelineLock`) before anything else — a plain
 * "read the lock, then write it" has a race window where two near-simultaneous calls can both
 * read `running: false` and both proceed (Important 8 from code review). The lock is released
 * again (`running: false`) if it turns out there's nothing to do, or if `StartExecution` itself
 * fails, so a no-op or a failed start never leaves the lock stuck.
 */
export async function startRun(action: PublishPlan['action']): Promise<StartRunResult> {
  const acquired = await tryAcquirePipelineLock(action);
  if (!acquired) return { outcome: 'already-running' };

  const recipes = await listRecipes();
  const plan = buildPublishPlan(recipes, action);
  if (plan.recipeIds.length === 0) {
    await releaseLockWithoutStarting();
    return { outcome: 'nothing-to-do' };
  }

  let executionArn: string | null;
  try {
    const result = await sfn.send(
      new StartExecutionCommand({ stateMachineArn: STATE_MACHINE_ARN, input: JSON.stringify(plan) }),
    );
    executionArn = result.executionArn ?? null;
  } catch (err) {
    await releaseLockWithoutStarting();
    throw err;
  }

  // tryAcquirePipelineLock already set running/action/startedAt — just fill in the real ARN now
  // that StartExecution has actually returned one.
  const current = await getPipelineStatus();
  await setPipelineStatus({ ...current, executionArn });

  return { outcome: 'started', executionArn };
}

async function releaseLockWithoutStarting(): Promise<void> {
  const current = await getPipelineStatus();
  await setPipelineStatus({ ...current, running: false });
}
