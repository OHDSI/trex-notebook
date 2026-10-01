# Dual-token routing for notebook-plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development
> (this project's local variant) to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Tests run at milestone/final
> checkpoints, not per task.

**Goal:** Stop rD2E's `/WebAPI/*` calls from receiving the HS256 trex-native
token — they must always get the original, un-exchanged RS256 OIDC token,
while `/trex/graphql` keeps using the exchanged HS256 token.

**Architecture:** `authToken.ts` already tracks both tokens (`token` = raw
RS256 OIDC, `trexToken` = exchanged HS256 trex-native). The fix is a narrow
API split: a new `getWebApiToken()` that only ever returns `token`, versus
the existing `authHeaders()`/`ensureAuthToken()` which keep resolving
`trexToken ?? token` for `/trex/graphql`. `NotebookEditorView.vue` switches
its rD2E wiring to the new function.

**Tech Stack:** TypeScript, Vue 3, Vitest (`happy-dom` environment).

## Global Constraints

- No new dependencies.
- `authHeaders()` / `ensureAuthToken()` behavior for `/trex/graphql` must not
  change (same exchange logic, same cache/expiry behavior).
- No Vue component test is introduced (see design doc — no existing
  precedent for `.vue` component tests in this plugin; the wiring change has
  no branching logic of its own).
- `docs/` in this repo is gitignored; `git add -f` is required to commit
  anything under `docs/` (matches the existing tracked
  `docs/follow-ups/cohortmethod-spec-class-names.md`).
- Design doc for this work: `docs/design/dual-token-routing-design.md`
  (already committed).

---

### Task 1: Split `getWebApiToken()` out of `authToken.ts`

**Files:**
- Modify: `plugins/notebook-plugin/src/api/authToken.ts`
- Test: `plugins/notebook-plugin/tests/authToken.spec.ts`

**Interfaces:**
- Consumes: nothing new (internal `token`/`trexToken`/`exchange` state
  already exists).
- Produces: `export function getWebApiToken(): string | null` — new export,
  consumed by Task 2. `getAuthToken()` is removed (no other call site uses
  it, confirmed via repo-wide grep).

**Implementation:**

Replace the full contents of `plugins/notebook-plugin/src/api/authToken.ts`
with:

```ts
// Shared auth tokens for backend calls. Set by main.ts from the host's
// authContext on mount.
//
// Two backend auth paths need two different token shapes:
//  - /WebAPI/* (rD2E, via getWebApiToken()) is gated by trex core's
//    RS256/JWKS-only middleware — it must receive the original, un-exchanged
//    OIDC access token the host handed in.
//  - /trex/graphql (via authHeaders()/ensureAuthToken()) is gated by trex
//    core's HS256-only middleware — an RS256 OIDC token is exchanged via the
//    /trex-token function for a trex-native token before it is sent. Tokens
//    that already carry aud "authenticated" are trex-native and are sent
//    unchanged.
let token: string | null = null;
let trexToken: string | null = null;
let exchange: Promise<string | null> | null = null;

export function setAuthToken(t: string | null): void {
  token = t;
  trexToken = null;
  exchange = null;
}

function jwtPayload(t: string): Record<string, unknown> | null {
  try {
    const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function expiresSoon(t: string): boolean {
  const exp = jwtPayload(t)?.exp;
  return typeof exp === 'number' && exp * 1000 < Date.now() + 30_000;
}

async function exchangeToken(t: string): Promise<string | null> {
  try {
    const resp = await fetch(`${location.origin}/trex-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    return typeof body.access_token === 'string' ? body.access_token : null;
  } catch {
    return null;
  }
}

/** Resolve the token authHeaders() will send; await before any /trex/graphql request. */
export async function ensureAuthToken(): Promise<void> {
  if (!token) return;
  const payload = jwtPayload(token);
  if (!payload || payload.aud === 'authenticated') return;
  if (trexToken && !expiresSoon(trexToken)) return;
  if (!exchange) {
    exchange = exchangeToken(token).finally(() => {
      exchange = null;
    });
  }
  const p = exchange;
  trexToken = (await p) ?? trexToken;
}

/** The raw, un-exchanged token for /WebAPI/* (rD2E) calls — never the trex-native exchange token. */
export function getWebApiToken(): string | null {
  return token;
}

export function authHeaders(): Record<string, string> {
  const t = trexToken ?? token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}
```

Replace the full contents of
`plugins/notebook-plugin/tests/authToken.spec.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAuthToken, authHeaders, ensureAuthToken, getWebApiToken } from '../src/api/authToken';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload));
  return `header.${b64}.sig`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;

