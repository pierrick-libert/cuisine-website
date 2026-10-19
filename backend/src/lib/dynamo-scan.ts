import { ScanCommand, type ScanCommandInput, type NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../repository/table-client.js';

/**
 * Runs a `Scan`, following `LastEvaluatedKey` until every matching item has been collected.
 *
 * @remarks
 * A single `Scan` response is capped at 1 MB of *scanned* data (before any `FilterExpression` is
 * applied) — at this project's stated scale (100-1000 recipes, each carrying full per-locale
 * Tiptap step content), a plain one-shot `Scan` can silently truncate well before the filter
 * even runs, dropping data with no error (Important 10 from code review). Looping here is the
 * minimal fix that keeps the project's existing "Scan is fine at this scale" stance
 * (constitution Principle IV) honest — a *truncated* Scan is not fine at any scale.
 *
 * @param input - A `ScanCommandInput`, without `ExclusiveStartKey` (this function manages that).
 * @returns Every item across every page.
 */
export async function scanAllItems(
  input: Omit<ScanCommandInput, 'ExclusiveStartKey'>,
): Promise<Record<string, NativeAttributeValue>[]> {
  const items: Record<string, NativeAttributeValue>[] = [];
  let exclusiveStartKey: Record<string, NativeAttributeValue> | undefined;

  do {
    const result = await docClient.send(new ScanCommand({ ...input, ExclusiveStartKey: exclusiveStartKey }));
    items.push(...(result.Items ?? []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}
