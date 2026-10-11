# One-time AWS OIDC setup (not run by CI — you run this once, manually)

These two files are reference artifacts from the infra-deployment design discussion, not yet
backed by an approved spec. Replace `<ACCOUNT_ID>` everywhere before running anything.

- `github-oidc-trust-policy.json` — who can assume the deploy role: only a GitHub Actions run
  triggered by a push that lands on `main` in `pierrick-libert/cuisine-website`. No PR branches,
  no forks, no other repos.
- `deploy-role-permissions-policy.json` — what the deploy role can do once assumed. No root,
  billing, IAM user, or other-account access. Scoped per statement:
  - **`AppLambdaFunctions`**, **`AppDynamoDbTable`**, **`AppS3Buckets`**, **`Logging`** — scoped by
    resource name prefix to this app's own resources (`CLP-*` for Lambda/DynamoDB/IAM/log groups,
    lowercase `clp-*` for S3, since bucket names can't contain uppercase). This only actually
    constrains anything once `sst.config.ts` explicitly sets each resource's physical name to
    start with that prefix — SST's default auto-generated naming isn't guaranteed to match.
  - **`ApiGatewayAndContentDeliveryAndAuth`** — left as `Resource: "*"` for API Gateway,
    CloudFront, and Cognito. Their ARNs embed an AWS-assigned opaque id (api id, distribution id,
    user pool id) chosen at creation time, not the name you give the resource, so there's no
    name-based string to prefix-match before the first deploy. A tag-based condition could tighten
    this further later if wanted; not implemented here.
  - **`SstBootstrapResources`**, **`SstBootstrapEcr`**, **`EcrAuthToken`** — SST creates its own
    fixed-name bootstrap resources on first deploy regardless of this app's naming: a state bucket
    (`sst-state-<hash>`), an assets bucket for Lambda packages (`sst-asset-<hash>`), and (even for
    this project's plain zip-packaged functions, not containers) an ECR repo called `sst-asset`.
    These aren't under `CLP-`/`clp-` naming control at all — without allowing them, `sst deploy`
    can't bootstrap. **This is also where `sst.Secret` values actually live** — SST encrypts and
    stores secrets in its own state bucket, not in AWS Secrets Manager, so no Secrets Manager
    permissions are needed anywhere in this policy.
  - **`SstStateSsmParameters`** — the real paths SST uses: `/sst/passphrase/<app>/<stage>` for the
    state-encryption passphrase, and a fixed (not app-scoped) `/sst/bootstrap` for the asset
    bucket/ECR repo lookup.
  - **`LambdaExecutionRoles`** + **`DenySelfModification`** — the role can create/manage IAM roles
    prefixed `CLP-*` (for SST's automatic per-function execution roles), but an explicit `Deny`
    blocks it from modifying or deleting its own role, since `CLP-*` would otherwise also match
    `CLP-GitHubActionsRole` itself.

  **Dependency this creates**: when `sst.config.ts` is written, it must explicitly set physical
  names for the Dynamo table, S3 bucket(s), and each Lambda function to start with `CLP-`
  (lowercase `clp-` for the bucket) — not yet done, since no SST config exists yet.

## Setup commands (AWS CLI, run once with your own credentials)

```bash
ACCOUNT_ID=<your-account-id>
REGION=eu-central-1

# 1. Register GitHub's OIDC provider with IAM (skip if your account already has one —
#    there can only be one provider per issuer URL per account).
#    AWS now auto-retrieves the certificate thumbprint; no need to supply one.
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com

# 2. Substitute your account id into both policy files
sed -i "s/<ACCOUNT_ID>/${ACCOUNT_ID}/g" infra/iam/github-oidc-trust-policy.json
sed -i "s/<ACCOUNT_ID>/${ACCOUNT_ID}/g" infra/iam/deploy-role-permissions-policy.json

# 3. Create the deploy role with the trust policy
aws iam create-role \
  --role-name CLP-GitHubActionsRole \
  --assume-role-policy-document file://infra/iam/github-oidc-trust-policy.json

# 4. Attach the scoped permissions policy (as an inline policy — simplest for a single role
#    used by exactly one workflow; promote to a managed policy later if it's ever reused)
aws iam put-role-policy \
  --role-name CLP-GitHubActionsRole \
  --policy-name CLP-GitHubActionsPermissions \
  --policy-document file://infra/iam/deploy-role-permissions-policy.json

# 5. Note the role ARN, then store it as a GitHub Actions secret (NOT in any tracked file —
#    this repo is public, and the ARN embeds your AWS account id)
aws iam get-role --role-name CLP-GitHubActionsRole --query 'Role.Arn' --output text
gh secret set AWS_DEPLOY_ROLE_ARN --body "<paste the arn from the previous command>"
```

## Status

- [x] GitHub's OIDC provider — already existed in this account (shared across projects; each
      project's role has its own trust-policy restriction, so this is safe to reuse).
- [x] `CLP-GitHubActionsRole` created with the trust policy above.
- [x] `CLP-GitHubActionsPermissions` attached with the permissions policy above.
- [x] Role ARN stored as the `AWS_DEPLOY_ROLE_ARN` GitHub Actions secret — the deploy workflow
      will reference it as `${{ secrets.AWS_DEPLOY_ROLE_ARN }}`, never hardcoded.
- [ ] `sst.config.ts` — not written yet. Must set physical names for the Dynamo table, S3
      bucket(s), and each Lambda function to start with `CLP-`/`clp-`, per the dependency noted
      above, or this policy denies everything.
- [ ] The actual GitHub Actions deploy workflow (`.github/workflows/ci.yml`) — not written yet.

## If you add other branches/environments later

The trust policy's `token.actions.githubusercontent.com:sub` condition is the one line to extend —
e.g. add a second allowed value for a `staging` branch, or switch to a `repo:...:pull_request`
pattern if per-PR preview environments are ever added (not in the current design — see the
deploy-pipeline design discussion).
