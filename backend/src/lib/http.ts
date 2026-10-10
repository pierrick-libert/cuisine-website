import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ValidationError } from '../domain/errors.js';

/**
 * Parses a Lambda event body as JSON.
 *
 * @remarks
 * A malformed body surfaces as a {@link ValidationError} (which handlers map to HTTP 400)
 * rather than an uncaught `SyntaxError` (which would otherwise become an opaque HTTP 500).
 *
 * @param body - The raw event body, or `undefined` for a bodyless request.
 * @returns The parsed body, cast to `T`.
 * @throws {@link ValidationError} if `body` is not valid JSON.
 */
export function parseJsonBody<T>(body: string | undefined): T {
  try {
    return JSON.parse(body ?? '{}') as T;
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
}

/**
 * Builds an API Gateway HTTP API (payload format 2.0) JSON response.
 *
 * @param statusCode - The HTTP status code to return.
 * @param body - The response payload; serialized as JSON, or omitted entirely when `undefined`
 * (e.g. for a 204 No Content response).
 */
export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}
