import type { Deps } from '../src/lib/deps';
import type { RequestContext } from '../src/lib/context';
import type { Role } from '../src/lib/auth';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

export const ROLES = {
  coordinator: { kind: 'coordinator', subject: 'user:coord' } as Role,
  operator: (siteId: string): Role => ({ kind: 'site-operator', siteId, subject: 'user:op' }),
  machine: (clientId: string): Role => ({ kind: 'machine', clientId, subject: `client:${clientId}` }),
};

export function makeCtx(opts: {
  routeKey?: string;
  role: Role;
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}): RequestContext {
  const rawBody = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return {
    routeKey: opts.routeKey ?? 'GET /health',
    pathParams: opts.pathParams ?? {},
    query: opts.query ?? {},
    role: opts.role,
    rawBody,
    json<T>(): T {
      if (!rawBody) throw new Error('no body');
      return JSON.parse(rawBody) as T;
    },
  };
}

export interface Mocks {
  ddb: ReturnType<typeof mockClient>;
  s3: ReturnType<typeof mockClient>;
  cognito: ReturnType<typeof mockClient>;
  deps: Deps;
}

let counter = 0;

export function makeMocks(env?: Partial<Deps['env']>): Mocks {
  const ddb = mockClient(DynamoDBDocumentClient);
  const s3 = mockClient(S3Client);
  const cognito = mockClient(CognitoIdentityProviderClient);
  counter = 0;
  const deps: Deps = {
    ddb: ddb as unknown as Deps['ddb'],
    s3: s3 as unknown as Deps['s3'],
    cognito: cognito as unknown as Deps['cognito'],
    env: {
      sitesTable: 'Sites',
      studiesTable: 'Studies',
      submissionsTable: 'Submissions',
      bucket: 'artifacts',
      userPoolId: 'pool-1',
      resourceServerScope: 'network-api/site',
      ...env,
    },
    newId: () => `id-${++counter}`,
    newToken: () => 'tok-test',
    now: () => '2026-05-30T00:00:00.000Z',
  };
  return { ddb, s3, cognito, deps };
}
