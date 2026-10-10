import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { updateRecipe } from '../repository/recipe-repository.js';
import { ValidationError } from '../domain/errors.js';
import { json, parseJsonBody } from '../lib/http.js';
import type { RecipeInput } from '../domain/types.js';

/**
 * `PUT /recipes/\{id\}` — see `contracts/recipes-api.md`.
 *
 * @param event - The API Gateway event; `event.pathParameters.id` is the recipe id and
 * `event.body` is a JSON {@link RecipeInput}.
 * @returns `200` with the updated recipe, `400` if `id` is missing or the body is malformed/
 * invalid, or `404` if the recipe does not exist.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const recipeId = event.pathParameters?.id;
  if (!recipeId) return json(400, { message: 'Missing recipe id.' });

  try {
    const input = parseJsonBody<RecipeInput>(event.body);
    const recipe = await updateRecipe(recipeId, input);
    if (!recipe) return json(404, { message: 'Recipe not found.' });
    return json(200, recipe);
  } catch (err) {
    if (err instanceof ValidationError) return json(400, { message: err.message });
    throw err;
  }
}
