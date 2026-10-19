import { beforeAll, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: class {
    send = sendMock;
  },
  DescribeExecutionCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { handler } = await import('../../src/handlers/get-publish-status.js');
const { setPipelineStatus } = await import('../../src/repository/publish-repository.js');
const { ensureTable, parseBody } = await import('./helpers.js');

describe('GET /publish-status (004, FR-008)', () => {
  beforeAll(ensureTable);

  it('reports a completed run without calling DescribeExecution', async () => {
    sendMock.mockReset();
    await setPipelineStatus({
      running: false,
      executionArn: 'arn:aws:states:eu-central-1:1:execution:P:done',
      action: 'publish',
      startedAt: '2026-10-19T10:00:00Z',
      lastResult: 'succeeded',
    });

    const result = await handler();

    expect(result.statusCode).toBe(200);
    const body = parseBody<{ running: boolean; action: string; lastResult: string }>(result);
    expect(body).toEqual({ running: false, action: 'publish', startedAt: '2026-10-19T10:00:00Z', lastResult: 'succeeded' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('calls DescribeExecution to confirm status while a run is in progress', async () => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ status: 'RUNNING' });
    await setPipelineStatus({
      running: true,
      executionArn: 'arn:aws:states:eu-central-1:1:execution:P:live',
      action: 'unpublish',
      startedAt: '2026-10-19T10:05:00Z',
      lastResult: null,
    });

    const result = await handler();

    const body = parseBody<{ running: boolean }>(result);
    expect(body.running).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('self-heals when DescribeExecution reports the run already finished', async () => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ status: 'SUCCEEDED' });
    await setPipelineStatus({
      running: true,
      executionArn: 'arn:aws:states:eu-central-1:1:execution:P:stale',
      action: 'publish',
      startedAt: '2026-10-19T10:10:00Z',
      lastResult: null,
    });

    const result = await handler();

    const body = parseBody<{ running: boolean; lastResult: string }>(result);
    expect(body.running).toBe(false);
    expect(body.lastResult).toBe('succeeded');
  });
});
