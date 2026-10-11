/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'CLP',
      home: 'aws',
      removal: input.stage === 'production' ? 'retain' : 'remove',
      protect: input.stage === 'production',
      providers: { aws: { region: 'eu-central-1' } },
    };
  },
  async run() {
    await import('./infra/storage');
    const { userPool, addAuthClient } = await import('./infra/auth');
    const { api, addRecipeRoutes } = await import('./infra/api');
    const { web, webBucket } = await import('./infra/web');

    // web.url needs api.url (built in); the auth client's callback needs web.url; the authorizer
    // needs the auth client's id — this order resolves that chain without a cycle (see
    // infra/api.ts's comment on why routes aren't added until here).
    const authClient = addAuthClient(web.url);
    const authorizer = api.addAuthorizer({
      name: 'CognitoAuthorizer',
      jwt: {
        issuer: $interpolate`https://cognito-idp.${aws.getRegionOutput().region}.amazonaws.com/${userPool.id}`,
        audiences: [authClient.id],
      },
    });
    addRecipeRoutes(authorizer.id);

    // The Hosted UI domain + app client id can only be known once `authClient` exists, which
    // itself needs `web.url` — so they can't be baked into the Vite build the way `VITE_API_URL`
    // is (that would be a genuine cycle: web's build needs the client id, the client needs web's
    // own url). Instead they're dropped into the same bucket as a small JSON file, fetched by
    // frontend/src/services/auth.ts at runtime.
    new aws.s3.BucketObject('AuthConfig', {
      bucket: webBucket.name,
      key: 'auth-config.json',
      contentType: 'application/json',
      cacheControl: 'no-cache',
      content: $jsonStringify({
        cognitoDomain: userPool.domainUrl,
        clientId: authClient.id,
      }),
    });

    return {
      apiUrl: api.url,
      webUrl: web.url,
      authClientId: authClient.id,
    };
  },
});
