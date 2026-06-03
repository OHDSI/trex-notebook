# Instance Signup — Plan 1: Coordination Center

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public self-signup + one-time credential claim + coordinator approval to the coordination center (`central/`) so a node can request registration and, once approved, retrieve its machine credentials.

**Architecture:** New public `POST /signup` (creates a `pending` site, returns a one-time `claimToken`) and `GET /signup/{siteId}` (returns status; once approved, returns the machine `clientId`+`clientSecret` exactly once). New coordinator `POST /sites/{siteId}/approve` provisions the Cognito confidential client for a pending site and stashes the secret for the node's claim. `central/web` gains a "Pending requests" section with an Approve button.

**Tech Stack:** TypeScript, AWS Lambda (HttpApi), DynamoDB, Cognito, zod, Vue 3 + Vuetify + Pinia (web), Vitest, aws-sdk-client-mock.

**Spec:** `docs/superpowers/specs/2026-06-03-instance-signup-design.md`

---

## File Structure

- Modify: `central/shared/src/dto.ts` — `SiteStatus` adds `'pending'`; add signup DTOs.
- Modify: `central/shared/src/schemas.ts` — add `signupSchema`.
- Modify: `central/shared/tests/schemas.spec.ts` — signup schema tests.
- Create: `central/api/src/handlers/signup.ts` — `createSignup`, `claimSignup` (public, take the raw event).
- Modify: `central/api/src/handlers/sites.ts` — add `approveSite`; strip internal fields from `listSites`/`getSite`.
- Modify: `central/api/src/lib/deps.ts` + `central/api/src/lib/clients.ts` — add `newToken` seam.
- Modify: `central/api/src/lib/ids.ts` — add `newToken()` + `hashToken()`.
- Modify: `central/api/src/router.ts` — add `POST /sites/{siteId}/approve`.
- Modify: `central/api/src/index.ts` — special-case the two public signup routes before `buildContext`.
- Create: `central/api/tests/handlers/signup.spec.ts`.
- Modify: `central/api/tests/handlers/sites.spec.ts` — `approveSite` tests.
- Modify: `central/api/tests/helpers.ts` — add `newToken` to mock deps.
- Modify: `central/template.yaml` — add three HttpApi routes (signup ones `Auth: NONE`).
- Modify: `central/web/src/stores/sites.ts` — add `approve(siteId)`.
- Modify: `central/web/src/views/SitesView.vue` — Pending-requests section + Approve.
- Modify: `central/web/tests/stores/sites.spec.ts` — `approve()` test.

Internal-only persisted site attributes (never in the `Site` DTO, stripped from list/get responses): `claimTokenHash`, `pendingSecret`.

---

## Task 1: shared — signup schema + DTOs + `pending` status

**Files:**
- Modify: `central/shared/src/dto.ts`
- Modify: `central/shared/src/schemas.ts`
- Test: `central/shared/tests/schemas.spec.ts`

- [ ] **Step 1: Write failing schema tests**

Append to `central/shared/tests/schemas.spec.ts`:
```ts
import { signupSchema } from '../src/schemas';

describe('signupSchema', () => {
  it('accepts name + contact', () => {
    expect(signupSchema.safeParse({ name: 'Site A', contact: 'a@x.org' }).success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(signupSchema.safeParse({ name: '', contact: 'a@x.org' }).success).toBe(false);
  });
  it('rejects missing contact', () => {
    expect(signupSchema.safeParse({ name: 'A' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it (fails — no export)**

Run: `cd central/shared && npx vitest run tests/schemas.spec.ts`
Expected: FAIL — `signupSchema` is not exported.

- [ ] **Step 3: Add the schema**

In `central/shared/src/schemas.ts`, after `createSiteSchema`:
```ts
export const signupSchema = z.object({
  name: nonEmpty,
  contact: z.string().trim().email().or(nonEmpty),
});
```

- [ ] **Step 4: Add DTOs + `pending` status**

In `central/shared/src/dto.ts`, change the first line and add DTOs:
```ts
export type SiteStatus = 'active' | 'disabled' | 'pending';
```
Append after the `SiteWithSecret` interface:
```ts
export interface SignupRequest { name: string; contact: string; }
export interface SignupAccepted { siteId: string; claimToken: string; }
export interface SignupStatusResponse { status: SiteStatus; }
export interface SignupCredentials {
  status: 'active';
  cognitoClientId: string;
  clientSecret: string;
}
```

- [ ] **Step 5: Run tests + build**

Run: `cd central/shared && npx vitest run && npm run build 2>/dev/null || npx tsc -p tsconfig.json --noEmit`
Expected: schema tests PASS; type-check clean.

- [ ] **Step 6: Commit**
```bash
git add central/shared/src/dto.ts central/shared/src/schemas.ts central/shared/tests/schemas.spec.ts
git commit -m "feat(central/shared): add signup schema, DTOs, and pending site status"
```

---

## Task 2: api lib — token seam (`newToken`, `hashToken`)

**Files:**
- Modify: `central/api/src/lib/ids.ts`
- Modify: `central/api/src/lib/deps.ts`
- Modify: `central/api/tests/helpers.ts`

- [ ] **Step 1: Add token helpers to `ids.ts`**

Append to `central/api/src/lib/ids.ts`:
```ts
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** 32-byte url-safe claim token (returned to the requester once). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of a claim token — only the hash is persisted. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare of a presented token against a stored hash. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 2: Add `newToken` to `Deps`**

