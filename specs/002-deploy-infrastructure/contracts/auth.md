# Contract: Backoffice Authentication

## API-wide requirement

Every route on the backoffice API Gateway HTTP API — all of 001-recipe-authoring's
`/recipes*` routes, and this feature's `POST /images` — requires a valid Cognito-issued JWT
access token in the `Authorization: Bearer <token>` header. This is enforced by API Gateway's
native JWT authorizer (backed by the Cognito User Pool + App Client), not by application code —
a request with a missing, expired, or invalid token never reaches a Lambda handler; API Gateway
rejects it with `401`.

This modifies 001-recipe-authoring's `contracts/recipes-api.md`: every route documented there now
additionally requires this header. No other change to those routes' request/response shapes.

## Sign-in flow (Cognito Hosted UI)

1. The SPA redirects the browser to the Cognito User Pool's Hosted UI sign-in page
   (`https://<user-pool-domain>/login?client_id=<app-client-id>&response_type=code&redirect_uri=<spa-callback-url>`).
2. The owner signs in with credentials created for them manually via the AWS Console (no sign-up
   link exists on this page — self-sign-up is disabled on the User Pool, per spec.md FR-004).
3. Cognito redirects back to `<spa-callback-url>?code=<authorization-code>`.
4. The SPA exchanges the code for tokens with one `POST` to the User Pool's token endpoint
   (`https://<user-pool-domain>/oauth2/token`), and stores the returned access token (used as the
   `Authorization` header on every subsequent API call) and refresh token.
5. On access-token expiry, the SPA uses the refresh token against the same token endpoint to get a
   new access token, transparently to the owner.

## What this contract explicitly does not cover

- Any account-creation or self-registration endpoint — none exists, per spec.md FR-004.
- Any password-reset UI in the SPA — Cognito's own (non-self-service) admin flows handle this if
  ever needed; out of scope for this feature.
