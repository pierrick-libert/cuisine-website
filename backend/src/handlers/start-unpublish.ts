import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { startRun } from '../domain/publish-run.js';
import { json } from '../lib/http.js';

/**
 * `POST /unpublish` — see `contracts/publish-api.md`.
 *
 * @returns `202` with `{ executionArn, status: "started" }`, `200` with
 * `{ status: "nothing-to-unpublish" }` if no recipe is toggled on, or `409` if a run is already
 * in progress (FR-009).
 */
export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await startRun('unpublish');

  if (result.outcome === 'already-running') {
    return json(409, { message: 'A publish or unpublish run is already in progress.' });
  }
  if (result.outcome === 'nothing-to-do') {
    return json(200, { status: 'nothing-to-unpublish' });
  }
  return json(202, { executionArn: result.executionArn, status: 'started' });
}
