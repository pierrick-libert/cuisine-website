import { getPipelineStatus, setPipelineStatus } from '../repository/publish-repository.js';

interface FinishRunEvent {
  result: 'succeeded' | 'failed';
}

/**
 * The pipeline's final task AND its Catch target (infra/pipeline.ts) — writes
 * `PIPELINE#STATUS.running = false` and `lastResult`, per data-model.md's state transitions.
 *
 * @remarks
 * `GET /publish-status` (get-publish-status.ts) also self-heals by cross-checking
 * `DescribeExecution` on every poll, as a backstop for the case this task somehow never runs —
 * but the state machine writing its own result directly (rather than relying only on reactive
 * polling) means the lock clears even if nobody happens to poll (Important 6/7 from code review).
 */
export async function handler(event: FinishRunEvent): Promise<void> {
  const current = await getPipelineStatus();
  await setPipelineStatus({ ...current, running: false, lastResult: event.result });
}
