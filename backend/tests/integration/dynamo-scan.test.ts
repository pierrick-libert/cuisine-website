import { beforeAll, describe, expect, it } from 'vitest';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../src/repository/table-client.js';
import { scanAllItems } from '../../src/lib/dynamo-scan.js';
import { ensureTable } from './helpers.js';

describe('scanAllItems (Important 10: unpaginated Scans silently drop data)', () => {
  beforeAll(ensureTable);

  it('follows LastEvaluatedKey to collect every item, even across many forced pages', async () => {
    const marker = `scan-paginate-${Date.now()}`;
    for (let i = 0; i < 8; i++) {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: { PK: `TESTSCAN#${marker}`, SK: `ITEM#${i}`, marker },
        }),
      );
    }

    // Limit: 1 forces DynamoDB to paginate even over a handful of items, so this proves the
    // loop actually follows LastEvaluatedKey rather than just trusting a single Scan response.
    const items = await scanAllItems({
      TableName: TABLE_NAME,
      FilterExpression: 'marker = :marker',
      ExpressionAttributeValues: { ':marker': marker },
      Limit: 1,
    });

    expect(items).toHaveLength(8);
  });
});
