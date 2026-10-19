import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './table-client.js';
import { generateId } from '../lib/id.js';
import { normalizeCategoryName } from '../domain/category.js';
import type { Category } from '../domain/types.js';

const categoryKey = (categoryId: string) => ({ PK: `CATEGORY#${categoryId}`, SK: 'META' });

/**
 * Fetches a category by id, for resolving a recipe's `categoryId` to a display name.
 *
 * @param categoryId - The category's id.
 * @returns The {@link Category}, or `null` if no category with that id exists.
 */
export async function getCategoryById(categoryId: string): Promise<Category | null> {
  const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: categoryKey(categoryId) }));
  return (result.Item as Category | undefined) ?? null;
}

/**
 * Finds an existing category by its case-insensitive normalized name (FR-008), or creates one.
 *
 * @remarks
 * Implemented as a Scan + filter rather than a secondary index — the category count at this
 * project's scale is small, per constitution Principle IV (Simplicity Over Premature Scale).
 *
 * @param displayName - The category name as entered by the editor (any casing).
 * @returns The existing matching {@link Category}, or a newly created one.
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
  const found = existing.Items?.[0] as (Category & { PK?: string; SK?: string }) | undefined;
  if (found) {
    const { PK: _pk, SK: _sk, ...rest } = found;
    return rest;
  }

  const category: Category = { categoryId: generateId(), normalizedName, displayName };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...categoryKey(category.categoryId), ...category },
    }),
  );
  return category;
}

/**
 * Lists every category in the system.
 *
 * @remarks
 * A full table `Scan`, per constitution Principle IV — the category count at this project's
 * scale is small. Used by `rebuild-index.ts` to reconcile which category shell pages should
 * exist per locale.
 */
export async function listCategories(): Promise<Category[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :meta',
      ExpressionAttributeValues: { ':prefix': 'CATEGORY#', ':meta': 'META' },
    }),
  );
  return (result.Items ?? []).map((item) => {
    const { PK: _pk, SK: _sk, ...rest } = item as Category & { PK: string; SK: string };
    return rest;
  });
}
