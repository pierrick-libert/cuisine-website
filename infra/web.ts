import { api } from './api';

export const web = new sst.aws.StaticSite('Web', {
  path: 'frontend',
  build: {
    command: 'npm run build',
    output: 'dist',
  },
  environment: {
    VITE_API_URL: api.url,
  },
  // `auth-config.json` (sst.config.ts's `AuthConfig` object) isn't part of the Vite build output,
  // so StaticSite's SPA-routing CloudFront function doesn't know about it and would otherwise
  // fall back to serving index.html for it (confirmed on the first real deploy) — `routes` tells
  // that function to serve this path straight from the bucket instead.
  assets: {
    routes: ['/auth-config.json'],
  },
  // `assets.bucket` takes an existing bucket's *name* (a string) — to point at a bucket we
  // create, we instead name StaticSite's own auto-created bucket via `transform.assets`, which
  // targets SST's own `Bucket` component (not the raw S3 resource directly), hence the nested
  // `transform.bucket.bucket` (same leaf prop used for infra/storage.ts's images bucket). Tied to
  // the repo name rather than a short generic name — see infra/storage.ts's comment on why
  // ("clp-web" was already taken globally on a first deploy attempt).
  transform: {
    assets: {
      transform: { bucket: { bucket: 'clp-cuisine-website-web' } },
    },
  },
});
