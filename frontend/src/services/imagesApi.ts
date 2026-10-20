// Mirrors backend/src/handlers/create-image-upload-url.ts's contract (002's contracts/images-
// api.md). This is the first frontend caller of POST /images — the in-step image button
// (StepsEditor.tsx) only inserts by URL, there was never a prior upload flow to follow here.

import { getAccessToken } from './auth.js';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** `POST /images` — requests a presigned upload URL for one image (002, `images-api.md`). */
async function requestImageUploadUrl(contentType: AllowedImageContentType): Promise<{ uploadUrl: string; imageUrl: string }> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}/images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ contentType }),
  });
  if (!response.ok) {
    throw new Error(`Request for an image upload URL failed with status ${response.status}`);
  }
  return (await response.json()) as { uploadUrl: string; imageUrl: string };
}

/**
 * Uploads one image file: requests a presigned URL, then `PUT`s the file directly to S3 (not
 * through the backoffice API — see `images-api.md`'s "Client flow").
 *
 * @param file - The image file to upload; `file.type` must be one of
 * {@link ALLOWED_CONTENT_TYPES}, otherwise this throws before making any request.
 * @returns The uploaded image's final, stable `imageUrl`.
 */
export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED_CONTENT_TYPES.includes(file.type as AllowedImageContentType)) {
    throw new Error(`Unsupported image type "${file.type}". Use JPEG, PNG, or WebP.`);
  }
  const { uploadUrl, imageUrl } = await requestImageUploadUrl(file.type as AllowedImageContentType);
  const putResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!putResponse.ok) {
    throw new Error(`Image upload failed with status ${putResponse.status}`);
  }
  return imageUrl;
}