In `central/api/src/lib/deps.ts`: import and wire it.
```ts
import { newId, newToken } from './ids';
```
Add `newToken: () => string;` to the `Deps` interface, and `newToken,` to the object returned by `makeDeps()`.

- [ ] **Step 3: Add `newToken` to the test mock deps**

In `central/api/tests/helpers.ts`, inside `makeMocks`'s `deps` object (next to `newId`/`now`):
```ts
    newToken: () => 'tok-test',
```

- [ ] **Step 4: Type-check**

Run: `cd central/api && npx tsc -p tsconfig.json --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**
```bash
git add central/api/src/lib/ids.ts central/api/src/lib/deps.ts central/api/tests/helpers.ts
git commit -m "feat(central/api): add claim-token helpers and newToken deps seam"
```

---

## Task 3: api — public signup handlers (TDD)

**Files:**
- Create: `central/api/src/handlers/signup.ts`
- Test: `central/api/tests/handlers/signup.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `central/api/tests/handlers/signup.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createSignup, claimSignup } from '../../src/handlers/signup';
import { makeMocks } from '../helpers';
import { hashToken } from '../../src/lib/ids';

function event(opts: { body?: unknown; pathParams?: Record<string, string>; headers?: Record<string, string> }) {
  return {
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    isBase64Encoded: false,
    pathParameters: opts.pathParams ?? {},
    headers: opts.headers ?? {},
  } as any;
}

describe('createSignup', () => {
  it('rejects an invalid body', async () => {
    const { deps } = makeMocks();
    await expect(createSignup(event({ body: { name: '' } }), deps)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('creates a pending site and returns siteId + claimToken once', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(PutCommand).resolves({});
    const r = await createSignup(event({ body: { name: 'Site A', contact: 'a@x.org' } }), deps);
    expect(r.statusCode).toBe(201);
    const body = JSON.parse(r.body);
    expect(body.siteId).toBe('id-1');
    expect(body.claimToken).toBe('tok-test');
    const put = ddb.commandCalls(PutCommand)[0].args[0].input.Item as any;
    expect(put.status).toBe('pending');
    expect(put.cognitoClientId).toBe('');
    expect(put.claimTokenHash).toBe(hashToken('tok-test'));
    expect(put.pendingSecret).toBeUndefined();
  });
});

describe('claimSignup', () => {
  it('404 when the site is unknown', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: undefined });
    await expect(
      claimSignup(event({ pathParams: { siteId: 'x' }, headers: { 'x-signup-token': 'tok-test' } }), deps),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('403 on token mismatch', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'pending', claimTokenHash: hashToken('right') } });
    await expect(
      claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'wrong' } }), deps),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('returns just status while pending', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'pending', claimTokenHash: hashToken('tok-test') } });
    const r = await claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'tok-test' } }), deps);
    expect(JSON.parse(r.body)).toEqual({ status: 'pending' });
  });
  it('returns credentials once when active, then clears them', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({
      Item: { siteId: 's1', status: 'active', cognitoClientId: 'cid-1', pendingSecret: 'sek', claimTokenHash: hashToken('tok-test') },
    });
    ddb.on(UpdateCommand).resolves({});
    const r = await claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'tok-test' } }), deps);
    expect(JSON.parse(r.body)).toEqual({ status: 'active', cognitoClientId: 'cid-1', clientSecret: 'sek' });
    // one-time: the secret + token hash are removed
    const upd = ddb.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(upd.UpdateExpression).toMatch(/REMOVE/i);
    expect(upd.UpdateExpression).toMatch(/pendingSecret/);
  });
  it('active but already claimed (no pendingSecret) → status only', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'active', cognitoClientId: 'cid-1', claimTokenHash: hashToken('tok-test') } });
    const r = await claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'tok-test' } }), deps);
    expect(JSON.parse(r.body)).toEqual({ status: 'active' });
  });
});
```

