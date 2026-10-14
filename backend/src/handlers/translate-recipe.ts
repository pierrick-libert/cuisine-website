import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { Resource } from 'sst';
import { ValidationError, TranslationError } from '../domain/errors.js';
import { json, parseJsonBody } from '../lib/http.js';
import { extractText, reinsertText } from '../domain/rich-text-translation.js';
import type { TranslateInput, TranslateOutput } from '../domain/types.js';

const TranslationSchema = z.object({ translations: z.array(z.string()) });

// Typed locally rather than relying on SST's generated `sst-env.d.ts` (which only exists after a
// real `sst deploy`/`dev` has run — never true in CI, which this handler's own typecheck must
// still pass). `Resource` itself is a real runtime export of the `sst` package regardless.
const anthropicApiKey = (Resource as unknown as { AnthropicApiKey: { value: string } }).AnthropicApiKey.value;
const client = new Anthropic({ apiKey: anthropicApiKey });

/**
 * Sends every extracted string to Claude in a single call (research.md's batching decision — one
 * call per translation request, for cost and cross-field terminology consistency) and validates
 * the response's shape before trusting it.
 *
 * @throws {@link TranslationError} if the Anthropic call itself fails, or if the returned
 * translation count doesn't exactly match what was sent — never a partial/best-effort result
 * (FR-007).
 */
async function translateTexts(texts: string[], sourceLocale: string, targetLocale: string): Promise<string[]> {
  let response;
  try {
    response = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(TranslationSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content:
            `Translate each of the following ${texts.length} strings from locale "${sourceLocale}" ` +
            `to locale "${targetLocale}". Return exactly ${texts.length} translations, in the same ` +
            'order as the input, one per input string — never merge, split, or omit any, even if ' +
            'a string is empty (return an empty string for it) or looks identical across locales.\n\n' +
            JSON.stringify(texts),
        },
      ],
    });
  } catch {
    throw new TranslationError('Could not generate a translation. Please try again.');
  }

  const translations = response.parsed_output?.translations;
  if (!translations || translations.length !== texts.length) {
    throw new TranslationError('Could not generate a translation. Please try again.');
  }
  return translations;
}

/**
 * `POST /translate` — see `contracts/translate-api.md`.
 *
 * @remarks
 * Stateless: translates whatever recipe text the editor currently holds (name, description,
 * every group/ingredient name, every step's rich text) in one Claude call — never reads or writes
 * the database. Step formatting is preserved by construction: only each step's extracted text
 * nodes are sent for translation ({@link extractText}), and the result is spliced back into the
 * original document structure ({@link reinsertText}), never regenerated (FR-002).
 *
 * @param event - The API Gateway event; `event.body` is a JSON {@link TranslateInput}.
 * @returns `200` with the translated {@link TranslateOutput}, `400` if `name` is missing/empty
 * (FR-006), or `502` if the translation could not be completed (FR-007).
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const input = parseJsonBody<TranslateInput>(event.body);
    if (!input.name || !input.name.trim()) {
      throw new ValidationError('Recipe name is required.');
    }

    const groupIds = Object.keys(input.groupNames);
    const ingredientIds = Object.keys(input.ingredientNames);
    const stepIds = Object.keys(input.steps);
    const stepTexts = stepIds.map((id) => extractText(input.steps[id]!));

    const flatTexts: string[] = [
      input.name,
      input.description,
      ...groupIds.map((id) => input.groupNames[id]!),
      ...ingredientIds.map((id) => input.ingredientNames[id]!),
      ...stepTexts.flat(),
    ];

    const translations = await translateTexts(flatTexts, input.sourceLocale, input.targetLocale);

    let cursor = 0;
    const take = (count: number) => translations.slice(cursor, (cursor += count));

    const [translatedName] = take(1);
    const [translatedDescription] = take(1);
    const translatedGroupNames = Object.fromEntries(groupIds.map((id) => [id, take(1)[0]!]));
    const translatedIngredientNames = Object.fromEntries(ingredientIds.map((id) => [id, take(1)[0]!]));
    const translatedSteps = Object.fromEntries(
      stepIds.map((id, i) => [id, reinsertText(input.steps[id]!, take(stepTexts[i]!.length))]),
    );

    const output: TranslateOutput = {
      name: translatedName!,
      description: translatedDescription!,
      groupNames: translatedGroupNames,
      ingredientNames: translatedIngredientNames,
      steps: translatedSteps,
    };
    return json(200, output);
  } catch (err) {
    if (err instanceof ValidationError) return json(400, { message: err.message });
    if (err instanceof TranslationError) return json(502, { message: err.message });
    throw err;
  }
}
