// Local dev entrypoint (`npm run dev`) — maps plain HTTP requests to the same Lambda handlers
// used in production, so there's no separate "local" code path to drift from the real one.
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { handler as createRecipeHandler } from './handlers/create-recipe.js';
import { handler as getRecipeHandler } from './handlers/get-recipe.js';
import { handler as listRecipesHandler } from './handlers/list-recipes.js';
import { handler as updateRecipeHandler } from './handlers/update-recipe.js';
import { handler as deleteRecipeHandler } from './handlers/delete-recipe.js';

const PORT = Number(process.env.PORT ?? 3001);

type RouteHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

function matchRoute(method: string, path: string): { handler: RouteHandler; id?: string } | null {
  if (method === 'POST' && path === '/recipes') return { handler: createRecipeHandler };
  if (method === 'GET' && path === '/recipes') return { handler: listRecipesHandler };
  const detailMatch = path.match(/^\/recipes\/([^/]+)$/);
  if (detailMatch) {
    const id = detailMatch[1];
    if (method === 'GET') return { handler: getRecipeHandler, id };
    if (method === 'PUT') return { handler: updateRecipeHandler, id };
    if (method === 'DELETE') return { handler: deleteRecipeHandler, id };
  }
  return null;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const route = matchRoute(req.method ?? 'GET', url.pathname);
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
    return;
  }

  const body = await readBody(req);
  const event = {
    pathParameters: route.id ? { id: route.id } : undefined,
    body: body || undefined,
  } as APIGatewayProxyEventV2;

  try {
    const result = await route.handler(event);
    const headers = (result.headers ?? {}) as Record<string, string>;
    res.writeHead(result.statusCode ?? 200, { 'Content-Type': 'application/json', ...headers });
    res.end(typeof result.body === 'string' ? result.body : '');
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Local backend listening on http://localhost:${PORT}`);
});