- [ ] **Step 2: Run it (fails — no module)**

Run: `cd central/api && npx vitest run tests/handlers/signup.spec.ts`
Expected: FAIL — cannot resolve `../../src/handlers/signup`.

- [ ] **Step 3: Implement `signup.ts`**

Create `central/api/src/handlers/signup.ts`:
```ts
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { signupSchema, type Site } from '@central/shared';
import type { Deps } from '../lib/deps';
import { created, ok, type HandlerResult } from '../lib/http';
import { badRequest, notFound, forbidden } from '../lib/errors';
import { hashToken, tokenMatches } from '../lib/ids';

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) throw badRequest('INVALID_BODY', 'request body is required');
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest('INVALID_BODY', 'request body is not valid JSON');
  }
}

// POST /signup  (PUBLIC) — create a pending site request, return a one-time claim token.
export async function createSignup(event: APIGatewayProxyEventV2, deps: Deps): Promise<HandlerResult> {
  const parsed = signupSchema.safeParse(parseBody(event));
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid signup', parsed.error.format());

  const siteId = deps.newId();
  const claimToken = deps.newToken();
  const item: Site & { claimTokenHash: string } = {
    siteId,
    name: parsed.data.name,
    contact: parsed.data.contact,
    status: 'pending',
    cognitoClientId: '',
    createdAt: deps.now(),
    createdBy: 'signup',
    claimTokenHash: hashToken(claimToken),
  };
  await deps.ddb.send(new PutCommand({ TableName: deps.env.sitesTable, Item: item }));
  return created({ siteId, claimToken });
}

// GET /signup/{siteId}  (PUBLIC, X-Signup-Token header) — status; once active, the creds ONCE.
export async function claimSignup(event: APIGatewayProxyEventV2, deps: Deps): Promise<HandlerResult> {
  const siteId = event.pathParameters?.siteId ?? '';
  const token = event.headers?.['x-signup-token'] ?? event.headers?.['X-Signup-Token'] ?? '';
  const res = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  const item = res.Item as (Site & { claimTokenHash?: string; pendingSecret?: string }) | undefined;
  if (!item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  if (!item.claimTokenHash || !tokenMatches(token, item.claimTokenHash)) {
    throw forbidden('invalid signup token');
  }
  if (item.status === 'active' && item.pendingSecret) {
    await deps.ddb.send(
      new UpdateCommand({
        TableName: deps.env.sitesTable,
        Key: { siteId },
        UpdateExpression: 'REMOVE pendingSecret, claimTokenHash',
      }),
    );
    return ok({ status: 'active', cognitoClientId: item.cognitoClientId, clientSecret: item.pendingSecret });
  }
  return ok({ status: item.status });
}
```

- [ ] **Step 4: Run tests**

Run: `cd central/api && npx vitest run tests/handlers/signup.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**
```bash
git add central/api/src/handlers/signup.ts central/api/tests/handlers/signup.spec.ts
git commit -m "feat(central/api): public signup create + one-time credential claim"
```

---

## Task 4: api — coordinator `approveSite` (TDD)

**Files:**
- Modify: `central/api/src/handlers/sites.ts`
- Test: `central/api/tests/handlers/sites.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `central/api/tests/handlers/sites.spec.ts`:
```ts
import { approveSite } from '../../src/handlers/sites';

describe('approveSite', () => {
  it('forbids non-coordinators', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.operator('s1'), pathParams: { siteId: 's1' } });
    await expect(approveSite(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('409 when the site is not pending', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'active' } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    await expect(approveSite(ctx, deps)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('provisions a cognito client and stashes the secret for claim', async () => {
    const { ddb, cognito, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', name: 'A', contact: 'a@x.org', status: 'pending' } });
    cognito.on(CreateUserPoolClientCommand).resolves({ UserPoolClient: { ClientId: 'cid-9', ClientSecret: 'sek-9' } });
    ddb.on(UpdateCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    const r = await approveSite(ctx, deps);
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.status).toBe('active');
    expect(body.cognitoClientId).toBe('cid-9');
    expect(body.pendingSecret).toBeUndefined(); // never returned to the coordinator
    const upd = ddb.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(upd.ExpressionAttributeValues[':p']).toBe('sek-9');
  });
});
```

