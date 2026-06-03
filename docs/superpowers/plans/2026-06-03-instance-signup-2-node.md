# Instance Signup — Plan 2: Node (network-api + network plugin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a node operator self-register the instance from the network plugin: submit name+contact, see "pending", and once the coordinator approves, the node auto-fetches and stores its machine credentials so the existing proxy goes live — all relayed through the local `network-api` function.

**Architecture:** `network-api` gains an unauthenticated (to-central) `/signup` passthrough and a single-row runtime credential store (`network.site_credential` in `_config` Postgres, reached via `Trex.databaseManager()`), with the machine secret AES-encrypted at rest. The machine-token path reads creds from that store first, falling back to env. The network plugin gets a "Register this site" view + a signup store that polls status.

**Tech Stack:** Deno edge function (trex EdgeRuntime), Postgres `_config` via DuckDB attach, AES-256-GCM, Vue 3 + Vuetify + Pinia, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-instance-signup-design.md`
**Depends on:** Plan 1 contract — `POST {CENTRAL}/signup → {siteId, claimToken}`, `GET {CENTRAL}/signup/{siteId}` (header `X-Signup-Token`) → `{status}` or `{status:'active', cognitoClientId, clientSecret}`.

---

## File Structure

- Create: `plugins/network-api/functions/crypto.ts` — AES helpers (copy of metadata-api).
- Create: `plugins/network-api/functions/crypto.test.ts` — copy of metadata-api crypto test.
- Create: `plugins/network-api/functions/sql.ts` — DuckDB→`_config` transport (copy of metadata-api).
- Create: `plugins/network-api/functions/store.ts` — `network.site_credential` read/write.
- Modify: `plugins/network-api/functions/index.ts` — signup passthrough + store-backed machine creds.
- Create: `plugins/network-api/migrations/V1__network_signup.sql` — the credential table.
- Modify: `plugins/network-api/package.json` — `trex.migrations` + `NETWORK_ENC_KEY` env.
- Create: `plugins/network/src/store/useSignupStore.ts` — signup/poll/state.
- Test: `plugins/network/tests/store/signup.spec.ts`.
- Create: `plugins/network/src/views/RegisterSiteView.vue`.
- Modify: `plugins/network/src/NetworkApp.vue` — surface the register view.

---

## Task 1: network-api — copy crypto + sql transport, add config

**Files:**
- Create: `plugins/network-api/functions/crypto.ts`, `plugins/network-api/functions/crypto.test.ts`, `plugins/network-api/functions/sql.ts`
- Modify: `plugins/network-api/package.json`

- [ ] **Step 1: Copy the AES + SQL helpers verbatim**

```bash
cp plugins/metadata-api/functions/crypto.ts plugins/network-api/functions/crypto.ts
cp plugins/metadata-api/functions/crypto.test.ts plugins/network-api/functions/crypto.test.ts
cp plugins/metadata-api/functions/sql.ts plugins/network-api/functions/sql.ts
```
(`crypto.ts` exports `encryptSecret(plain,keyB64)` and `decryptSecret(b64,keyB64)`; `sql.ts` exports `query(sql, params?)` and `lit(...)` over the `Trex.databaseManager()` DuckDB→`_config` connection.)

- [ ] **Step 2: Add migrations + env to `package.json`**

In `plugins/network-api/package.json`, under `trex`, add a `migrations` key and the new env var:
```json
  "trex": {
    "migrations": { "schema": "network", "database": "_config" },
    "functions": {
      "env": {
        "_shared": {
          "NETWORK_MACHINE_CLIENT_ID": "${NETWORK_MACHINE_CLIENT_ID:-}",
          "NETWORK_CLIENT_SECRET": "${NETWORK_CLIENT_SECRET:-}",
          "NETWORK_COGNITO_DOMAIN": "${NETWORK_COGNITO_DOMAIN}",
          "NETWORK_TOKEN_SCOPE": "${NETWORK_TOKEN_SCOPE:-}",
          "NETWORK_CENTRAL_API_URL": "${NETWORK_API_URL}",
          "NETWORK_ENC_KEY": "${NETWORK_ENC_KEY}"
        }
      },
      "api": [ { "source": "/network-api", "function": "/functions" } ]
    }
  }
