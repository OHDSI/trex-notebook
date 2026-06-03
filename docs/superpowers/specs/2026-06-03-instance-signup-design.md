# Network instance self-signup at the coordination center

Date: 2026-06-03
Status: Approved (brainstorming) — pending implementation plan

## Goal

Let a new trex network node **self-register ("sign up") with the coordination
center (CC)** from its own UI. A site operator opens a "Register this site" view
in the network plugin, submits name + contact; this creates a **pending** site
request at the CC. A CC coordinator approves it in `central/web`, which
provisions the site's machine (Cognito client-credentials) client + secret. The
node then **automatically retrieves and stores** those credentials so the
existing `network-api` machine proxy becomes live — **without a redeploy**.

All node→CC calls go **through the local `network-api` function**, never the
browser directly (per the existing network architecture).

## Context (what exists)

- **`plugins/network`** — site-facing Vue/Vuetify single-spa plugin. Talks only
  to `network-api` via `proxyUrl = ${origin}/plugins/network-api/network-api`.
- **`plugins/network-api`** — function-only trex plugin. Holds the per-site
  Cognito **confidential** client (`NETWORK_MACHINE_CLIENT_ID` /
  `NETWORK_CLIENT_SECRET`, from env) and reverse-proxies browser calls to
  `NETWORK_CENTRAL_API_URL` with a machine bearer token. Gated by trex session
  (`x-user-id`). Returns 503 `NOT_CONFIGURED` when the machine env is unset.
- **`central/`** — the coordination center (AWS SAM serverless), in this repo:
  - `central/api` — Lambda + HttpApi. Roles (`api/src/lib/auth.ts`):
    `coordinator`, `site-operator`, `machine`. `POST /sites` (`createSite`,
    **coordinator-only**) creates a Cognito confidential client (client_credentials
    + secret), stores `Site {siteId,name,contact,status,cognitoClientId,createdAt,
    createdBy}` in DynamoDB, returns `SiteWithSecret`. Auth: HttpApi
    `DefaultAuthorizer: CognitoJwt`; `/health` opts out with
    `Auth: { Authorizer: NONE }` and is special-cased in `api/src/index.ts`
    before `buildContext` (which would otherwise reject a tokenless request).
  - `central/shared` — zod schemas + DTOs (`createSiteSchema`, `Site`,
    `SiteStatus = 'active'|'disabled'`).
  - `central/web` — coordinator admin UI (Vue/Vuetify). `SitesView.vue`,
    `RegisterSiteDialog.vue`, `stores/sites.ts` already manage sites.
- **`plugins/metadata-api`** — precedent for a function reading/writing a
  runtime store: `functions/sql.ts` reaches trex's DuckDB→`_config` Postgres via
  `Trex.databaseManager()`; `functions/crypto.ts` AES-encrypts secrets at rest;
  `migrations/` + `trex.migrations` in `package.json` create the schema.

### Why a pending→approve flow (the core constraint)

A brand-new node has **no Cognito credentials**, so it cannot call the
coordinator-only `POST /sites`, and it must not be able to mint a machine client
unauthenticated. So signup is split: a **public** request endpoint that only
creates a `pending` record (no credentials), then a **coordinator approval**
that provisions credentials, then a **one-time claim** by the node.

`network-api` reads machine creds from **env**, set at trex start and **not
runtime-mutable**. So to go live without a redeploy, the node persists the
claimed creds in a runtime store (`_config` Postgres) that `network-api` reads
per request (env remains a fallback) — mirroring `metadata-api`.

## Decisions (from brainstorming)

1. **Flow**: request → coordinator approves → **node auto-fetches creds** and
   stores them; the proxy then uses the stored creds.
2. **CC scope**: build the API **and** the coordinator approval UI in
   `central/web`.
3. **Node relay**: extend **`network-api`** with an **unauthenticated `/signup`
   passthrough** (skip machine token + `NETWORK_MACHINE_*` gate for that path;
   still require trex session).
4. **Node UI**: a **new view in the network plugin**; form collects **name +
   contact** (matches `createSiteSchema`).

## Architecture / flow

```
network plugin "Register this site"  ──POST /network-api/signup {name,contact}──▶ network-api (unauth passthrough, trex session required)
                                                                                      │ POST {CENTRAL}/signup
                                                                                      ▼
                                              CC POST /signup (PUBLIC) → Site{status:'pending'} (no client), claimToken
   node stores {siteId, claimToken, status:'pending'} in _config: network.site_credential ◀── {siteId, claimToken}

coordinator (central/web → Sites → Pending) ──POST /sites/{siteId}/approve──▶ CC (coordinator): provision Cognito client+secret,
                                                                              status:'active', stash secret for one-time claim

network plugin polls ──GET /network-api/signup/status──▶ network-api ──GET {CENTRAL}/signup/{siteId} (X-Signup-Token)──▶ CC
                                                                              if active → returns {cognitoClientId, clientSecret} ONCE
   node writes {cognitoClientId, enc(clientSecret), status:'active'} to network.site_credential; CC clears the stashed secret
                                                                              ▼
   subsequent machine-proxy calls read creds from network.site_credential (fallback: env) → node is live
```