- [ ] **Step 2: Run it (fails — no export)**

Run: `cd central/api && npx vitest run tests/handlers/sites.spec.ts -t approveSite`
Expected: FAIL — `approveSite` is not exported.

- [ ] **Step 3: Implement `approveSite` + strip internal fields**

In `central/api/src/handlers/sites.ts`, add the import for `conflict`:
```ts
import { badRequest, notFound, conflict } from '../lib/errors';
```
Add a helper near the top and use it in `listSites`/`getSite`, then add `approveSite`:
```ts
function publicSite<T extends Record<string, unknown>>(item: T): Omit<T, 'pendingSecret' | 'claimTokenHash'> {
  const { pendingSecret: _p, claimTokenHash: _h, ...rest } = item as Record<string, unknown>;
  return rest as Omit<T, 'pendingSecret' | 'claimTokenHash'>;
}

export async function approveSite(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const siteId = ctx.pathParams.siteId;
  const res = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  const item = res.Item as (Site & { status: string }) | undefined;
  if (!item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  if (item.status !== 'pending') throw conflict('NOT_PENDING', `site ${siteId} is not pending`);

  const clientRes = await deps.cognito.send(
    new CreateUserPoolClientCommand({
      UserPoolId: deps.env.userPoolId,
      ClientName: `site-${siteId}`,
      GenerateSecret: true,
      AllowedOAuthFlows: ['client_credentials'],
      AllowedOAuthScopes: [deps.env.resourceServerScope],
      AllowedOAuthFlowsUserPoolClient: true,
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
    }),
  );
  const cognitoClientId = clientRes.UserPoolClient?.ClientId ?? '';
  const clientSecret = clientRes.UserPoolClient?.ClientSecret ?? '';

  const updated = await deps.ddb.send(
    new UpdateCommand({
      TableName: deps.env.sitesTable,
      Key: { siteId },
      UpdateExpression: 'SET #s = :a, cognitoClientId = :c, pendingSecret = :p',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':a': 'active', ':c': cognitoClientId, ':p': clientSecret },
      ReturnValues: 'ALL_NEW',
    }),
  );
  return ok(publicSite((updated.Attributes ?? {}) as Record<string, unknown>));
}
```
Then update `listSites` to map items through `publicSite`:
```ts
  return ok((res.Items ?? []).map((i) => publicSite(i as Record<string, unknown>)));
```
and `getSite`'s final return:
```ts
  return ok(publicSite(res.Item as Record<string, unknown>));
```

- [ ] **Step 4: Run the sites suite**

Run: `cd central/api && npx vitest run tests/handlers/sites.spec.ts`
Expected: PASS (existing + 3 new approveSite tests).

- [ ] **Step 5: Commit**
```bash
git add central/api/src/handlers/sites.ts central/api/tests/handlers/sites.spec.ts
git commit -m "feat(central/api): coordinator approveSite + strip internal site fields"
```

---

## Task 5: api — route wiring (router + index public passthrough)

**Files:**
- Modify: `central/api/src/router.ts`
- Modify: `central/api/src/index.ts`
- Test: `central/api/tests/router.spec.ts`

- [ ] **Step 1: Add the approve route + a router test**

In `central/api/src/router.ts`, add to the `routes` map after the sites entries:
```ts
  'POST /sites/{siteId}/approve': sites.approveSite,
```
Append to `central/api/tests/router.spec.ts` (mirror its existing style — verify the key resolves; if the file asserts a route table, add the key there):
```ts
it('routes POST /sites/{siteId}/approve to approveSite', async () => {
  // route() throws ROUTE_NOT_FOUND for unknown keys; a known key reaches the handler.
  // Using a coordinator-less ctx makes approveSite throw FORBIDDEN (403), proving the route resolved.
  const { deps } = makeMocks();
  const ctx = makeCtx({ routeKey: 'POST /sites/{siteId}/approve', role: ROLES.operator('s1'), pathParams: { siteId: 's1' } });
  await expect(route(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
});
```
(If `router.spec.ts` lacks `makeMocks`/`makeCtx`/`ROLES`/`route` imports, add them from `./helpers` and `../src/router`.)

