// Cognito, self-sign-up disabled (FR-004 — no registration UI or API anywhere; the only way to
// create an account is manually, via the AWS Console). Hosted UI handles the sign-in flow itself
// (contracts/auth.md) — no custom sign-in form.

export const userPool = new sst.aws.CognitoUserPool('UserPool', {
  domain: { prefix: 'clp-sunday-kitchen' },
  transform: {
    userPool: (args) => {
      args.adminCreateUserConfig = { allowAdminCreateUserOnly: true };
      args.name = 'CLP-UserPool';
    },
  },
});

/**
 * Creates the Hosted UI app client once the backoffice's deployed URL is known (the frontend's
 * `StaticSite`, created in `infra/web.ts`, doesn't exist yet when `infra/storage.ts`/`infra/auth.ts`
 * run — see `sst.config.ts`'s `run()` for the call site).
 *
 * @param webUrl - The backoffice's deployed public URL (no trailing slash).
 */
export function addAuthClient(webUrl: $util.Output<string>) {
  return userPool.addClient('UserPoolClient', {
    callbackUrls: [$interpolate`${webUrl}/signin-callback`],
    transform: {
      client: (args) => {
        args.generateSecret = false;
        args.allowedOauthFlows = ['code'];
        args.allowedOauthFlowsUserPoolClient = true;
        args.allowedOauthScopes = ['openid', 'email', 'profile'];
        args.supportedIdentityProviders = ['COGNITO'];
        args.logoutUrls = [webUrl];
      },
    },
  });
}
