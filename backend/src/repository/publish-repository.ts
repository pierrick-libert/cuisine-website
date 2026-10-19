import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './table-client.js';
import type { PipelineStatus, PublishedSnapshot, PublishStatus, RecipeMeta } from '../domain/types.js';

const metaKey = (recipeId: string) => ({ PK: `RECIPE#${recipeId}`, SK: 'META' });
const publishedKey = (recipeId: string, locale: string) => ({
  PK: `RECIPE#${recipeId}`,
  SK: `PUBLISHED#${locale}`,
});
// Exactly one PIPELINE#STATUS item ever exists (data-model.md) — its own fixed partition key.
const pipelineStatusKey = { PK: 'PIPELINE', SK: 'STATUS' };

const DEFAULT_PIPELINE_STATUS: PipelineStatus = {
  running: false,
  executionArn: null,
  action: null,
  startedAt: null,
  lastResult: null,
};

/**
 * Defaults `selectedForNextPublish`/`publishStatus` on a `RecipeMeta` returned from an `Update`
 * that only wrote one of the two fields — a recipe written before 004-publish-pipeline-and has
 * neither, so the one this particular call didn't set would otherwise read back `undefined`
 * (Important 9 from code review; see `recipe-repository.ts`'s `withPublishDefaults` for the same
 * fix on the read paths).
 */
function withPublishDefaults(meta: RecipeMeta): RecipeMeta {
  return {
    ...meta,
    selectedForNextPublish: meta.selectedForNextPublish ?? false,
    publishStatus: meta.publishStatus ?? 'not_published',
  };
}

/**
 * Sets a recipe's one-shot publish-selection toggle (FR-001).
 *
 * @returns The updated `RecipeMeta`, or `null` if no recipe with that id exists (404 case).
 */
export async function setSelectedForNextPublish(recipeId: string, selected: boolean): Promise<RecipeMeta | null> {
  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: metaKey(recipeId),
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET selectedForNextPublish = :selected',
        ExpressionAttributeValues: { ':selected': selected },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes ? withPublishDefaults(result.Attributes as RecipeMeta) : null;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return null;
    throw err;
  }
}

/**
 * Sets a recipe's current actual public status (FR-008), independent of the toggle above.
 *
 * @returns The updated `RecipeMeta`, or `null` if no recipe with that id exists.
 */
export async function setPublishStatus(recipeId: string, status: PublishStatus): Promise<RecipeMeta | null> {
  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: metaKey(recipeId),
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET publishStatus = :status',
        ExpressionAttributeValues: { ':status': status },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes ? withPublishDefaults(result.Attributes as RecipeMeta) : null;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return null;
    throw err;
  }
}

/** Writes one locale's published-snapshot record (data-model.md's `RECIPE#<id>/PUBLISHED#<locale>`). */
export async function putPublishedSnapshot(snapshot: PublishedSnapshot): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...publishedKey(snapshot.recipeId, snapshot.locale), ...snapshot },
    }),
  );
}

/** Gets one recipe's published-snapshot record for one locale, or `null` if it has none. */
export async function getPublishedSnapshot(recipeId: string, locale: string): Promise<PublishedSnapshot | null> {
  const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: publishedKey(recipeId, locale) }));
  if (!result.Item) return null;
  const { PK: _pk, SK: _sk, ...rest } = result.Item as PublishedSnapshot & { PK: string; SK: string };
  return rest;
}

/** Deletes one locale's published-snapshot record (used when a recipe is unpublished). */
export async function deletePublishedSnapshot(recipeId: string, locale: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: publishedKey(recipeId, locale) }),
  );
}

/**
 * Gets every published-snapshot record for one recipe, across every locale it was published in.
 *
 * @remarks
 * A `Query` by partition key (`RECIPE#<id>`) filtered to `SK` starting with `PUBLISHED#` — this
 * is what `remove-recipe.ts` reads to find exactly which rendered pages to delete, since the
 * slug/locale set actually published may differ from the recipe's current draft locales.
 */
export async function getPublishedSnapshotsForRecipe(recipeId: string): Promise<PublishedSnapshot[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `RECIPE#${recipeId}`, ':prefix': 'PUBLISHED#' },
    }),
  );
  return (result.Items ?? []).map((item) => {
    const { PK: _pk, SK: _sk, ...rest } = item as PublishedSnapshot & { PK: string; SK: string };
    return rest;
  });
}

/**
 * Lists every published-snapshot record across every recipe and locale.
 *
 * @remarks
 * A full table `Scan` filtered to `SK` starting with `PUBLISHED#`, per constitution Principle
 * IV — this is what `rebuild-index.ts` reads from, never live draft recipe data (FR-013).
 */
export async function listPublishedSnapshots(): Promise<PublishedSnapshot[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'PUBLISHED#' },
    }),
  );
  return (result.Items ?? []).map((item) => {
    const { PK: _pk, SK: _sk, ...rest } = item as PublishedSnapshot & { PK: string; SK: string };
    return rest;
  });
}

/** Reads the single `PIPELINE#STATUS` item, defaulting to "never run" if it doesn't exist yet. */
export async function getPipelineStatus(): Promise<PipelineStatus> {
  const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: pipelineStatusKey }));
  if (!result.Item) return DEFAULT_PIPELINE_STATUS;
  const { PK: _pk, SK: _sk, ...rest } = result.Item as PipelineStatus & { PK: string; SK: string };
  return rest;
}

/** Replaces the single `PIPELINE#STATUS` item in full (FR-009's run-lock, `GET /publish-status`). */
export async function setPipelineStatus(status: PipelineStatus): Promise<void> {
  await docClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: { ...pipelineStatusKey, ...status } }),
  );
}

/** Removes the single `PIPELINE#STATUS` item entirely, restoring {@link getPipelineStatus}'s
 * "never run" default. Test-only — production code never deletes this item, only replaces it. */
export async function deletePipelineStatus(): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: pipelineStatusKey }));
}
