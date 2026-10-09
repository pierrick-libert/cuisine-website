import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * Single DynamoDB table, no secondary indexes, per the project constitution's "Simplicity Over
 * Premature Scale" principle. DYNAMODB_ENDPOINT is set for local development (dynamodb-local);
 * unset in AWS, where the SDK resolves the real regional endpoint.
 */
export const TABLE_NAME = process.env.TABLE_NAME ?? 'sunday-kitchen';

const client = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT,
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
