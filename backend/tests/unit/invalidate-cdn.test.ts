import { describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-cloudfront', () => ({
  CloudFrontClient: class {
    send = sendMock;
  },
  CreateInvalidationCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { invalidateCdn } = await import('../../src/pipeline/invalidate-cdn.js');

describe('invalidateCdn (004)', () => {
  it('invalidates the entire public distribution', async () => {
    process.env.PUBLIC_DISTRIBUTION_ID = 'DIST123';

    await invalidateCdn();

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { input } = sendMock.mock.calls[0]![0] as {
      input: { DistributionId: string; InvalidationBatch: { Paths: { Items: string[] } } };
    };
    expect(input.DistributionId).toBe('DIST123');
    expect(input.InvalidationBatch.Paths.Items).toEqual(['/*']);
  });
});
