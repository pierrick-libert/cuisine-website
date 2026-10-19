import { beforeAll, describe, expect, it } from 'vitest';
import { handler } from '../../src/handlers/finish-publish-run.js';
import { getPipelineStatus, setPipelineStatus } from '../../src/repository/publish-repository.js';
import { ensureTable } from './helpers.js';

describe('finish-publish-run (004, Important 6/7 - run-level status from the state machine itself)', () => {
  beforeAll(ensureTable);

  it('marks the run succeeded and clears the running lock', async () => {
    await setPipelineStatus({
      running: true,
      executionArn: 'arn:aws:states:eu-central-1:1:execution:P:x',
      action: 'publish',
      startedAt: '2026-10-19T10:00:00Z',
      lastResult: null,
    });

    await handler({ result: 'succeeded' });

    const status = await getPipelineStatus();
    expect(status.running).toBe(false);
    expect(status.lastResult).toBe('succeeded');
    // action/startedAt are preserved for display, only running/lastResult change.
    expect(status.action).toBe('publish');
  });

  it('marks the run failed and clears the running lock', async () => {
    await setPipelineStatus({
      running: true,
      executionArn: 'arn:aws:states:eu-central-1:1:execution:P:y',
      action: 'unpublish',
      startedAt: '2026-10-19T10:05:00Z',
      lastResult: null,
    });

    await handler({ result: 'failed' });

    const status = await getPipelineStatus();
    expect(status.running).toBe(false);
    expect(status.lastResult).toBe('failed');
  });
});