- [ ] **Step 2: Run it (fails before wiring)**

Run: `cd central/api && npx vitest run tests/router.spec.ts -t approve`
Expected: FAIL with `ROUTE_NOT_FOUND` (404) until the route is added — then PASS after Step 1's map edit is in place. (If you added the map entry already, confirm PASS.)

- [ ] **Step 3: Public passthrough in `index.ts`**

In `central/api/src/index.ts`, import the signup handlers and special-case the two public routes before `buildContext` (mirroring `/health`):
```ts
import { createSignup, claimSignup } from './handlers/signup';
```
Inside `handler`, right after the `/health` block:
```ts
    // Public, tokenless signup routes (no Cognito JWT) — handle before role resolution.
    if (event.routeKey === 'POST /signup') {
      return await createSignup(event, deps);
    }
    if (event.routeKey === 'GET /signup/{siteId}') {
      return await claimSignup(event, deps);
    }
```
(The `event` here is the JWT-authorizer event type; cast as needed — `createSignup`/`claimSignup` accept `APIGatewayProxyEventV2`, which is structurally compatible for `body`/`pathParameters`/`headers`. If TS complains, accept `event as unknown as APIGatewayProxyEventV2`.)

- [ ] **Step 4: Type-check + full api suite**

Run: `cd central/api && npx tsc -p tsconfig.json --noEmit && npx vitest run`
Expected: clean; all tests pass.

- [ ] **Step 5: Commit**
```bash
git add central/api/src/router.ts central/api/src/index.ts central/api/tests/router.spec.ts
git commit -m "feat(central/api): wire approve route and public signup passthrough"
```

---

## Task 6: template.yaml — three HttpApi routes

**Files:**
- Modify: `central/template.yaml`

- [ ] **Step 1: Add the events**

In `central/template.yaml`, under `ApiFunction` → `Properties` → `Events`, add three entries (mirror the existing `{ ApiId: !Ref HttpApi, Path: ..., Method: ... }` style). The two signup routes opt out of the authorizer like `/health`:
```yaml
        Signup:
          Type: HttpApi
          Properties: { ApiId: !Ref HttpApi, Path: /signup, Method: POST, Auth: { Authorizer: NONE } }
        SignupClaim:
          Type: HttpApi
          Properties: { ApiId: !Ref HttpApi, Path: "/signup/{siteId}", Method: GET, Auth: { Authorizer: NONE } }
        ApproveSite:
          Type: HttpApi
          Properties: { ApiId: !Ref HttpApi, Path: "/sites/{siteId}/approve", Method: POST }
```

- [ ] **Step 2: Validate the template**

Run: `cd central && npx --yes js-yaml template.yaml >/dev/null && echo "yaml-ok"` (or `sam validate` if the SAM CLI is installed).
Expected: `yaml-ok` (valid YAML). If `js-yaml` chokes on SAM intrinsics, fall back to `python3 -c "import yaml,sys; yaml.safe_load(open('central/template.yaml'))" 2>/dev/null && echo ok` — note SAM `!Ref` shorthand may need the CFN tag loader, so a plain YAML check that ignores unknown tags is sufficient to catch indentation errors.

- [ ] **Step 3: Commit**
```bash
git add central/template.yaml
git commit -m "feat(central): expose POST /signup, GET /signup/{siteId} (public), POST /sites/{siteId}/approve"
```

---

## Task 7: web — `approve` store action + Pending section (TDD for store)

**Files:**
- Modify: `central/web/src/stores/sites.ts`
- Test: `central/web/tests/stores/sites.spec.ts`
- Modify: `central/web/src/views/SitesView.vue`

- [ ] **Step 1: Write the failing store test**