## Components

### A. CC shared (`central/shared`)

- `dto.ts`: extend `SiteStatus` to `'active' | 'disabled' | 'pending'`. Add
  `SignupRequest { name; contact }`, `SignupAccepted { siteId; claimToken }`,
  `SignupStatus { status: SiteStatus }`, and `SignupCredentials { siteId;
  cognitoClientId; clientSecret }`.
- `schemas.ts`: add `signupSchema = z.object({ name: nonEmpty, contact:
  email|nonEmpty })` (same shape as `createSiteSchema`; kept separate so the two
  evolve independently).

### B. CC api (`central/api`)

New handlers in `api/src/handlers/signup.ts`:

- `POST /signup` — **public**. Validates `signupSchema`. `siteId = newId()`.
  Generates a high-entropy `claimToken` (e.g. 32 random bytes, base64url);
  stores only its **hash** (`claimTokenHash`) on the site item. Writes
  `Site {siteId, name, contact, status:'pending', cognitoClientId:'',
  createdAt, createdBy:'signup'}` plus `claimTokenHash`. Returns `201
  {siteId, claimToken}` (token returned once, never stored in clear).
- `GET /signup/{siteId}` — **public**, requires header `X-Signup-Token`.
  Looks up the site; verifies `hash(token) === claimTokenHash`
  (constant-time). Returns `{status}`. If `status==='active'` **and** a
  `pendingSecret` is present, returns `{status, cognitoClientId, clientSecret}`
  **once**, then deletes `pendingSecret` + `claimTokenHash` from the item
  (one-time claim). 404 if no site; 403 on token mismatch.
