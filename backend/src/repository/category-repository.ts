import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './table-client.js';
import { generateId } from '../lib/id.js';
import { normalizeCategoryName } from '../domain/category.js';
import type { Category } from '../domain/types.js';

const categoryKey = (categoryId: string) => ({ PK: `CATEGORY#${categoryId}`, SK: 'META' });

/**
 * Finds an existing category by its case-insensitive normalized name, or creates one.
 * Implemented as a Scan + filter rather than a secondary index — the category count at this
 * project's scale is small, per constitution Principle IV (Simplicity Over Premature Scale).
 */
export async function findOrCreateCategory(displayName: string): Promise<Category> {
  const normalizedName = normalizeCategoryName(displayName);

  const existing = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :meta AND normalizedName = :norm',
      ExpressionAttributeValues: {
        ':prefix': 'CATEGORY#',
        ':meta': 'META',
        ':norm': normalizedName,
      },
    }),
  );
  const found = existing.Items?.[0] as Category | undefined;
  if (found) return found;

  const category: Category = { categoryId: generateId(), normalizedName, displayName };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...categoryKey(category.categoryId), ...category },
    }),
  );
  return category;
}
