// Cognito Hosted UI, Authorization Code flow — see contracts/auth.md. No sign-up anywhere: the
// only account is created manually via the AWS Console (FR-004).

const STORAGE_KEY = 'sunday-kitchen-auth';
const SCOPES = 'openid email profile';

/** The Hosted UI domain and app client id, served at runtime (see `infra/web.ts`'s `AuthConfig`
 * bucket object — these can't be baked in at build time, since the app client itself depends on
 * this app's own deployed URL). */
interface AuthConfig {
  cognitoDomain: string;
  clientId: string;
}

/** The tokens persisted across page loads. */
interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

let authConfigPromise: Promise<AuthConfig> | undefined;

/** Fetches (and caches, for the lifetime of the page) `/auth-config.json`. */
function getAuthConfig(): Promise<AuthConfig> {
  authConfigPromise ??= fetch('/auth-config.json').then((res) => res.json() as Promise<AuthConfig>);
  return authConfigPromise;
}

function readStoredTokens(): StoredTokens | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

function writeStoredTokens(tokens: StoredTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function redirectUri(): string {
  return `${window.location.origin}/signin-callback`;
}

/** Redirects the browser to the Cognito Hosted UI sign-in page. */
export async function redirectToSignIn(): Promise<never> {
  const { cognitoDomain, clientId } = await getAuthConfig();
  const url = new URL(`${cognitoDomain}/login`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('redirect_uri', redirectUri());
  window.location.assign(url.toString());
  return new Promise(() => {}); // navigation is about to happen; never resolves
}

/**
 * Exchanges the Hosted UI's authorization code for tokens (contracts/auth.md step 4), and
 * persists them.
 *
 * @param code - The `code` query parameter from the Hosted UI's redirect back to this app.
 */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const { cognitoDomain, clientId } = await getAuthConfig();
  const response = await fetch(`${cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!response.ok) throw new Error('Sign-in failed: could not exchange the authorization code.');
  const data = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
  writeStoredTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
}

/**
 * Exchanges the stored refresh token for a new access token (contracts/auth.md step 5).
 *
 * @param refreshToken - The refresh token from the most recent sign-in.
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { cognitoDomain, clientId } = await getAuthConfig();
  const response = await fetch(`${cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error('Session expired: could not refresh the access token.');
  const data = (await response.json()) as { access_token: string; expires_in: number };
  writeStoredTokens({ accessToken: data.access_token, refreshToken, expiresAt: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

/** A small safety margin so a token isn't used right as it's about to expire. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Returns a currently-valid access token, refreshing it first if it's expired or about to be.
 *
 * @returns The access token, or `null` if the owner has never signed in (or has signed out).
 */
export async function getAccessToken(): Promise<string | null> {
  const stored = readStoredTokens();
  if (!stored) return null;
  if (stored.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return stored.accessToken;
  return refreshAccessToken(stored.refreshToken);
}

/** Whether the owner has signed in (and hasn't signed out) at all — not whether the token is
 * still valid; {@link getAccessToken} handles refreshing expired tokens transparently. */
export function isSignedIn(): boolean {
  return readStoredTokens() !== null;
}

/** Clears the stored session and redirects to the Hosted UI's logout endpoint. */
export async function signOut(): Promise<never> {
  localStorage.removeItem(STORAGE_KEY);
  const { cognitoDomain, clientId } = await getAuthConfig();
  const url = new URL(`${cognitoDomain}/logout`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('logout_uri', window.location.origin);
  window.location.assign(url.toString());
  return new Promise(() => {});
}
