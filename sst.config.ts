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
    // Resources are added phase by phase as specs/002-deploy-infrastructure/tasks.md progresses:
    // infra/storage.ts (T004, T022), infra/auth.ts (T005), infra/api.ts (T007, T012, T024),
    // infra/web.ts (T008).
  },
});
