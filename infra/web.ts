import { api } from './api';

// `StaticSite` doesn't expose a prop to name its own auto-created bucket — only to host on one
// that already exists (`assets.bucket`). Since the deploy role's S3 permissions are scoped to
// `clp-*` bucket names, the bucket is created explicitly here (same pattern as the images bucket
// in infra/storage.ts) and handed to `StaticSite`, rather than relying on its default naming.
export const webBucket = new sst.aws.Bucket('WebBucket', {
  transform: { bucket: { bucket: 'clp-web' } },
});

export const web = new sst.aws.StaticSite('Web', {
  path: 'frontend',
  build: {
    command: 'npm run build',
    output: 'dist',
  },
  environment: {
    VITE_API_URL: api.url,
  },
  assets: { bucket: webBucket },
});
