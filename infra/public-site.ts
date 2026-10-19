import { publicSiteBucket } from './storage';

// 004-publish-pipeline-and: the public recipe site. Unlike infra/web.ts's StaticSite, this isn't
// built at `sst deploy` time — the pipeline Lambdas (pipeline/render-recipe.ts,
// pipeline/rebuild-index.ts) write recipe pages, category shells, and browse-index.json directly
// into `publicSiteBucket` at publish time (research.md "Custom domains via SST" /
// "Rendering recipes with Eleventy inside a Lambda task"). This Router component only provisions
// the CloudFront distribution and custom domain in front of that bucket.
export const publicSite = new sst.aws.Router('PublicSite', {
  domain: {
    name: 'cuisine.libertpierrick.com',
    dns: sst.aws.dns(),
  },
  // Without this, a visitor hitting the bare domain (the natural thing to type) gets S3's raw
  // 403 AccessDenied — found live: `/en/index.html` served fine, `/` didn't. No per-visitor
  // locale negotiation (would need a CloudFront Function) — defaulting to `en` is the simplest
  // fix at this project's scale (constitution Principle IV), not a complete locale-router.
  transform: { cdn: { defaultRootObject: 'en/index.html' } },
});

publicSite.routeBucket('/', publicSiteBucket);
