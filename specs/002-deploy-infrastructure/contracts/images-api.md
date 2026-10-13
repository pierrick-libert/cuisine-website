# Contract: Images API (Backoffice)

Base path: `/images` on the backoffice API Gateway HTTP API. Requires authentication — see
[`auth.md`](./auth.md). All request/response bodies are JSON.

## `POST /images`

Requests a presigned URL to upload a new image directly to S3.

**Request body**:

```json
{ "contentType": "image/jpeg" }
```

- `contentType` MUST be one of `image/jpeg`, `image/png`, `image/webp` — anything else → `400`.

**Response** `201`:

```json
{
  "uploadUrl": "https://<bucket>.s3.eu-central-1.amazonaws.com/<generated-key>?X-Amz-...",
  "imageUrl": "https://<bucket>.s3.eu-central-1.amazonaws.com/<generated-key>"
}
```

- `uploadUrl` is a presigned S3 `PUT` URL, valid for 5 minutes, constrained to the requested
  `contentType` and a maximum size of 10 MB.
- `imageUrl` is the final, stable address the image will be reachable at once the upload
  completes — this is what a later feature would store alongside a recipe.
- The object key is generated server-side (a ULID, per data-model.md) — never client-supplied.

**Client flow**: the backoffice calls `POST /images`, then `PUT`s the raw image bytes directly to
`uploadUrl` (not through this API), then uses `imageUrl` as the image's address.

## Out of scope for this contract

- Associating an uploaded image with a specific recipe — a later feature (per spec.md
  Assumptions).
- Listing, deleting, or resizing images.
- Any content moderation or server-side validation of the uploaded bytes themselves (the
  presigned URL's constraints are the only check).
