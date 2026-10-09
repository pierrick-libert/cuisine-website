import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ValidationError } from '../domain/errors.js';

/** Parses the request body as JSON, surfacing a malformed body as a ValidationError (-> 400)
 * rather than an uncaught SyntaxError (-> 500). */
export function parseJsonBody<T>(body: string | undefined): T {
  try {
    return JSON.parse(body ?? '{}') as T;
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
}

export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}
