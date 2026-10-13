import { describe, expect, it } from 'vitest';

// Presigning is a local signature computation (no network call to S3), but still needs *some*
// credentials to resolve — set fixed, non-real ones so this test is independent of whatever AWS
// credentials (or lack of them, per CI's test job — FR-006) happen to be configured.
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';

const { handler } = await import('../../src/handlers/create-image-upload-url.js');

function event(body: unknown): Parameters<typeof handler>[0] {
  return { body: JSON.stringify(body) } as unknown as Parameters<typeof handler>[0];
}

describe('POST /images (US4)', () => {
  it('rejects a missing contentType (contracts/images-api.md)', async () => {
    const result = await handler(event({}));
    expect(result.statusCode).toBe(400);
  });

  it('rejects an unsupported contentType', async () => {
    const result = await handler(event({ contentType: 'application/pdf' }));
    expect(result.statusCode).toBe(400);
  });

  it('returns a presigned upload URL and a stable image URL for a supported contentType', async () => {
    const result = await handler(event({ contentType: 'image/jpeg' }));
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body ?? '{}') as { uploadUrl: string; imageUrl: string };
    expect(body.uploadUrl).toMatch(/^https:\/\//);
    expect(body.imageUrl).toMatch(/^https:\/\/.+\.s3\..+\.amazonaws\.com\/.+$/);
  });
});
