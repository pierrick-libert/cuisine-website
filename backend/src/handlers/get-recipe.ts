import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getRecipe } from '../repository/recipe-repository.js';
import { json } from '../lib/http.js';

/**
 * `GET /recipes/\{id\}` — see `contracts/recipes-api.md`.
 *
 * @param event - The API Gateway event; `event.pathParameters.id` is the recipe id.
 * @returns `200` with the recipe, `400` if `id` is missing, or `404` if it does not exist.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const recipeId = event.pathParameters?.id;
  if (!recipeId) return json(400, { message: 'Missing recipe id.' });

  const recipe = await getRecipe(recipeId);
  if (!recipe) return json(404, { message: 'Recipe not found.' });
  return json(200, recipe);
}
