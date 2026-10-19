import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cloudfront = new CloudFrontClient({});

/**
 * Invalidates the public CloudFront distribution in full, as the pipeline's final shared task
 * (plan.md's `infra/pipeline.ts`) — run after every `rebuild-index.ts` call, regardless of
 * whether the run was a Publish or Unpublish, so visitors never see a stale cached page.
 *
 * @remarks
 * A single `/*` path is used rather than enumerating changed paths — at this project's scale
 * (constitution Principle IV), the simplicity of a full invalidation outweighs the marginal cost
 * of invalidating a few unchanged paths alongside the changed ones.
 */
export async function invalidateCdn(): Promise<void> {
  const distributionId = process.env.PUBLIC_DISTRIBUTION_ID ?? '';

  await cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: new Date().toISOString(),
        Paths: { Quantity: 1, Items: ['/*'] },
      },
    }),
  );
}
