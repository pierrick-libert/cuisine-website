import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { TranslateInput } from '../../src/domain/types.js';

const parseMock = vi.fn();

// Mocked before importing the handler so `new Anthropic()` (module-load time in
// translate-recipe.ts) picks up this fake client instead of a real one — no network calls in CI.
vi.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  // A regular function, not an arrow function — arrow functions have no [[Construct]], so `new`
  // on the mocked default export would throw "is not a constructor" otherwise.
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { parse: parseMock } };
  }),
}));

const { handler } = await import('../../src/handlers/translate-recipe.js');

function event(body: Partial<TranslateInput>): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as unknown as APIGatewayProxyEventV2;
}

function parseBody<T>(result: { body?: string }): T {
  return JSON.parse(result.body ?? '{}') as T;
}

describe('POST /translate', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('rejects a missing name without calling Anthropic (FR-006)', async () => {
    const result = await handler(event({ name: '', sourceLocale: 'fr', targetLocale: 'en' }));
    expect(result.statusCode).toBe(400);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('translates every field and reassembles the response shape', async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        translations: ['Apple Tart', 'A classic tart.', 'For the dough', 'flour', 'Mix.'],
      },
    });

    const result = await handler(
      event({
        sourceLocale: 'fr',
        targetLocale: 'en',
        name: 'Tarte aux pommes',
        description: 'Une tarte classique.',
        groupNames: { g1: 'Pour la pâte' },
        ingredientNames: { l1: 'farine' },
        steps: {
          s1: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mélanger.' }] }] },
        },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody<{
      name: string;
      description: string;
      groupNames: Record<string, string>;
      ingredientNames: Record<string, string>;
      steps: Record<string, unknown>;
    }>(result);
    expect(body.name).toBe('Apple Tart');
    expect(body.description).toBe('A classic tart.');
    expect(body.groupNames.g1).toBe('For the dough');
    expect(body.ingredientNames.l1).toBe('flour');
    expect(body.steps.s1).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mix.' }] }],
    });
  });

  it('fails clearly (502), never partially, when the translated count does not match', async () => {
    parseMock.mockResolvedValue({ parsed_output: { translations: ['Apple Tart', 'A classic tart.'] } });

    const result = await handler(
      event({
        sourceLocale: 'fr',
        targetLocale: 'en',
        name: 'Tarte aux pommes',
        description: 'Une tarte classique.',
        groupNames: { g1: 'Pour la pâte' },
        ingredientNames: {},
        steps: {},
      }),
    );

    expect(result.statusCode).toBe(502);
  });

  it('fails clearly (502) when the Anthropic call itself errors', async () => {
    parseMock.mockRejectedValue(new Error('network error'));

    const result = await handler(
      event({ sourceLocale: 'fr', targetLocale: 'en', name: 'x', description: '', groupNames: {}, ingredientNames: {}, steps: {} }),
    );

    expect(result.statusCode).toBe(502);
  });
});
