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
    await import('./infra/auth');
    // infra/api.ts (T007, T012, T024) and infra/web.ts (T008) are added as those phases start —
    // see specs/002-deploy-infrastructure/tasks.md. The Cognito app client (infra/auth.ts's
    // `addAuthClient`) is invoked once infra/web.ts's URL exists, from here.
  },
});
