import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createRecipe } from '../repository/recipe-repository.js';
import { ValidationError } from '../domain/errors.js';
import { json } from '../lib/http.js';
import type { RecipeInput } from '../domain/types.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const input = JSON.parse(event.body ?? '{}') as RecipeInput;
    const recipe = await createRecipe(input);
    return json(201, recipe);
  } catch (err) {
    if (err instanceof ValidationError) return json(400, { message: err.message });
    throw err;
  }
}
