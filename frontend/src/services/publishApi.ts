// Mirrors backend/src/domain/types.ts's publish-related shapes (004-publish-pipeline-and's
// contracts/publish-api.md).

import { getAccessToken } from './auth.js';
import type { PublishStatus } from './recipesApi.js';

/** Thrown by {@link startPublish}/{@link startUnpublish} so callers can distinguish a `409` (a
 * run is already in progress, FR-009) from any other failure. */
export class PublishRequestError extends Error {
  constructor(public status: number) {
    super(`Publish request failed with status ${status}`);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
}

/** `PATCH /recipes/{id}/publish-toggle` (FR-001). */
export async function setRecipePublishToggle(
  recipeId: string,
  selected: boolean,
): Promise<{ recipeId: string; selectedForNextPublish: boolean; publishStatus: PublishStatus }> {
  const response = await authedFetch(`/recipes/${recipeId}/publish-toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ selected }),
  });
  if (!response.ok) throw new PublishRequestError(response.status);
  return response.json();
}

interface StartRunResponse {
  status: 'started' | 'nothing-to-publish' | 'nothing-to-unpublish';
  executionArn?: string;
}

/** `POST /publish` (FR-003). Throws {@link PublishRequestError} with `status: 409` if a run is already in progress (FR-009). */
export async function startPublish(): Promise<StartRunResponse> {
  const response = await authedFetch('/publish', { method: 'POST' });
  if (!response.ok) throw new PublishRequestError(response.status);
  return response.json();
}

/** `POST /unpublish` (FR-004). Throws {@link PublishRequestError} with `status: 409` if a run is already in progress (FR-009). */
export async function startUnpublish(): Promise<StartRunResponse> {
  const response = await authedFetch('/unpublish', { method: 'POST' });
  if (!response.ok) throw new PublishRequestError(response.status);
  return response.json();
}

export interface PipelineStatusResponse {
  running: boolean;
  action: 'publish' | 'unpublish' | null;
  startedAt: string | null;
  lastResult: 'succeeded' | 'failed' | null;
}

/** `GET /publish-status` (FR-008) — polled by the backoffice while a run is in progress. */
export async function getPublishStatus(): Promise<PipelineStatusResponse> {
  const response = await authedFetch('/publish-status');
  if (!response.ok) throw new PublishRequestError(response.status);
  return response.json();
}