```
(`NETWORK_MACHINE_CLIENT_ID`/`NETWORK_CLIENT_SECRET` become optional defaults — a fresh node has none until it claims creds.)

- [ ] **Step 3: Run the copied crypto test**

Run: `cd plugins/network-api && (ls node_modules >/dev/null 2>&1 || npm install) && npx vitest run functions/crypto.test.ts` 
(If network-api has no vitest configured, run the test from a workspace that has it, or add `vitest` as in metadata-api. If metadata-api runs crypto.test.ts via `deno test`, use that runner instead: `deno test functions/crypto.test.ts`.)
Expected: crypto round-trip tests PASS.

- [ ] **Step 4: Validate package.json**

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/network-api/package.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 5: Commit**
```bash
git add plugins/network-api/functions/crypto.ts plugins/network-api/functions/crypto.test.ts plugins/network-api/functions/sql.ts plugins/network-api/package.json
git commit -m "feat(network-api): add AES + _config SQL transport and signup config"
```

---

## Task 2: network-api — credential-store migration

**Files:**
- Create: `plugins/network-api/migrations/V1__network_signup.sql`

- [ ] **Step 1: Write the migration**

Create `plugins/network-api/migrations/V1__network_signup.sql`:
```sql
-- Single-row store for this node's site identity + machine credentials.
-- A node is exactly one site, so the table is pinned to id = 1.
CREATE SCHEMA IF NOT EXISTS network;

CREATE TABLE IF NOT EXISTS network.site_credential (
    id                INT PRIMARY KEY DEFAULT 1,
    site_id           TEXT,
    claim_token       TEXT,
    cognito_client_id TEXT,
    client_secret_enc TEXT,            -- base64(AES-GCM(iv ++ ct ++ tag)); never plaintext
    status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active'
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT site_credential_singleton CHECK (id = 1)
);
```

- [ ] **Step 2: Sanity check**

Run: `cat plugins/network-api/migrations/V1__network_signup.sql`
Expected: prints; mirrors metadata-api's migration conventions (schema + idempotent CREATE).
> NOTE: not auto-applied — applied by the trex migration run / redeploy (same as `metadata-api`'s V1/V2).

- [ ] **Step 3: Commit**
```bash
git add plugins/network-api/migrations/V1__network_signup.sql
git commit -m "feat(network-api): add network.site_credential migration"
```

---

## Task 3: network-api — store module

**Files:**
- Create: `plugins/network-api/functions/store.ts`

- [ ] **Step 1: Implement the store**

Create `plugins/network-api/functions/store.ts`:
```ts
// @ts-nocheck - Deno edge function (trex EdgeRuntime)
// Single-row (id=1) read/write of network.site_credential via the _config attach.
import { query, lit } from "./sql.ts";
import { encryptSecret, decryptSecret } from "./crypto.ts";

const ENC_KEY = (Deno.env.get("NETWORK_ENC_KEY") ?? "").trim();

export interface StoredCred {
  siteId: string | null;
  claimToken: string | null;
  cognitoClientId: string | null;
  status: string;            // 'pending' | 'active'
}

export async function readRow(): Promise<StoredCred | null> {
  const { rows } = await query(
    `SELECT site_id, claim_token, cognito_client_id, status FROM _config.network.site_credential WHERE id = 1`,
  );
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    siteId: (r.site_id as string) ?? null,
    claimToken: (r.claim_token as string) ?? null,
    cognitoClientId: (r.cognito_client_id as string) ?? null,
    status: (r.status as string) ?? "pending",
  };
}

