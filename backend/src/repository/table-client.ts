import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * The single DynamoDB table name, with no secondary indexes — per the project constitution's
 * "Simplicity Over Premature Scale" principle.
 */
export const TABLE_NAME = process.env.TABLE_NAME ?? 'sunday-kitchen';

const client = new DynamoDBClient({
  // Set for local development (dynamodb-local); unset in AWS, where the SDK resolves the real
  // regional endpoint.
  endpoint: process.env.DYNAMODB_ENDPOINT,
  region: process.env.AWS_REGION ?? 'us-east-1',
});

/** The shared DynamoDB Document Client every repository function reads/writes through. */
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
