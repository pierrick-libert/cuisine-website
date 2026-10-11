<!-- markdownlint-disable MD033 -->
# Sunday Kitchen

Personal, multi-language recipe website — a structured alternative to a blog/WordPress recipe
tool, built for a single editor (the owner) to author recipes with real structured ingredients,
and for family and friends to browse them.

🚧 **Status**: in active development, not yet deployed. The backoffice (recipe authoring) runs
locally; infrastructure/deployment is designed and planned (see
[`specs/002-deploy-infrastructure/`](specs/002-deploy-infrastructure/)) but not yet implemented.
There is no live site yet.

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
- **[TypeScript](https://www.typescriptlang.org/)** `6.0.3` — pinned below the newer 7.x
  Go-based compiler, since `typescript-eslint` doesn't support it yet
- **[AWS SDK v3](https://github.com/aws/aws-sdk-js-v3)** (`@aws-sdk/client-dynamodb`,
  `@aws-sdk/lib-dynamodb`) — DynamoDB access
- **[Vitest](https://vitest.dev/)** — unit + integration tests (integration tests run against
  [DynamoDB Local](https://hub.docker.com/r/amazon/dynamodb-local) in Docker)
- **[ulid](https://github.com/ulid/spec)** — sortable unique ids

### Frontend (`frontend/`)

- **[React](https://react.dev/)** `19` — backoffice SPA
- **[Vite](https://vite.dev/)** — dev server and build
- **[React Router](https://reactrouter.com/)** — routing
- **[Tiptap](https://tiptap.dev/)** — rich-text editor for recipe steps
- **[Vitest](https://vitest.dev/)** — unit tests

### Infrastructure (planned — `infra/`, see [specs/002-deploy-infrastructure](specs/002-deploy-infrastructure/))

- **[SST v4](https://sst.dev/)** — infrastructure as code (Pulumi-based)
- **AWS Lambda, API Gateway (HTTP API), DynamoDB, S3, CloudFront, Cognito** — eu-central-1
- **GitHub Actions** with OIDC federation — no long-lived AWS credentials (see
  [`infra/iam/`](infra/iam/) for the already-provisioned deploy role)

### Shared tooling

- **[ESLint](https://eslint.org/)** + **[TSDoc](https://tsdoc.org/)** (`eslint-plugin-tsdoc`) —
  linting and documentation-comment syntax, in both packages
- **[Prettier](https://prettier.io/)** — formatting
- **[Spec Kit](https://github.com/github/spec-kit)** — spec-driven development workflow (see
  below)

---

## 📦 Prerequisites

- **Node.js** `24.x LTS` — [Download here](https://nodejs.org/) (a version manager like
  [nvm](https://github.com/nvm-sh/nvm) is recommended, since this isn't necessarily your system's
  default Node version)
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

See [`backend/README.md`](backend/README.md) for the full local-dev loop (env vars, test
commands).

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
│       ├── components/       # IngredientGroupEditor, StepsEditor (Tiptap), LocaleTabs, ...
│       ├── services/         # API client
│       └── lib/               # Editor-state helpers (locale/structure split, reorder)
├── infra/                     # Infrastructure as code (SST) and one-time AWS setup docs
│   └── iam/                   # GitHub Actions OIDC trust + deploy-role IAM policy (already applied)
├── specs/                     # Spec-Driven Development artifacts — one directory per feature
│   ├── 001-recipe-authoring/
│   └── 002-deploy-infrastructure/
├── mockups/                   # Approved UI design mockups (Claude Design canvas source)
├── docs/
│   └── spec-driven-development.md   # How to use the SDD workflow, manually or otherwise
└── .specify/                  # Spec Kit's own scaffolding (constitution, templates, scripts)
```

---

## 📐 How This Project Is Built: Spec-Driven Development

This project is built feature-by-feature through [Spec Kit](https://github.com/github/spec-kit):
every feature gets a written spec, a plan, and a task list *before* any code is written, checked
against the project's [constitution](.specify/memory/constitution.md) (cost-first, static-first,
single exposed backend surface, and more).

Read **[`docs/spec-driven-development.md`](docs/spec-driven-development.md)** for the full
pipeline, what each `/speckit-*` step reads and writes, and how to run any step manually without
an AI agent driving it.

Completed/in-progress features live under [`specs/`](specs/), each with its own `spec.md`,
`plan.md`, and `tasks.md`.

---

## 🚀 Deployment

**Not yet implemented** — this is exactly what [`specs/002-deploy-infrastructure/`](specs/002-deploy-infrastructure/)
specifies and plans. Once built, deployment will work like this:

- **Infrastructure**: provisioned via [SST v4](https://sst.dev/) (`sst deploy --stage production`),
  not manually — see [`specs/002-deploy-infrastructure/plan.md`](specs/002-deploy-infrastructure/plan.md).
- **CI/CD**: GitHub Actions — every pull request runs tests; every merge to `main` deploys
  automatically, authenticated to AWS via OIDC federation (no long-lived credentials stored
  anywhere in this repository).
- **One-time AWS setup** (already done): the OIDC identity provider, the `CLP-GitHubActionsRole`
  deploy role, and its scoped permissions policy — see [`infra/iam/README.md`](infra/iam/README.md)
  for exactly what was provisioned and why.
- **Secrets**: set out-of-band by the owner (`sst secret set <Name> <value> --stage production`),
  never passed through CI or committed to the repository.

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

---

## 📄 License

This project is private and proprietary.

---

## 👤 Author

- **Pierrick Libert**