export async function savePending(siteId: string, claimToken: string): Promise<void> {
  await query(
    `INSERT INTO _config.network.site_credential (id, site_id, claim_token, status, updated_at)
     VALUES (1, ${lit(siteId)}, ${lit(claimToken)}, 'pending', now())
     ON CONFLICT (id) DO UPDATE SET site_id = EXCLUDED.site_id,
       claim_token = EXCLUDED.claim_token, status = 'pending', updated_at = now()`,
  );
}

export async function saveActive(cognitoClientId: string, clientSecret: string): Promise<void> {
  const enc = await encryptSecret(clientSecret, ENC_KEY);
  await query(
    `UPDATE _config.network.site_credential
     SET cognito_client_id = ${lit(cognitoClientId)}, client_secret_enc = ${lit(enc)},
         status = 'active', updated_at = now() WHERE id = 1`,
  );
}

// Returns decrypted machine creds if an active row exists, else null.
export async function readMachineCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  const { rows } = await query(
    `SELECT cognito_client_id, client_secret_enc, status FROM _config.network.site_credential WHERE id = 1`,
  );
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  if (r.status !== "active" || !r.cognito_client_id || !r.client_secret_enc) return null;
  const clientSecret = await decryptSecret(String(r.client_secret_enc), ENC_KEY);
  return { clientId: String(r.cognito_client_id), clientSecret };
}
```

- [ ] **Step 2: Type/lint sanity (best-effort, @ts-nocheck Deno file)**

Run: `node -e "require('fs').readFileSync('plugins/network-api/functions/store.ts','utf8').length>0 && console.log('present')"`
Expected: `present`. (The file is a Deno worker module — `@ts-nocheck`, like `index.ts`/`sql.ts`; it is exercised at runtime / in Task 7's manual verification, not by tsc here.)

- [ ] **Step 3: Commit**
```bash
git add plugins/network-api/functions/store.ts
git commit -m "feat(network-api): single-row site_credential store (encrypted secret)"
```

---

## Task 4: network-api — signup passthrough + store-backed machine creds

**Files:**
- Modify: `plugins/network-api/functions/index.ts`

- [ ] **Step 1: Reorder gates and add signup routes**

Edit `plugins/network-api/functions/index.ts`. Replace the body of `Deno.serve(async (req) => { ... })` so the order is: **(1)** auth gate (`x-user-id`) first; **(2)** signup routes (need only `NETWORK_CENTRAL_API_URL` + `NETWORK_ENC_KEY`); **(3)** the existing machine config gate + proxy for everything else. Add imports at the top:
```ts
import { readRow, savePending, saveActive, readMachineCreds } from "./store.ts";
```
Insert this signup-handling block immediately after computing `subPath` (and after the `x-user-id` check, which must run before the machine-config gate now):
```ts
  // --- self-signup relay (no machine creds required for a fresh node) ---------
  if (subPath === "/signup" && req.method === "POST") {
    const base = env("NETWORK_CENTRAL_API_URL").replace(/\/+$/, "");
    if (!base) return json(503, "NOT_CONFIGURED", "NETWORK_CENTRAL_API_URL unset");
    let up: Response;
    try {
      up = await fetch(`${base}/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await req.arrayBuffer(),
      });
    } catch (_e) {
      return json(502, "UPSTREAM_UNREACHABLE", "central signup failed");
    }
    if (!up.ok) return new Response(up.body, { status: up.status, headers: { "content-type": "application/json" } });
    const data = await up.json(); // { siteId, claimToken }
    await savePending(String(data.siteId), String(data.claimToken));
    return json(200, "OK", "pending") /* replaced below */ ;
  }
  if (subPath === "/signup/state" && req.method === "GET") {
    const row = await readRow().catch(() => null);
    return new Response(JSON.stringify({ registered: row?.status === "active", status: row?.status ?? "none" }),
      { status: 200, headers: { "content-type": "application/json" } });
  }
  if (subPath === "/signup/status" && req.method === "GET") {
    const row = await readRow().catch(() => null);
    if (!row?.siteId) return new Response(JSON.stringify({ status: "none" }), { status: 200, headers: { "content-type": "application/json" } });
    if (row.status === "active") return new Response(JSON.stringify({ status: "active" }), { status: 200, headers: { "content-type": "application/json" } });
    const base = env("NETWORK_CENTRAL_API_URL").replace(/\/+$/, "");
    let up: Response;
    try {
      up = await fetch(`${base}/signup/${encodeURIComponent(row.siteId)}`, { headers: { "x-signup-token": row.claimToken ?? "" } });
    } catch (_e) {
      return json(502, "UPSTREAM_UNREACHABLE", "central status failed");
    }
    if (!up.ok) return new Response(up.body, { status: up.status, headers: { "content-type": "application/json" } });
    const data = await up.json();
    if (data.status === "active" && data.clientSecret) {
      await saveActive(String(data.cognitoClientId), String(data.clientSecret));
      return new Response(JSON.stringify({ status: "active" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ status: data.status ?? "pending" }), { status: 200, headers: { "content-type": "application/json" } });
  }
```
Fix the POST `/signup` success return (replace the placeholder line above) with:
```ts
    return new Response(JSON.stringify({ siteId: data.siteId, status: "pending" }),
      { status: 200, headers: { "content-type": "application/json" } });
```

- [ ] **Step 2: Source machine creds from the store, then env**

In `getMachineToken()`, before reading `clientId`/`clientSecret` from env, prefer the stored row:
```ts
  const stored = await readMachineCreds().catch(() => null);
  const clientId = stored?.clientId || env("NETWORK_MACHINE_CLIENT_ID");
  const clientSecret = stored?.clientSecret || env("NETWORK_CLIENT_SECRET");
```
(Remove the old `const clientId = env(...)` / `const clientSecret = env(...)` lines.)

- [ ] **Step 3: Update the config gate so signup works without machine creds**

The existing top-of-handler loop requires all four `NETWORK_*` machine vars. Move it so it runs **only for non-signup paths** (i.e., after the signup blocks return). Concretely: relocate the `for (const v of [...]) { if (!env(v)) return 503 }` gate to just before the machine-token/proxy section, and there require `NETWORK_COGNITO_DOMAIN` + `NETWORK_CENTRAL_API_URL` always, but treat the machine client id/secret as satisfied when **either** env is set **or** an active stored row exists:
```ts
  for (const v of ["NETWORK_COGNITO_DOMAIN", "NETWORK_CENTRAL_API_URL"]) {
    if (!env(v)) return json(503, "NOT_CONFIGURED", `network-api is not configured (${v} unset)`);
  }
  const haveStored = (await readMachineCreds().catch(() => null)) !== null;
  if (!haveStored && (!env("NETWORK_MACHINE_CLIENT_ID") || !env("NETWORK_CLIENT_SECRET"))) {
    return json(503, "NOT_REGISTERED", "site has no machine credentials yet — sign up first");
  }
```
Keep the `x-user-id` auth gate ABOVE the signup blocks so signup also requires a trex session.

- [ ] **Step 4: Manual smoke is in Task 7** (the Deno worker isn't unit-tested here, consistent with the existing `network-api`).

- [ ] **Step 5: Commit**
```bash
git add plugins/network-api/functions/index.ts
git commit -m "feat(network-api): signup passthrough + store-backed machine credentials"
```

---

## Task 5: network plugin — signup store (TDD)

**Files:**
- Create: `plugins/network/src/store/useSignupStore.ts`
- Test: `plugins/network/tests/store/signup.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `plugins/network/tests/store/signup.spec.ts` (mirror the existing network store specs' mocked-`ApiClient` style):
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSignupStore } from '../../src/store/useSignupStore';

function fakeApi(handlers: Record<string, unknown>) {
  return {
    get: async (p: string) => handlers[`GET ${p}`],
    post: async (p: string, body?: unknown) => { (handlers as any).lastPost = { p, body }; return handlers[`POST ${p}`]; },
  } as any;
}

describe('useSignupStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('signup() posts name+contact and goes pending', async () => {
    const api = fakeApi({ 'POST /signup': { siteId: 's1', status: 'pending' } });
    const s = useSignupStore(api);
    await s.signup({ name: 'Site A', contact: 'a@x.org' });
    expect(api.lastPost).toEqual({ p: '/signup', body: { name: 'Site A', contact: 'a@x.org' } });
    expect(s.status.value).toBe('pending');
  });

  it('refreshState() reads /signup/state', async () => {
    const api = fakeApi({ 'GET /signup/state': { registered: true, status: 'active' } });
    const s = useSignupStore(api);
    await s.refreshState();
    expect(s.status.value).toBe('active');
  });

  it('poll() flips to active when status returns active', async () => {
    const api = fakeApi({ 'GET /signup/status': { status: 'active' } });
    const s = useSignupStore(api);
    await s.poll();
    expect(s.status.value).toBe('active');
  });
});
```

- [ ] **Step 2: Run it (fails — no module)**

Run: `cd plugins/network && npx vitest run tests/store/signup.spec.ts`
Expected: FAIL — cannot resolve `useSignupStore`.

- [ ] **Step 3: Implement the store**

Create `plugins/network/src/store/useSignupStore.ts`:
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { loadConfig } from '../config';
import { ApiClient } from '../api/client';

export type SignupState = 'none' | 'pending' | 'active';

function defaultClient(): ApiClient {
  return new ApiClient(loadConfig().proxyUrl, () => null);
}

export const useSignupStore = (apiClient?: ApiClient) =>
  defineStore('signup', () => {
    const api = apiClient ?? defaultClient();
    const status = ref<SignupState>('none');
    const error = ref<string | null>(null);

    async function refreshState(): Promise<void> {
      try {
        const r = await api.get<{ status: SignupState }>('/signup/state');
        status.value = r.status ?? 'none';
        error.value = null;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      }
    }

    async function signup(body: { name: string; contact: string }): Promise<void> {
      try {
        const r = await api.post<{ status: SignupState }>('/signup', body);
        status.value = r.status ?? 'pending';
        error.value = null;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        throw e;
      }
    }

    async function poll(): Promise<void> {
      try {
        const r = await api.get<{ status: SignupState }>('/signup/status');
        status.value = r.status ?? status.value;
        error.value = null;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      }
    }

    return { status, error, refreshState, signup, poll };
  })();
```

- [ ] **Step 4: Run it (passes)**

Run: `cd plugins/network && npx vitest run tests/store/signup.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add plugins/network/src/store/useSignupStore.ts plugins/network/tests/store/signup.spec.ts
git commit -m "feat(network): signup store (request, state, poll)"
```

---

## Task 6: network plugin — Register view + nav

**Files:**
- Create: `plugins/network/src/views/RegisterSiteView.vue`
- Modify: `plugins/network/src/NetworkApp.vue`

- [ ] **Step 1: Create the view**

Create `plugins/network/src/views/RegisterSiteView.vue`:
```vue
<template>
  <div class="register-site">
    <v-alert v-if="store.error.value" type="error" class="mb-3">{{ store.error.value }}</v-alert>

    <template v-if="store.status.value === 'active'">
      <v-alert type="success" variant="tonal">This site is registered and connected to the network.</v-alert>
    </template>

    <template v-else-if="store.status.value === 'pending'">
      <v-alert type="info" variant="tonal" class="mb-3">
        Registration request submitted. Awaiting coordinator approval…
      </v-alert>
      <v-btn :loading="busy" @click="checkNow">Check now</v-btn>
    </template>

    <template v-else>
      <h2 class="text-h6 mb-3">Register this site</h2>
      <v-text-field v-model="name" label="Site name" :disabled="busy" />
      <v-text-field v-model="contact" label="Contact email" :disabled="busy" />
      <v-btn color="primary" :loading="busy" :disabled="!name || !contact" @click="submit">Request registration</v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSignupStore } from '../store/useSignupStore';

const store = useSignupStore();
const name = ref('');
const contact = ref('');
const busy = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

async function submit(): Promise<void> {
  busy.value = true;
  try { await store.signup({ name: name.value, contact: contact.value }); } finally { busy.value = false; }
  startPolling();
}

async function checkNow(): Promise<void> {
  busy.value = true;
  try { await store.poll(); } finally { busy.value = false; }
}

function startPolling(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (store.status.value === 'pending') void store.poll();
    else stopPolling();
  }, 5000);
}
function stopPolling(): void { if (timer) { clearInterval(timer); timer = null; } }

onMounted(async () => {
  await store.refreshState();
  if (store.status.value === 'pending') startPolling();
});
onUnmounted(stopPolling);
</script>

<style scoped>
.register-site { max-width: 520px; }
</style>
```

- [ ] **Step 2: Surface it in `NetworkApp.vue`**

In `plugins/network/src/NetworkApp.vue`, add `RegisterSiteView` as a tab/section (mirror however `NetworkApp.vue` switches between its existing views — e.g. add a "Register" tab, and select it by default when the site isn't active). Minimal change: import the view, add a nav entry labelled "Register site", and render it. Read the file first to match its existing tab pattern; add:
```ts
import RegisterSiteView from './views/RegisterSiteView.vue';
```
and a corresponding nav item + `<RegisterSiteView v-if="tab === 'register'" />` branch consistent with the file's structure.

- [ ] **Step 3: Type-check + tests + build**

Run: `cd plugins/network && npx vue-tsc --noEmit && npx vitest run && npm run build`
Expected: clean; tests pass; build writes `../sibyl/public/plugins/network-plugin/index.system.js`.

- [ ] **Step 4: Commit**
```bash
git add plugins/network/src/views/RegisterSiteView.vue plugins/network/src/NetworkApp.vue
git commit -m "feat(network): Register-this-site view with status polling"
```

---

## Task 7: Phase-2 verification

- [ ] **Step 1: Node unit gates**

Run:
```
cd plugins/network && npx vue-tsc --noEmit && npx vitest run && npm run build
cd ../network-api && npx vitest run functions/crypto.test.ts   # (or deno test)
```
Expected: network plugin green + bundle emitted; crypto round-trips pass.

- [ ] **Step 2: Manual end-to-end (needs the running stack + Plan 1 deployed to the CC)**

After applying `network-api`'s migration and deploying the CC with Plan 1:
1. Open the network plugin → **Register site**, submit name+contact → expect "pending".
2. In `central/web` → Sites → Pending → **Approve**.
3. Back in the node, within ~5s (or "Check now") → expect "registered and connected".
4. Confirm a normal network call (e.g. list studies) now succeeds (machine token minted from the stored creds).
Capture any error envelope and diagnose.

---

## Self-Review Notes

- **Spec coverage:** crypto+sql transport & config (Task 1); credential table (Task 2); store read/write w/ encryption (Task 3); unauth `/signup` + `/signup/status` + `/signup/state` passthrough and store-backed machine creds + `NOT_REGISTERED` gate (Task 4); signup store (Task 5); Register view + polling + nav (Task 6). All Phase-2 spec items map to a task.
- **Placeholder scan:** the only "replaced below" marker in Task 4 Step 1 is explicitly corrected in the same step's final code block (the POST `/signup` success return) — no unresolved placeholders remain.
- **Type consistency:** `SignupState` (`'none'|'pending'|'active'`) and the `/signup`, `/signup/status`, `/signup/state` paths match between `useSignupStore`, the view, and the `network-api` handlers; `readMachineCreds()` is used identically in `getMachineToken` and the config gate; the CC claim shape `{status, cognitoClientId, clientSecret}` consumed in Task 4 matches Plan 1's `claimSignup` output.
- **Known constraint:** the `network-api` Deno worker (`index.ts`, `store.ts`) is verified via the Task 7 manual smoke, not unit tests — consistent with the existing plugin, which ships no function unit tests.
