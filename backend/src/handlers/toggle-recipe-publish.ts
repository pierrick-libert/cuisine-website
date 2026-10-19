import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { setSelectedForNextPublish } from '../repository/publish-repository.js';
import { json, parseJsonBody } from '../lib/http.js';

interface ToggleInput {
  selected: boolean;
}

/**
 * `PATCH /recipes/\{id\}/publish-toggle` — see `contracts/publish-api.md`.
 *
 * @param event - The API Gateway event; `event.pathParameters.id` is the recipe id and
 * `event.body` is `{ selected: boolean }`.
 * @returns `200` with `{ recipeId, selectedForNextPublish, publishStatus }`, `400` if `id` is
 * missing, or `404` if the recipe does not exist.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const recipeId = event.pathParameters?.id;
  if (!recipeId) return json(400, { message: 'Missing recipe id.' });

  const input = parseJsonBody<ToggleInput>(event.body);
  const meta = await setSelectedForNextPublish(recipeId, input.selected);
  if (!meta) return json(404, { message: 'Recipe not found.' });

  return json(200, {
    recipeId: meta.recipeId,
    selectedForNextPublish: meta.selectedForNextPublish,
    publishStatus: meta.publishStatus,
  });
}
