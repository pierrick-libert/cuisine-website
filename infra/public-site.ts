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
});

publicSite.routeBucket('/', publicSiteBucket);
