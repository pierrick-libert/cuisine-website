/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The deployed backoffice API's base URL — see `infra/web.ts`. Empty in local development. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
