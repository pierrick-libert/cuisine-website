// Explicit `CLP-`/`clp-` physical names are required so the already-provisioned
// `CLP-GitHubActionsPermissions` policy (infra/iam/) matches these resources — see research.md's
// SST app naming convention.

export const table = new sst.aws.Dynamo('RecipesTable', {
  fields: { PK: 'string', SK: 'string' },
  primaryIndex: { hashKey: 'PK', rangeKey: 'SK' },
  transform: { table: { name: 'CLP-RecipesTable' } },
});

// S3 bucket names are globally unique across every AWS account, so a short generic name like
// "clp-images" is often already taken by someone else (confirmed — the first deploy attempt hit
// exactly this). Tied to the repo name instead, which is already public, rather than the AWS
// account id (never committed to a tracked file).
//
// Publicly readable so `imageUrl` (contracts/images-api.md) is a plain, directly-retrievable
// address — uploads themselves still require authentication, via the presigned PUT URL issued by
// the (authenticated) POST /images endpoint, not public write access.
export const imagesBucket = new sst.aws.Bucket('ImagesBucket', {
  access: 'public',
  transform: { bucket: { bucket: 'clp-cuisine-website-images' } },
});

// 004-publish-pipeline-and: the public site's rendered output (recipe detail pages, category
// shells, browse-index.json — contracts/public-site-index.md). Written directly by the pipeline
// Lambdas (pipeline/render-recipe.ts, pipeline/rebuild-index.ts); served to visitors through the
// `sst.aws.Router` CloudFront distribution in infra/public-site.ts, hence `access: 'cloudfront'`
// (not `'public'`, unlike the images bucket — this bucket is never read directly, only via the
// Router's origin access).
export const publicSiteBucket = new sst.aws.Bucket('PublicSiteBucket', {
  access: 'cloudfront',
  transform: { bucket: { bucket: 'clp-cuisine-website-public' } },
});
