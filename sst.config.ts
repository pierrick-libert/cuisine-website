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
    const { addAuthClient } = await import('./infra/auth');
    const { api } = await import('./infra/api');
    const { web } = await import('./infra/web');
    const authClient = addAuthClient(web.url);

    return {
      apiUrl: api.url,
      webUrl: web.url,
      authClientId: authClient.id,
    };
  },
});
