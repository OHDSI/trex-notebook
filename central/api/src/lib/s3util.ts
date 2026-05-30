import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PRESIGN_TTL = 900; // 15 minutes

export async function presignPut(s3: S3Client, bucket: string, key: string): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: PRESIGN_TTL,
  });
}

export async function presignGet(s3: S3Client, bucket: string, key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: PRESIGN_TTL,
  });
}

export interface HeadResult { exists: boolean; sizeBytes: number; etag: string; }

export async function headObject(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<HeadResult> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { exists: true, sizeBytes: r.ContentLength ?? 0, etag: (r.ETag ?? '').replace(/"/g, '') };
  } catch {
    return { exists: false, sizeBytes: 0, etag: '' };
  }
}
