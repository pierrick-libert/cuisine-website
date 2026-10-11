// Explicit `CLP-`/`clp-` physical names are required so the already-provisioned
// `CLP-GitHubActionsPermissions` policy (infra/iam/) matches these resources — see research.md's
// SST app naming convention.

export const table = new sst.aws.Dynamo('RecipesTable', {
  fields: { PK: 'string', SK: 'string' },
  primaryIndex: { hashKey: 'PK', rangeKey: 'SK' },
  transform: { table: { name: 'CLP-RecipesTable' } },
});

// Publicly readable so `imageUrl` (contracts/images-api.md) is a plain, directly-retrievable
// address — uploads themselves still require authentication, via the presigned PUT URL issued by
// the (authenticated) POST /images endpoint, not public write access.
export const imagesBucket = new sst.aws.Bucket('ImagesBucket', {
  access: 'public',
  transform: { bucket: { bucket: 'clp-images' } },
});
