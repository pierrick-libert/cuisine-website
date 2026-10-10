import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createRecipe } from '../repository/recipe-repository.js';
import { ValidationError } from '../domain/errors.js';
import { json, parseJsonBody } from '../lib/http.js';
import type { RecipeInput } from '../domain/types.js';

/**
 * `POST /recipes` — see `contracts/recipes-api.md`.
 *
 * @param event - The API Gateway event; `event.body` is a JSON {@link RecipeInput}.
 * @returns `201` with the created recipe, or `400` if the body is malformed or fails validation.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const input = parseJsonBody<RecipeInput>(event.body);
    const recipe = await createRecipe(input);
    return json(201, recipe);
  } catch (err) {
    if (err instanceof ValidationError) return json(400, { message: err.message });
    throw err;
  }
}
