import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { TABLE_NAME } from '../../src/repository/table-client.js';

process.env.DYNAMODB_ENDPOINT ??= 'http://localhost:8000';

/** Idempotently ensures the single table exists against local DynamoDB (see quickstart.md). */
export async function ensureTable(): Promise<void> {
  const client = new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT,
    region: process.env.AWS_REGION ?? 'us-east-1',
  });
  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
      }),
    );
  } catch (err) {
    if (!(err instanceof ResourceInUseException)) throw err;
  }
}

export function parseBody<T>(result: { body?: string }): T {
  return JSON.parse(result.body ?? '{}') as T;
}
