// Explicit `CLP-`/`clp-` physical names are required so the already-provisioned
// `CLP-GitHubActionsPermissions` policy (infra/iam/) matches these resources — see research.md's
// SST app naming convention.

export const table = new sst.aws.Dynamo('RecipesTable', {
  fields: { PK: 'string', SK: 'string' },
  primaryIndex: { hashKey: 'PK', rangeKey: 'SK' },
  transform: { table: { name: 'CLP-RecipesTable' } },
});

// The images bucket (T022, User Story 4) is added here once that phase starts.
