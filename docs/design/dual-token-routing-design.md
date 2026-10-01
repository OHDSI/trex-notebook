# Dual-token routing for notebook-plugin (WebAPI vs graphql)

**Status:** Draft
**Date:** 2026-10-01
**Branch:** SantanM/internal-3235_strategus-builder-hades-alignment

## Problem

`rD2E`'s calls to `/WebAPI/cohortdefinition/*` fail because the Authorization
header carries the Supabase/trex-native (HS256) token instead of the RS256
OIDC token `/WebAPI/*` requires.

## Root cause

`plugins/notebook-plugin/src/api/authToken.ts` already tracks two tokens:

- `token` — the original RS256 OIDC token the host passes in via
  `setAuthToken()` (from `authContext.token` on plugin mount).
- `trexToken` — an HS256 trex-native token obtained by exchanging `token` at
  `POST /trex-token`, cached and refreshed within 30s of expiry
  (`ensureAuthToken()`).

`getAuthToken()` returns `trexToken ?? token` and is the only function
`NotebookEditorView.vue`'s `buildKernelConfigs()` calls to populate rD2E's
`TREX__AUTHORIZATION_TOKEN` env var. Once any `/trex/graphql` call has run
`ensureAuthToken()` and cached a `trexToken`, every later caller — including
the WebAPI/rD2E path — silently receives the HS256 token instead.

`authHeaders()` (used only by `graphqlClient.ts`, for `/trex/graphql`) already
does the correct thing for its endpoint: `trexToken ?? token`, exchanging
when needed. The bug is isolated to `getAuthToken()`'s *use*, not to the
exchange logic.

### Why the two endpoints need different tokens

(Verified directly against `trex` core, commit `91435b1010fefc87271b1054dde2e4cdc102abb9`.)

- `/WebAPI/*` is proxied by `core/server/d2e-compat/routes.ts` and gated by
  `logtoAuthn` (`core/server/d2e-compat/auth.ts`), which verifies against a
  remote JWKS (`jose`'s `jwtVerify`) with `ACCEPTED_ALGS` pinned to
  asymmetric algorithms only (RS256/RS384/RS512, PS256/PS384/PS512,
  ES256/ES384/ES512, EdDSA) — HS256 is explicitly excluded to close the
  algorithm-confusion bypass class. An HS256 token is rejected before any
  claim is even checked.
- `/trex/graphql` is gated by `authContext` → `verifyAccessToken()`
  (`core/server/auth/jwt.ts`), which does a raw HMAC-SHA256 check
  (`hmacVerify`) against a secret HKDF-derived from `TREX_ROOT_KEY`
  (label `trex.jwt.hs256.v1`). There is no JWKS/OIDC involvement at all; an
  RS256 token has no valid signature under this scheme.

These are two structurally incompatible verifiers by design — no single
token satisfies both.

## Fix

In `plugins/notebook-plugin/src/api/authToken.ts`:

- Rename `getAuthToken()` → `getWebApiToken()`; change its body to return
  `token` only (never `trexToken`), so `/WebAPI/*` always gets the original,
  un-exchanged RS256 OIDC token.
- Leave `authHeaders()` / `ensureAuthToken()` unchanged — they already
  compute `trexToken ?? token` correctly for `/trex/graphql`.
- Update the module header comment to state the split explicitly.

In `plugins/notebook-plugin/src/views/NotebookEditorView.vue`:

- `buildKernelConfigs()`: change the import/call from `getAuthToken()` to
  `getWebApiToken()`.
- Drop the `await ensureAuthToken()` call from `buildKernelConfigs()` — it
  only matters for populating `trexToken`, which this path no longer
  consumes, so keeping it would just add a pointless `/trex-token` round
  trip before every kernel launch.

No other call site uses `getAuthToken()` (confirmed via repo-wide grep).

## Testing

Extend `plugins/notebook-plugin/tests/authToken.spec.ts` (currently 2 cases,
covers only `authHeaders()`'s no-token/with-token paths):

- `getWebApiToken()` returns the raw token unchanged even after
  `ensureAuthToken()`/`authHeaders()` has triggered an exchange (never picks
  up `trexToken`).
- `getWebApiToken()` returns `null` when no token is set.
- `authHeaders()`/`ensureAuthToken()` exchanges an RS256-shaped token (no
  `aud: "authenticated"`) via a mocked `fetch` to `/trex-token`, and sends
  the exchanged value.
- `authHeaders()` skips the exchange and sends the original token unchanged
  when its payload already has `aud: "authenticated"`.
- Exchange failure (mocked non-ok response): `authHeaders()` falls back to
  the original token rather than throwing.

No Vue component test is added for `NotebookEditorView.vue` — there is no
existing component-test precedent for any `.vue` file in this plugin (only
`api/`, `store/`, `kernels/` are covered), and the wiring change there is
trivial plumbing (pass a string into `envVars`) with no branching logic of
its own; standing up component-test infra for this one change would be
disproportionate. The wiring is reviewed by diff instead.

## Out of scope: stale-token-on-long-session gap (follow-up)

Investigating kernel lifecycle (`plugins/notebook/src/hooks/useKernel.ts`,
`plugins/notebook/src/kernels/webr/WebRKernel.ts`) surfaced a separate,
pre-existing bug: `useKernel`'s `connectAllConfigured()` connects each
kernel exactly once (guarded by a `multiKernelInit` flag) and
`WebRKernel.connect()` bakes `envVars` into the R process via `Sys.setenv()`
only at that one connect call. There is no live-refresh path — if a notebook
editing session outlives the RS256 token's `exp`, rD2E's WebAPI calls will
start failing again, independent of this fix. `switchKernel()` also replays
the same stale `kernelConfigs` entry captured at setup.

This is not caused by, or fixed by, the change above, and fixing it properly
is materially bigger (either the WebR kernel needs a way to re-apply
`envVars` after reconnect, or rD2E needs to fetch the token live via
`webr::eval_js()` at call-time instead of `Sys.getenv()`). Captured as a
follow-up — see `docs/follow-ups/stale-token-on-long-webr-session.md`.

## Docs / knowledge-base updates

- `authToken.ts` module header comment (above).
- `$D2E_REPO_PATH/d2e-skill/knowledge-base/decisions/d2e-plugin-auth-architecture.md`:
  add a section reconciling its `TRUSTED_PLUGIN_SCOPES` plugin-function-gate
  table (which does not describe `/WebAPI/*` or `/trex/graphql`) with the
  dedicated core-gateway middlewares (`logtoAuthn`, `authContext`) those two
  routes actually use, and record the `getWebApiToken()`/`authHeaders()`
  split in notebook-plugin's `authToken.ts` as a sibling fix to the existing
  `resultsApi.ts` pattern documented there.
- New follow-up file: `docs/follow-ups/stale-token-on-long-webr-session.md`.