Append to `central/web/tests/stores/sites.spec.ts` (mirror the file's existing mocked-`ApiClient` pattern; if it constructs a fake client with `post`, reuse that):
```ts
it('approve() POSTs to the approve route then refreshes', async () => {
  const calls: string[] = [];
  const fakeApi = {
    get: async () => { calls.push('GET /sites'); return []; },
    post: async (p: string) => { calls.push(`POST ${p}`); return {}; },
    patch: async () => ({}), del: async () => undefined,
  } as any;
  const store = useSitesStore(fakeApi);
  await store.approve('s1');
  expect(calls).toContain('POST /sites/s1/approve');
  expect(calls).toContain('GET /sites'); // fetchAll() after approve
});
```

- [ ] **Step 2: Run it (fails — no `approve`)**

Run: `cd central/web && npx vitest run tests/stores/sites.spec.ts -t approve`
Expected: FAIL — `store.approve is not a function`.

- [ ] **Step 3: Add `approve` to the store**

In `central/web/src/stores/sites.ts`, add inside the store and to the returned object:
```ts
    async function approve(siteId: string) {
      await apiClient.post(`/sites/${siteId}/approve`);
      await fetchAll();
    }
```
Add `approve` to the `return { ... }` list.

- [ ] **Step 4: Run it (passes)**

Run: `cd central/web && npx vitest run tests/stores/sites.spec.ts`
Expected: PASS.

- [ ] **Step 5: Add the Pending section to `SitesView.vue`**

In `central/web/src/views/SitesView.vue`, add a pending block above the existing `<v-table>` (the existing table already renders all sites incl. pending; this section gives coordinators an explicit approve affordance):
```vue
    <v-card v-if="pendingSites.length" variant="tonal" color="warning" class="mb-4">
      <v-card-title class="text-subtitle-1">Pending registration requests</v-card-title>
      <v-table>
        <thead><tr><th>Name</th><th>Contact</th><th class="text-right">Action</th></tr></thead>
        <tbody>
          <tr v-for="s in pendingSites" :key="s.siteId">
            <td>{{ s.name }}</td>
            <td>{{ s.contact }}</td>
            <td class="text-right">
              <v-btn size="small" color="primary" :loading="approving === s.siteId" @click="approve(s)">Approve</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
```
In `<script setup>` add:
```ts
import { computed } from 'vue';
const approving = ref<string | null>(null);
const pendingSites = computed(() => store.sites.filter((s) => s.status === 'pending'));
async function approve(s: Site) {
  approving.value = s.siteId;
  try { await store.approve(s.siteId); } finally { approving.value = null; }
}
```
(The existing status chip already renders `pending` — its color falls through to grey, which is fine.)

- [ ] **Step 6: Type-check + tests + build**

Run: `cd central/web && npx vue-tsc --noEmit && npx vitest run && npm run build`
Expected: clean; tests pass; build succeeds.

- [ ] **Step 7: Commit**
```bash
git add central/web/src/stores/sites.ts central/web/tests/stores/sites.spec.ts central/web/src/views/SitesView.vue
git commit -m "feat(central/web): approve pending site requests"
```

---

## Task 8: Phase-1 verification

- [ ] **Step 1: Full CC gates**

Run:
```
cd central/shared && npx vitest run
cd ../api && npx tsc -p tsconfig.json --noEmit && npx vitest run
cd ../web && npx vue-tsc --noEmit && npx vitest run && npm run build
```
Expected: all green.

- [ ] **Step 2: Contract recap for Plan 2 (node)**

Confirm the node-facing contract now exists: `POST /signup {name,contact} → 201 {siteId, claimToken}`; `GET /signup/{siteId}` with `X-Signup-Token` → `{status}` or (once active) `{status:'active', cognitoClientId, clientSecret}`; coordinator `POST /sites/{siteId}/approve`. Plan 2 depends only on this contract.

---

## Self-Review Notes

- **Spec coverage:** signup schema/DTOs + pending status (Task 1); token helpers (Task 2); public create + one-time claim (Task 3); coordinator approve + internal-field stripping (Task 4); routing incl. public passthrough (Task 5); template routes with `Auth: NONE` (Task 6); web approve store + pending UI (Task 7). All Phase-1 spec items map to a task.
- **Security:** `claimToken` returned once, only its hash persisted (`hashToken`), constant-time compare (`tokenMatches`); `pendingSecret` never returned to the coordinator (stripped in list/get/approve) and removed on first node claim.
- **Type consistency:** handler names (`createSignup`, `claimSignup`, `approveSite`), the `:p`/`pendingSecret` attribute, and the `{status, cognitoClientId, clientSecret}` claim shape are used identically across handlers, tests, and the node contract recap.
