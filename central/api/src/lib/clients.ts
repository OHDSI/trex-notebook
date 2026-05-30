import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
export const s3 = new S3Client({});
export const cognito = new CognitoIdentityProviderClient({});

export const env = {
  sitesTable: process.env.SITES_TABLE ?? '',
  studiesTable: process.env.STUDIES_TABLE ?? '',
  submissionsTable: process.env.SUBMISSIONS_TABLE ?? '',
  bucket: process.env.ARTIFACT_BUCKET ?? '',
  userPoolId: process.env.USER_POOL_ID ?? '',
  resourceServerScope: process.env.MACHINE_SCOPE ?? 'network-api/site',
};
