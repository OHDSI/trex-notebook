# sibyl as a trex UI plugin, with trex auth (Design)

Date: 2026-05-29
Status: Approved design → ready for implementation plan

## Context

sibyl (this repo) is an ATLAS-plugin host shell. The next step integrates it with
**trex** (`../trex`) — a self-hosted, Supabase-wire-compatible backend (Better Auth,
REST, GraphQL, Functions) + analytical engine, published as
`ghcr.io/p-hoffmann/trexsql:latest`. trex already serves frontend "UI plugins"
(`plugins/web`, `plugins/notebook`) via a `trex.ui.routes` field in their
`package.json`, scanned and mounted by its core server.

Goal: make sibyl a **trex UI plugin served at `/plugins/sibyl`**, using trex as the
backend and identity provider. This iteration covers **serving + auth**; wiring
backend data (`data:request` → REST/GraphQL) is deferred.

### Key trex facts (verified)

- **UI plugin mechanism:** `package.json` → `"trex": { "ui": { "routes": [{ "path": "/sibyl", "dir": "dist", "spa": true }] } }`. Served at `${PLUGINS_BASE_PATH=/plugins}${scope}${path}`; unscoped name ⇒ `/plugins/sibyl`. `spa:true` gives index.html fallback for non-asset paths. Any static SPA works (notebook is Vue).
- **Discovery/dev:** scanner reads `PLUGINS_DEV_PATH=/usr/src/plugins-dev` first; `docker-compose.dev.yml` mounts `./plugins/<n>/dist` there. A new plugin dir needs both its `package.json` (for `trex.ui`) and `dist/`.
- **Vite base:** must equal the served route (`/plugins/sibyl/`); the SPA's router base + asset paths follow it.
- **Auth (GoTrue-compatible):** endpoints under `${BASE_PATH=/trex}/auth/v1` — `POST /token?grant_type=password`, `POST /token?grant_type=refresh_token`, `GET /user`, `POST /logout`, `POST /signup`. Issues an HS256 **JWT** access token. `plugins/web` stores the session in `localStorage` and sends `Authorization: Bearer <jwt>` to REST/GraphQL. JWT claims include `sub`, `email`, `app_metadata.trex_role` ("admin"|"user"), `session_id`. User object: `{ id, email, app_metadata:{ trex_role }, user_metadata:{ name } }`.

## Decisions

- **Auth approach:** sibyl renders its **own email/password login form** calling trex's GoTrue API directly and manages its own token (storage key `sibyl.auth.session`).
- **Route:** `/plugins/sibyl` (package stays unscoped `trex-sibyl`).
- **Scope:** serve + auth. Defer backend-data wiring, OIDC client flow, npm publish, full Docker parity.
- **Run/dev:** an override compose in `deploy/` layered on trex's compose, using the **published image**, mounting sibyl's `dist` + `package.json` into `/usr/src/plugins-dev/sibyl`.
- **e2e:** mock trex's auth endpoints via `page.route` so tests run without a live trex; live-trex login is a documented manual verification.

## Architecture

### Dual-mode base path (one codebase)
`vite.config.ts`: `base: process.env.VITE_UI_BASE_PATH || '/'`. Router already uses
`createWebHistory(import.meta.env.BASE_URL)`, so the router base follows automatically.
- Standalone dev (`npm run dev`, :5174): base `/`.
- trex build (`npm run build:trex` → `VITE_UI_BASE_PATH=/plugins/sibyl/`): base `/plugins/sibyl/`. The SystemJS `%BASE_URL%vendor/...` scripts and the micro-frontend loader (`import.meta.env.BASE_URL`) resolve under the route.

### trex registration
Add `trex.ui.routes` to sibyl's `package.json` (`path:/sibyl, dir:dist, spa:true`).

### Dev proxy
`vite.config.ts` dev `server.proxy`: `'/trex' → (VITE_TREX_PROXY || 'http://localhost:8000')` so standalone dev can reach a running trex for real login.

### Auth units
- `src/services/auth/trexAuth.ts` — `login(email,password)`, `fetchUser(token)`, `refresh(refreshToken)`, `logout(token)`, session storage (`sibyl.auth.session`), `toAuthContext(session,user)`. Base URL `import.meta.env.VITE_TREX_BASE || '/trex'`. Maps GoTrue user → `AuthContext` (`user:{ id:sub, username:name||email, email, permissions:[trex_role] }`, `token`, `isAuthenticated`, `hasPermission(p)` = `trex_role==='admin' || permissions.includes(p)`).
- `src/stores/auth.ts` (Pinia) — holds session + derived `AuthContext`; `login`, `logout`, `loadFromStorage`, `isAuthenticated`. Replaces `authStub`.
- `src/views/LoginView.vue` — Vuetify email/password form with SIBYL/OHDSI chrome, error display, calls store `login`, redirects to the intended route.
- Router: add public `/login`; global `beforeEach` guard — unauthenticated ⇒ `/login`; authenticated on `/login` ⇒ home.
- `main.ts` bootstrap: load stored session; mount app; **only `initializePluginFramework(authContext)` once authenticated** (on boot if a valid session exists, and again right after login).
- `authStub.ts` removed (or retained only for unit-test fixtures); plugins still receive `authContext.token` via the loader's `getToken`.

### Run workflow
`deploy/trex-sibyl.override.yml` adds to trex's `trex` service:
```yaml
volumes:
  - ../../trex-sibyl/package.json:/usr/src/plugins-dev/sibyl/package.json:ro
  - ../../trex-sibyl/dist:/usr/src/plugins-dev/sibyl/dist:ro
```
Run from trex: `docker compose -f docker-compose.yml -f ../trex-sibyl/deploy/trex-sibyl.override.yml up`. Build sibyl first with `npm run build:trex`.

## Testing

- **Unit (Vitest):** `trexAuth` — token-response → `AuthContext` mapping; storage round-trip; `hasPermission` admin vs user; refresh request shape. `fetch` mocked.
- **e2e (Playwright):** trex auth endpoints mocked via `page.route`.
  - Unauthenticated `/` redirects to `/login`.
  - Login form submit (mocked `token` + `user`) → lands on shell, shows SIBYL brand + empty no-plugins state.
  - Fixture-mount test logs in first, then asserts the plugin mounts.

## Verification (end-to-end)

1. `npm run check-all` (type-check + unit + build) and `npm run test:e2e` pass.
2. Standalone: `npm run dev`, visit :5174 → redirected to `/login`; with a running trex reachable via the dev proxy, log in → shell renders.
3. trex-integrated (manual): `npm run build:trex`; from `../trex` run the override compose with the published image; open `http://localhost:8001/plugins/sibyl` (or 8000) → login → SIBYL shell served by trex.

## Out of scope (follow-ups)

Wire `data:request` to trex REST/GraphQL; OIDC client flow / `oidcProvider`; publish `@trex/sibyl`; production Docker/Caddy parity; token-expiry UX polish.
