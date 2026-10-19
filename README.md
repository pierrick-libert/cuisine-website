<!-- markdownlint-disable MD033 -->
# Pierrick's Sunday Kitchen

Personal, multi-language recipe website — a structured alternative to a blog/WordPress recipe tool, built for a single editor (the owner) to author recipes with real structured ingredients, and for family and friends to browse them.

🚧 **Status**: in active development. The backoffice (recipe authoring, with AI-assisted translation drafting) is deployed and live at **admin.cuisine.libertpierrick.com** on real AWS infrastructure (see [`specs/002-deploy-infrastructure/`](specs/002-deploy-infrastructure/)), with every merge to `main` deploying automatically via CI/CD. The publish pipeline and public recipe site (**cuisine.libertpierrick.com**) are built (see [`specs/004-publish-pipeline-and/`](specs/004-publish-pipeline-and/)) — the owner marks recipes with a per-recipe toggle, then clicks "Publish" or "Unpublish" to render/remove them as static pages via a Step Functions pipeline.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Development](#-development)
- [Project Structure](#-project-structure)
- [How This Project Is Built: Spec-Driven Development](#-how-this-project-is-built-spec-driven-development)
- [Deployment](#-deployment)
- [Scripts Reference](#-scripts-reference)
- [License](#-license)
- [Author](#-author)

---

## 🛠 Tech Stack

### Backend (`backend/`)

- **[Node.js](https://nodejs.org/)** `24.x LTS ("Krypton")` — Lambda runtime
- **[TypeScript](https://www.typescriptlang.org/)** `6.0.3` — pinned below the newer 7.x Go-based compiler, since `typescript-eslint` doesn't support it yet
- **[AWS SDK v3](https://github.com/aws/aws-sdk-js-v3)** (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-sfn`, `@aws-sdk/client-cloudfront`) — DynamoDB, S3, Step Functions, and CloudFront access
- **[Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)** (`@anthropic-ai/sdk`) — on-demand, explicitly-triggered AI translation drafts (see [`specs/003-translation-drafting/`](specs/003-translation-drafting/)), never auto-saved or auto-published
- **[Vitest](https://vitest.dev/)** — unit + integration tests (integration tests run against [DynamoDB Local](https://hub.docker.com/r/amazon/dynamodb-local) in Docker)
- **[ulid](https://github.com/ulid/spec)** — sortable unique ids

### Frontend (`frontend/`)

- **[React](https://react.dev/)** `19` — backoffice SPA
- **[Vite](https://vite.dev/)** — dev server and build
- **[React Router](https://reactrouter.com/)** — routing
- **[Tiptap](https://tiptap.dev/)** — rich-text editor for recipe steps
- **[Vitest](https://vitest.dev/)** + **[React Testing Library](https://testing-library.com/react)** — unit and component tests

### Public site (`public-site/`, see [specs/004-publish-pipeline-and](specs/004-publish-pipeline-and/))

- **[Eleventy](https://www.11ty.dev/)** — renders recipe detail pages and category shell pages, invoked programmatically (one recipe/category per call, not a whole-site build) by the publish pipeline's Lambdas
- **[Alpine.js](https://alpinejs.dev/)** (via CDN) — client-side browse/search/filter over a pre-generated JSON index, no server round trip
- A small, hand-written Tiptap-JSON-to-HTML renderer, deliberately bounded to the exact node/mark types the backoffice editor exposes (bold, italic, bullet list, image)

### Infrastructure (`infra/`, see [specs/002-deploy-infrastructure](specs/002-deploy-infrastructure/) and [specs/004-publish-pipeline-and](specs/004-publish-pipeline-and/))

- **[SST v4](https://sst.dev/)** — infrastructure as code (Pulumi-based)
- **AWS Lambda, API Gateway (HTTP API), DynamoDB, S3, CloudFront, Cognito, Step Functions** — eu-central-1
- **GitHub Actions** with OIDC federation — no long-lived AWS credentials (see [`infra/iam/`](infra/iam/) for the already-provisioned deploy role)

### Shared tooling

- **[ESLint](https://eslint.org/)** + **[TSDoc](https://tsdoc.org/)** (`eslint-plugin-tsdoc`) — linting and documentation-comment syntax, in both packages
- **[Prettier](https://prettier.io/)** — formatting
- **[Spec Kit](https://github.com/github/spec-kit)** — spec-driven development workflow (see below)

---

## 📦 Prerequisites

- **Node.js** `24.x LTS` — [Download here](https://nodejs.org/) (a version manager like [nvm](https://github.com/nvm-sh/nvm) is recommended, since this isn't necessarily your system's default Node version)
- **Docker** — for running DynamoDB Local during backend development/tests
- **npm** (comes with Node.js)

```bash
node --version   # should be v24.x
docker --version
```

---

## 🚀 Installation

```bash
git clone git@github.com:pierrick-libert/cuisine-website.git
cd cuisine-website

cd backend && npm install
cd ../frontend && npm install
cd ../public-site && npm install
```

---

## 💻 Development

### Backend

```bash
cd backend
docker run -d -p 8000:8000 amazon/dynamodb-local   # or: npm run db:local:up
npm run create-table:local                          # one-time, creates the local table
npm run dev                                          # local HTTP server on :3001
```

See [`backend/README.md`](backend/README.md) for the full local-dev loop (env vars, test commands).

### Frontend

```bash
cd frontend
npm run dev   # SPA on :5173, proxying /recipes to :3001
```

See [`frontend/README.md`](frontend/README.md) for details.

### Running tests

```bash
cd backend && npm run typecheck && npm run lint && npm test
cd frontend && npx tsc --noEmit && npm run lint && npm test
cd public-site && npm run typecheck && npm run lint && npm test
```

---

## 📁 Project Structure

```text
cuisine-website/
├── backend/                 # Node/TypeScript Lambda handlers + DynamoDB repository
│   ├── src/
│   │   ├── handlers/        # One Lambda entrypoint per API operation
│   │   ├── domain/          # Types, validation, errors — no AWS/DB awareness
│   │   ├── repository/      # DynamoDB access (single table, no secondary indexes)
│   │   └── lib/             # id generation, HTTP helpers, local dev server
│   └── tests/
├── frontend/                 # React 19 / Vite backoffice SPA
│   └── src/
│       ├── pages/            # RecipeListPage, RecipeEditorPage
│       ├── components/       # IngredientGroupEditor, StepsEditor (Tiptap), PublishToggle, ...
│       ├── services/         # API client
│       └── lib/               # Editor-state helpers (locale/structure split, reorder)
├── public-site/                # Eleventy templates for the public recipe site
│   ├── templates/               # recipe-detail.njk, category-shell.njk
│   ├── assets/                  # browse.js (Alpine.js client-side search/filter)
│   └── src/                     # render.ts (programmatic Eleventy), render-rich-text.ts
├── infra/                     # Infrastructure as code (SST) and one-time AWS setup docs
│   ├── pipeline.ts            # The Step Functions publish/unpublish state machine
│   ├── public-site.ts         # The public site's CloudFront distribution + domain
│   └── iam/                   # GitHub Actions OIDC trust + deploy-role IAM policy (already applied)
├── specs/                     # Spec-Driven Development artifacts — one directory per feature
│   ├── 001-recipe-authoring/
│   ├── 002-deploy-infrastructure/
│   ├── 003-translation-drafting/
│   └── 004-publish-pipeline-and/
├── mockups/                   # Approved UI design mockups (Claude Design canvas source)
├── docs/
│   └── spec-driven-development.md   # How to use the SDD workflow, manually or otherwise
└── .specify/                  # Spec Kit's own scaffolding (constitution, templates, scripts)
```

---

## 📐 How This Project Is Built: Spec-Driven Development

This project is built feature-by-feature through [Spec Kit](https://github.com/github/spec-kit): every feature gets a written spec, a plan, and a task list *before* any code is written, checked against the project's [constitution](.specify/memory/constitution.md) (cost-first, static-first, single exposed backend surface, and more).

Read **[`docs/spec-driven-development.md`](docs/spec-driven-development.md)** for the full pipeline, what each `/speckit-*` step reads and writes, and how to run any step manually without an AI agent driving it.

Completed/in-progress features live under [`specs/`](specs/), each with its own `spec.md`, `plan.md`, and `tasks.md`.

---

## 🚀 Deployment

Deployed and live on real AWS infrastructure (see [`specs/002-deploy-infrastructure/`](specs/002-deploy-infrastructure/)). It works like this:

- **Infrastructure**: provisioned via [SST v4](https://sst.dev/) (`npx sst deploy --stage production`), not manually — Lambda + API Gateway HTTP API (Cognito JWT-authorized) + DynamoDB + S3 + CloudFront + Cognito User Pool + Step Functions, all defined in `sst.config.ts` and `infra/*.ts`.
- **Domains**: `admin.cuisine.libertpierrick.com` (backoffice) and `cuisine.libertpierrick.com` (public site), both via Route 53 (`libertpierrick.com` is delegated there) and `sst.aws.dns()` — DNS records and ACM certificates are created automatically on every deploy.
- **Authentication**: the backoffice (UI and API, every route) requires signing in through Cognito's Hosted UI. Self-sign-up is disabled everywhere — the only account is created manually, by the owner, through the AWS Console.
- **Publishing**: the public site is never a live reflection of backoffice drafts — the owner toggles recipes and clicks "Publish"/"Unpublish" in the backoffice, which starts a Step Functions pipeline (`infra/pipeline.ts`) that renders/removes each recipe's static page via Eleventy, rebuilds the browse/search index and category shells, and invalidates CloudFront. See [`specs/004-publish-pipeline-and/`](specs/004-publish-pipeline-and/).
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) — every pull request runs backend + frontend tests; every merge to `main` deploys automatically, authenticated to AWS via OIDC federation (no long-lived credentials stored anywhere in this repository).
- **One-time AWS setup** (already done): the OIDC identity provider, the `CLP-GitHubActionsRole` deploy role, and its scoped permissions policy — see [`infra/iam/README.md`](infra/iam/README.md) for exactly what was provisioned and why.
- **Secrets**: set out-of-band by the owner (`sst secret set <Name> <value> --stage production`), never passed through CI or committed to the repository.

---

## 📝 Scripts Reference

### `backend/`

| Command | Description |
|---|---|
| `npm run dev` | Local HTTP server mapping to the Lambda handlers, on `:3001` |
| `npm run build` | Compile TypeScript (`src/` only) |
| `npm run typecheck` | Typecheck `src/` + `tests/` |
| `npm run lint` | ESLint (including `tsdoc/syntax`) |
| `npm test` | Unit tests, then integration tests (needs DynamoDB Local running) |
| `npm run db:local:up` / `db:local:down` | Start/stop DynamoDB Local in Docker |
| `npm run create-table:local` | Create the single table against DynamoDB Local |

### `frontend/`

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server on `:5173` |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint (including `tsdoc/syntax`) |
| `npm test` | Unit tests |

### `public-site/`

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript (`src/` only) |
| `npm run typecheck` | Typecheck (`--noEmit`) |
| `npm run lint` | ESLint (including `tsdoc/syntax`) |
| `npm test` | Unit tests — including real `@11ty/eleventy` invocations (not mocked) against the templates in `templates/` |

---

## 📄 License

This project is private and proprietary.

---

## 👤 Author

- **Pierrick Libert**
