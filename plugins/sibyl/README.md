# trex-sibyl

ATLAS-plugin **host shell** dedicated to Strategus-related plugins. Sibling to
Atlas3; implements the same plugin contract (SystemJS + single-spa, `plugins.json`)
but carries none of Atlas3's OHDSI domain UI.

## Develop

    npm install
    npm run dev        # http://localhost:5174

Ships empty: no plugins are registered. To host a plugin, drop its built bundle
into `public/plugins/<id>/` and add an entry to `public/config/plugins.json`
(menu routes must start with `/plugins/<id>/`). The Strategus plugin will be
moved in this way later.

> Note: sibyl runs on port **5174** so it can run alongside Atlas3 (which uses 5173).

## Test

    npm run test:unit  # Vitest: config + loader
    npm run test:e2e   # Playwright: empty-state smoke + fixture mount
    npm run check-all  # type-check + unit + build

`tests/fixtures/hello-fixture-plugin/` is a test-only plugin used by the e2e
mount test; it is built into `public/plugins/` (gitignored) on demand.

### Running e2e where `playwright install` is unavailable

If your OS can't download Playwright's managed browser, point Playwright at a
system/cached Chromium:

    PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e

(`--no-sandbox` is applied automatically when this env var is set.)

## Architecture

See `docs/superpowers/specs/2026-05-29-trex-sibyl-shell-design.md`.

## Run inside trex (as a UI plugin)

sibyl can run as a trex UI plugin served at `/plugins/sibyl`, using trex as the
backend and identity provider.

Use the self-contained stack in this repo (it runs the published trex image
and mounts the built sibyl — see `docker-compose.yml`):

    npm run build:trex      # build sibyl with base = /plugins/sibyl/
    docker compose up -d    # trex + postgres (published image) + sibyl

Then open **`http://localhost:8011/plugins/sibyl`** and sign in with a trex
account.

Ports are deliberately offset from trex's own compose so both can run in
parallel: **8011** = HTTP (use this), **8010** = TLS (`https://localhost:8010/...`,
self-signed warning), **5443** = Postgres wire. `http://localhost:8010` will not
work (it's the TLS port).

> Alternative: instead of this repo's compose, you can layer
> `deploy/trex-sibyl.override.yml` onto trex's own compose (from the trex repo)
> — that serves sibyl on trex's default ports (8001/8000).

### Auth

sibyl authenticates against trex's GoTrue-compatible API (`/trex/auth/v1`) with
its own login form, storing the session under `localStorage["sibyl.auth.session"]`.
The plugin framework initializes only once authenticated. For standalone dev
(`npm run dev`), the Vite server proxies `/trex` to `VITE_TREX_PROXY`
(default `http://localhost:8011` — this repo's stack), so a locally-running trex
can serve real logins.

#### First admin (same bootstrap as trex)

trex does not seed a user. It promotes the **first** sign-up (or one matching
`ADMIN_EMAIL`) to **admin**; `auth.selfRegistration` defaults to `false`. The
compose sets `ADMIN_EMAIL` (default `admin@ohdsi.local`). To create that first
admin once:

    # enable self-registration for the bootstrap, then sign up the admin email
    docker compose exec postgres psql -U postgres -d testdb \
      -c "UPDATE trexdb.setting SET value='true'::jsonb WHERE key='auth.selfRegistration';"
    curl -sX POST http://localhost:8011/trex/auth/v1/signup \
      -H 'Content-Type: application/json' \
      -d '{"email":"admin@ohdsi.local","password":"<your-password>","data":{"name":"Admin"}}'
    # then turn it back off
    docker compose exec postgres psql -U postgres -d testdb \
      -c "UPDATE trexdb.setting SET value='false'::jsonb WHERE key='auth.selfRegistration';"

That account (matching `ADMIN_EMAIL`) is promoted to admin and can sign in at
`/plugins/sibyl`.

## Follow-ups

- Move the Strategus plugin in.
- Wire `data:request` (`HostMessageBus`) to a real cohort source.
- Real authentication (replace `src/services/auth/authStub.ts`).
- Docker/Caddy deployment parity with Atlas3.
