// Mirrors backend/src/domain/types.ts's TranslateInput/TranslateOutput (contracts/translate-api.md).

import { getAccessToken } from './auth.js';
import type { RawLocaleContent } from './recipesApi.js';

/** The `POST /translate` request body. */
export interface TranslateRequest {
  sourceLocale: string;
  targetLocale: string;
  name: string;
  description: string;
  groupNames: Record<string, string>;
  ingredientNames: Record<string, string>;
  steps: Record<string, RawLocaleContent['steps'][string]>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * Translates a recipe's locale content (name, description, group/ingredient names, every step's
 * rich text) via the backoffice's `/translate` endpoint.
 *
 * @remarks
 * Stateless — this sends whatever the editor currently holds, not a saved recipe; the result is
 * not persisted by this call (FR-003).
 *
 * @param input - The content to translate, plus which locales to translate between.
 * @returns The translated content, in the same shape.
 * @throws If the response status is not ok (2xx) — e.g. `400` (missing name) or `502` (the
 * translation could not be completed).
 */
export async function translateRecipe(input: TranslateRequest): Promise<RawLocaleContent> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }
  return (await response.json()) as RawLocaleContent;
}