- `POST /sites/{siteId}/approve` — **coordinator** (`requireCoordinator`).
  Loads the site; requires `status==='pending'`. Provisions a Cognito
  confidential client (the same `CreateUserPoolClientCommand` block as
  `createSite`). Updates the item: `status:'active'`, `cognitoClientId`,
  `pendingSecret = clientSecret` (held for the node's one-time claim).
  Returns the site (no secret in this response — the secret travels only via the
  node's authenticated `/signup/{siteId}` claim).

Wiring:
- `index.ts`: special-case the two **public** signup routes **before**
  `buildContext` (mirroring `/health`), since they carry no Cognito JWT. Invoke
  the signup handlers directly with `(event, deps)` — they read `name/contact`
  from the body, `siteId` from `event.pathParameters`, and the token from
  `event.headers['x-signup-token']` themselves (no role-bearing
  `RequestContext`). These two are therefore **not** in the role-typed
  `router.ts` map.
- `router.ts`: add only the authenticated `'POST /sites/{siteId}/approve':
  sites.approveSite` entry (normal `(ctx, deps)` handler). `approveSite` can
  live in `handlers/sites.ts` (it reuses the Cognito-client provisioning), while
  the public `createSignup`/`claimSignup` live in `handlers/signup.ts`.
- `template.yaml`: add three `HttpApi` events. `POST /signup` and
  `GET /signup/{siteId}` get `Auth: { Authorizer: NONE }`; `approve` uses the
  default Cognito authorizer.

> `pendingSecret` lives transiently in the DynamoDB site item between approval
> and claim, then is deleted on first claim. (Follow-up hardening, out of scope:
> KMS-encrypt it / TTL it; rate-limit/captcha public `POST /signup`.)

### C. CC web (`central/web`)

- `stores/sites.ts`: add `approve(siteId)` → `POST /sites/{siteId}/approve`;
  ensure the list query surfaces `status`.
- `SitesView.vue`: add a **"Pending requests"** section listing sites with
  `status==='pending'` (name, contact, requested time) each with an **Approve**
  button (calls `approve`, then refreshes). Active/disabled sites render as
  today. No secret is shown in the web UI (it's delivered to the node).

### D. Node `network-api` (`plugins/network-api`)

- `functions/index.ts`: before the existing config/machine-token gate,
  special-case the signup paths (still require `x-user-id`):
  - `POST /network-api/signup` → forward body to `${CENTRAL}/signup` with **no**
    bearer. On `201`, persist `{siteId, claimToken, status:'pending'}` into
    `network.site_credential` (single row). Return `{siteId, status:'pending'}`
    to the browser (never the claimToken).
  - `GET /network-api/signup/status` → read the stored row. If already
    `active`, return `{status:'active'}`. Else call
    `${CENTRAL}/signup/{siteId}` with `X-Signup-Token: <stored claimToken>`. If
    the response includes credentials, write `cognitoClientId` +
    `enc(clientSecret)` + `status:'active'` to the row and return
    `{status:'active'}`; otherwise return `{status:'pending'}`.
  - `GET /network-api/signup/state` → `{registered: bool, status}` so the UI can
    decide which view state to show.
- The existing **machine-token path** (`getMachineToken`) is updated to source
  `clientId`/`clientSecret` from `network.site_credential` (decrypting the
  secret) when present, falling back to `NETWORK_MACHINE_CLIENT_ID` /
  `NETWORK_CLIENT_SECRET` env. The `NOT_CONFIGURED` gate passes when **either**
  the stored row (active) **or** the env pair is present.
- New `functions/sql.ts` and `functions/crypto.ts` adapted from
  `metadata-api` (DuckDB→`_config` transport; AES via a `NETWORK_ENC_KEY`).
- `migrations/V1__network_signup.sql`: `CREATE SCHEMA IF NOT EXISTS network;`
  `CREATE TABLE network.site_credential ( id INT PRIMARY KEY DEFAULT 1, site_id
  TEXT, claim_token TEXT, cognito_client_id TEXT, client_secret_enc BYTEA,
  status TEXT NOT NULL DEFAULT 'pending', updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1) );` (single-row table — a node is one site).
- `package.json`: add `trex.migrations { schema: 'network', database: '_config' }`
  and `NETWORK_ENC_KEY` to `trex.functions.env._shared`.

### E. Node network plugin (`plugins/network`)

- `src/views/RegisterSiteView.vue`: name + contact form. States:
  - **unregistered** → form; submit calls store `signup()`.
  - **pending** → "Awaiting coordinator approval", polls `signup/status` every
    ~5s; a manual "Check now" button too.
  - **active** → "This site is registered and connected." (machine proxy live).
- `src/store/useNetworkStore.ts` (or a small `useSignupStore`): `signup(body)`
  → `POST signup`; `refreshState()` → `GET signup/state`; `pollStatus()` →
  `GET signup/status`. Uses the existing `ApiClient`/`proxyUrl`.
- `NetworkApp.vue`: route/tab to the register view; surface it prominently when
  state is unregistered/pending (the rest of the network UI needs an active
  site).

## Data flow & security

- `claimToken`: 32 random bytes (base64url). Returned to the requester **once**;
  CC stores only a hash. Required (constant-time compare) to claim creds. The
  node keeps it in `network.site_credential` until the active claim succeeds.
- Machine `clientSecret`: encrypted at rest in the node store (`NETWORK_ENC_KEY`);
  never sent to the browser (the proxy keeps it server-side, as today).
- Public `POST /signup` only creates a pending, credential-less record;
  credentials require coordinator approval. Rate-limiting/captcha is a noted
  follow-up.
- `network-api` still gates every call (including signup) on the trex session
  (`x-user-id`), so only the node's logged-in operator can drive signup.

## Error handling

- CC: `signupSchema` failure → 400 `INVALID_BODY`; unknown site → 404; token
  mismatch → 403; approve on non-pending site → 409 `NOT_PENDING`.
- network-api: central unreachable → 502 (existing `UPSTREAM_*` shape); store
  read/write failure → 500 with a safe code; missing stored row on status poll →
  `{registered:false}`.
- Plugin: surfaces CC/relay errors in a Vuetify alert; polling backs off and
  stops on `active` or on a terminal error.

## Testing

- **CC shared**: `signupSchema` accept/reject (`shared/tests`).
- **CC api** (`api/tests/handlers/signup.spec.ts`): public create →
  pending + token; claim before approval → `{status:'pending'}`, no secret;
  approve (coordinator) provisions client and flips to active; claim after
  approval returns creds once then 404/empty on second claim; token mismatch →
  403; approve on active → 409. Mock `deps.cognito`/`deps.ddb` like the existing
  sites tests.
- **CC web**: `stores/sites.spec.ts` `approve()`; SitesView pending-section
  render/approve (mirror existing store/view specs).
- **Node network-api**: unit-test the signup passthrough + cred-store
  read/write with a mocked SQL/crypto + fetch (mirror existing function tests
  where present); assert the machine path prefers the stored row over env.
- **Node plugin**: `useNetworkStore`/signup store unit tests (mocked
  `ApiClient`); RegisterSiteView state transitions; reuse the e2e mount smoke.

## Scope / decomposition

Two cohesive phases with a clean contract (the CC `/signup`, `/signup/{siteId}`,
`/sites/{siteId}/approve`). They will be **two implementation plans**:

1. **Coordination center** (`central/shared` + `central/api` + `central/web`):
   signup/claim/approve endpoints, pending status, coordinator approval UI.
   Independently testable against the CC test suite.
2. **Node** (`plugins/network-api` + `plugins/network`): unauth signup
   passthrough, runtime cred store + migration, register view + polling.
   Depends only on the Phase-1 contract; can be tested with a mocked CC.

Build Phase 1 first (node depends on its contract).

## Out of scope (YAGNI)

- Rate-limiting/captcha/email-verification on public `POST /signup` (note as
  hardening follow-up).
- KMS/TTL for the transient `pendingSecret`.
- Editing/rotating an already-active node's creds from the node UI (the CC
  already has `rotate-secret`).
- Multi-site nodes (the node store is single-row by design).
