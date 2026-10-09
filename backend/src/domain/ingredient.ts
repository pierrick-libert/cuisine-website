import { ValidationError } from './errors.js';
import type { IngredientLineInput } from './types.js';

/**
 * Validates a single ingredient line.
 *
 * FR-004: "Each ingredient line MUST capture a quantity, an optional unit (some ingredients are
 * counted, not measured), and a name." — quantity and name are required; unit is optional.
 *
 * FR-005: "The system MUST allow an ingredient line to optionally record an approximate
 * volume-equivalent measure" — approxEquivalent is optional and not validated further here.
 */
export function validateIngredientLine(line: IngredientLineInput): void {
  if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity)) {
    throw new ValidationError(`Ingredient "${line.name}" requires a numeric quantity.`);
  }
  if (!line.name || !line.name.trim()) {
    throw new ValidationError('Ingredient line requires a name.');
  }
}
