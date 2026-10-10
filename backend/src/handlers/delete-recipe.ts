import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { deleteRecipe } from '../repository/recipe-repository.js';
import { json } from '../lib/http.js';

/**
 * `DELETE /recipes/\{id\}` — see `contracts/recipes-api.md`.
 *
 * @param event - The API Gateway event; `event.pathParameters.id` is the recipe id.
 * @returns `204` on success, `400` if `id` is missing, or `404` if the recipe does not exist.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const recipeId = event.pathParameters?.id;
  if (!recipeId) return json(400, { message: 'Missing recipe id.' });

  const deleted = await deleteRecipe(recipeId);
  if (!deleted) return json(404, { message: 'Recipe not found.' });
  return { statusCode: 204 };
}