describe('authToken', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it('returns no Authorization header when unset', () => {
    expect(authHeaders()).toEqual({});
  });

  it('returns a Bearer header when set', () => {
    setAuthToken('abc123');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc123' });
  });

  it('getWebApiToken returns null when no token is set', () => {
    expect(getWebApiToken()).toBeNull();
  });

  it('getWebApiToken returns the raw token unchanged, even after an exchange has run', async () => {
    const rs256 = fakeJwt({ aud: 'https://alp-default', exp: future() });
    setAuthToken(rs256);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: fakeJwt({ aud: 'authenticated', exp: future() }) }),
    }));
    await ensureAuthToken();
    expect(getWebApiToken()).toBe(rs256);
    expect(authHeaders().Authorization).not.toBe(`Bearer ${rs256}`);
  });

  it('exchanges an RS256-shaped token for a trex-native one via /trex-token', async () => {
    const rs256 = fakeJwt({ aud: 'https://alp-default', exp: future() });
    const exchanged = fakeJwt({ aud: 'authenticated', exp: future() });
    setAuthToken(rs256);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: exchanged }) });
    vi.stubGlobal('fetch', fetchMock);
    await ensureAuthToken();
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${exchanged}` });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/trex-token$/);
    expect(init).toMatchObject({ method: 'POST', headers: { Authorization: `Bearer ${rs256}` } });
  });

  it('skips the exchange when the token already carries aud "authenticated"', async () => {
    const trexNative = fakeJwt({ aud: 'authenticated', exp: future() });
    setAuthToken(trexNative);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await ensureAuthToken();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${trexNative}` });
  });

  it('falls back to the original token when the exchange fails', async () => {
    const rs256 = fakeJwt({ aud: 'https://alp-default', exp: future() });
    setAuthToken(rs256);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await ensureAuthToken();
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${rs256}` });
  });
});
```

**Verify:** `npm --prefix plugins/notebook-plugin test -- tests/authToken.spec.ts` — expected: all 8 cases pass.

**Commit:** `git commit -m "Fix: split getWebApiToken() from the /trex/graphql exchange path"`

---

### Task 2: Wire `NotebookEditorView.vue` to `getWebApiToken()`

**Files:**
- Modify: `plugins/notebook-plugin/src/views/NotebookEditorView.vue`

**Interfaces:**
- Consumes: `getWebApiToken()` from Task 1 (`../api/authToken`).
- Produces: nothing new — `buildKernelConfigs()`'s return shape
  (`KernelConfig[]`) is unchanged.

**Implementation:**

In `plugins/notebook-plugin/src/views/NotebookEditorView.vue`, change the
import (line 60):

```ts
import { getWebApiToken } from "../api/authToken";
```

(replacing `import { ensureAuthToken, getAuthToken } from "../api/authToken";`)

And change `buildKernelConfigs()` (lines 71-84) to:

```ts
async function buildKernelConfigs(): Promise<KernelConfig[]> {
  const token = getWebApiToken() ?? '';
  return [
    { type: 'pyodide' },
    {
      type: 'webr',
      envVars: {
        TREX__ENDPOINT_URL: window.location.origin,
        TREX__AUTHORIZATION_TOKEN: token,
      },
    },
  ];
}
```

(dropping the `await ensureAuthToken();` line — it only populates
`trexToken`, which this path no longer reads).

**Verify:** `npm --prefix plugins/notebook-plugin run build` — expected: TypeScript compiles cleanly (no unused-import or missing-export errors from the `authToken.ts` rename).

**Commit:** `git commit -m "Fix: feed rD2E the raw WebAPI token instead of the graphql exchange token"`

---

### Task 3: Reconcile the auth-architecture knowledge-base entry

**Files:**
- Modify: `/Users/santanmaddi/repos/d2e-dev-santan/d2e-skill/knowledge-base/decisions/d2e-plugin-auth-architecture.md`

**Interfaces:** None (documentation only).

**Implementation:**

Add a new section after the existing `## Decision: resultsApi.ts reads
localStorage directly` section (before `## Where it applies`), and extend
the `related` frontmatter list:

Add to the `related:` frontmatter array:
```yaml
  - plugins/notebook-plugin/src/api/authToken.ts
  - plugins/notebook-plugin/src/views/NotebookEditorView.vue
  - trex/core/server/d2e-compat/routes.ts
  - trex/core/server/auth/jwt.ts
```

Insert this new section:

```markdown
## Decision: notebook-plugin's authToken.ts splits getWebApiToken() from authHeaders()

The `TRUSTED_PLUGIN_SCOPES` table above describes the generic
plugin-function gateway (`trex/core/server/plugin/function.ts`). It does
**not** describe `/WebAPI/*` or `/trex/graphql` — those are core-gateway
routes mounted directly in `trex/core/server/index.ts`, each with its own
dedicated middleware, independent of plugin npm scope:

- `/WebAPI/*` is proxied by `core/server/d2e-compat/routes.ts` and gated by
  `logtoAuthn` (`core/server/d2e-compat/auth.ts`) — RS256/JWKS verification
  only; `ACCEPTED_ALGS` explicitly excludes HS256.
- `/trex/graphql` is gated by `authContext` → `verifyAccessToken()`
  (`core/server/auth/jwt.ts`) — HMAC-SHA256 verification against a secret
  HKDF-derived from `TREX_ROOT_KEY`; no JWKS/OIDC involved.

`@trex/notebook`'s own `plugins/notebook-plugin/src/api/authToken.ts` hits
both of these from the same module and needs both token shapes
simultaneously (unlike `studies-plugin`'s `authToken.ts`, which only needed
the HS256 path, with `resultsApi.ts` handling the RS256 case separately via
`localStorage['bearerToken']`). The fix mirrors the same principle as the
`resultsApi.ts` decision above — keep the two token lifetimes distinct
instead of collapsing them into one "current token" getter:

- `getWebApiToken()` always returns the raw, un-exchanged OIDC token —
  consumed by `NotebookEditorView.vue` to feed rD2E's
  `TREX__AUTHORIZATION_TOKEN` env var for `/WebAPI/*` calls.
- `authHeaders()` / `ensureAuthToken()` keep resolving `trexToken ?? token`
  — consumed by `graphqlClient.ts` for `/trex/graphql`.

The earlier bug: a single `getAuthToken()` returned `trexToken ?? token`,
so once any `/trex/graphql` call triggered the exchange, every later
`/WebAPI/*` call silently received the HS256 token too, which
`logtoAuthn`'s `ACCEPTED_ALGS` rejects outright.
```

**Verify:** `grep -c "getWebApiToken" /Users/santanmaddi/repos/d2e-dev-santan/d2e-skill/knowledge-base/decisions/d2e-plugin-auth-architecture.md` — expected: `3` or more (frontmatter path + 2 mentions in the new section).

**Commit:** (in `d2e-dev-santan`, not this worktree) `git commit -m "Doc: reconcile WebAPI/graphql core-gateway middleware with plugin-auth KB entry"`

---

### Task 4: Record the stale-token-on-long-session follow-up

**Files:**
- Create: `docs/follow-ups/stale-token-on-long-webr-session.md`

**Interfaces:** None (documentation only).

**Implementation:**

```markdown
# Follow-up: WebR kernel env vars (including the auth token) are never refreshed mid-session

**Status:** OPEN
**Found:** 2026-10-01, while designing the dual-token routing fix (see
`docs/design/dual-token-routing-design.md`).
**Related:** `plugins/notebook/src/hooks/useKernel.ts`,
`plugins/notebook/src/kernels/webr/WebRKernel.ts`,
`plugins/notebook-plugin/src/views/NotebookEditorView.vue`

## Summary

`useKernel.ts`'s `connectAllConfigured()` connects each configured kernel
exactly once, guarded by a `multiKernelInit` flag — it never reconnects or
re-applies `envVars` afterward. `WebRKernel.connect()` bakes `envVars`
(including `TREX__AUTHORIZATION_TOKEN`) into the R process via
`Sys.setenv()` only at that single connect call. `switchKernel()` also just
replays the same `kernelConfigs` entry captured at setup time.

There is no live-refresh path for any env var, token included. If a
notebook editing session stays open longer than the RS256 OIDC token's
`exp`, rD2E's `/WebAPI/*` calls will start failing again with an expired
token — independent of, and not fixed by, the `getWebApiToken()` /
`authHeaders()` split.

## Why this is a separate problem

Fixing it requires either:
- a way for `WebRKernel` to re-apply `envVars` into an already-connected R
  session (re-running `Sys.setenv()` live), triggered by something watching
  token expiry, or
- moving rD2E off `Sys.getenv()` entirely, having it fetch the current token
  live via `webr::eval_js()` at call time instead of reading a value baked
  in at connect time.

Both are materially bigger than a token-routing fix and deserve their own
design.

## Where it applies

- Any notebook session left open longer than the host's OIDC token lifetime.
- Both `TREX__AUTHORIZATION_TOKEN` and `TREX__ENDPOINT_URL` are affected in
  principle (only the token is expiry-sensitive today).
```

**Verify:** `test -f docs/follow-ups/stale-token-on-long-webr-session.md && echo OK` — expected: `OK`.

**Commit:** `git add -f docs/follow-ups/stale-token-on-long-webr-session.md && git commit -m "Doc: follow-up for stale WebR kernel env vars on long notebook sessions"`

---

## Milestones

- **Milestone 1 (Tasks 1-2):** code fix complete. Review + focused test run:
  `npm --prefix plugins/notebook-plugin test -- tests/authToken.spec.ts` and
  `npm --prefix plugins/notebook-plugin run build`.
- **Milestone 2 (Tasks 3-4):** docs complete. No test run (documentation
  only) — review for accuracy against the committed design doc.
- **Final:** whole-branch review (`requesting-code-review` template) +
  full suite: `npm --prefix plugins/notebook-plugin test`.
