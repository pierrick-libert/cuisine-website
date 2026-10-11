import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ValidationError } from '../domain/errors.js';
import { json, parseJsonBody } from '../lib/http.js';
import { generateId } from '../lib/id.js';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;

const s3 = new S3Client({});

interface CreateImageUploadUrlInput {
  contentType: string;
}

/**
 * `POST /images` — see `contracts/images-api.md`.
 *
 * @remarks
 * Issues a presigned S3 `PUT` URL rather than accepting the image bytes directly, so the browser
 * uploads straight to S3 and this Lambda only ever handles a tiny JSON request/response
 * (research.md's "Image upload" decision). The object key is generated server-side (a ULID) —
 * never client-supplied, to avoid key collisions or path traversal.
 *
 * @param event - The API Gateway event; `event.body` is a JSON {@link CreateImageUploadUrlInput}.
 * @returns `201` with `uploadUrl` and `imageUrl`, or `400` if `contentType` is missing or not one
 * of {@link ALLOWED_CONTENT_TYPES}.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const input = parseJsonBody<CreateImageUploadUrlInput>(event.body);
    if (!ALLOWED_CONTENT_TYPES.includes(input.contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
      throw new ValidationError(`contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}.`);
    }

    const bucketName = process.env.IMAGES_BUCKET_NAME ?? 'clp-images';
    const key = generateId();
    const region = process.env.AWS_REGION ?? 'eu-central-1';

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: input.contentType }),
      { expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
    );
    const imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return json(201, { uploadUrl, imageUrl });
  } catch (err) {
    if (err instanceof ValidationError) return json(400, { message: err.message });
    throw err;
  }
}
