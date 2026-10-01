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
