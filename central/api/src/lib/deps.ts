import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { S3Client } from '@aws-sdk/client-s3';
import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ddb, s3, cognito, env } from './clients';
import { newId, newToken } from './ids';

export interface Deps {
  ddb: DynamoDBDocumentClient;
  s3: S3Client;
  cognito: CognitoIdentityProviderClient;
  env: typeof env;
  newId: () => string;
  newToken: () => string;
  now: () => string; // ISO timestamp seam for tests
}

export function makeDeps(): Deps {
  return { ddb, s3, cognito, env, newId, newToken, now: () => new Date().toISOString() };
}
