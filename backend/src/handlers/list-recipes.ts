import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { listRecipes } from '../repository/recipe-repository.js';
import { json } from '../lib/http.js';

export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  const recipes = await listRecipes();
  return json(200, { recipes });
}
