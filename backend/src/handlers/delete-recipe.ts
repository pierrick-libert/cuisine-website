import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { deleteRecipe } from '../repository/recipe-repository.js';
import { json } from '../lib/http.js';

/**
 * `DELETE /recipes/\{id\}` — see `contracts/recipes-api.md`.
 *
 * @param event - The API Gateway event; `event.pathParameters.id` is the recipe id.
 * @returns `204` on success, `400` if `id` is missing, `404` if the recipe does not exist, or
 * `409` if the recipe is currently published (it must be unpublished first — Important 14 from
 * code review).
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const recipeId = event.pathParameters?.id;
  if (!recipeId) return json(400, { message: 'Missing recipe id.' });

  const result = await deleteRecipe(recipeId);
  if (result === 'not_found') return json(404, { message: 'Recipe not found.' });
  if (result === 'still_live') {
    return json(409, { message: 'This recipe is currently published. Unpublish it before deleting.' });
  }
  return { statusCode: 204 };
}
