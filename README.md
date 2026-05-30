# trex-notebook

A monorepo of **trex UI plugins**. Each plugin under `plugins/` is a standalone
package (its own `package.json`, build and tests) loaded by the trex backend via
its `trex.ui.routes` registration.

## Plugins

| Plugin | Package | Route | What it is |
|--------|---------|-------|------------|
| [`plugins/notebook`](plugins/notebook) | `@trex/notebook` | `/plugins/trex/notebook` | React notebook component (Python via Pyodide, R via WebR, Markdown). |
| [`plugins/sibyl`](plugins/sibyl) | `trex-sibyl` | `/plugins/sibyl` | ATLAS-plugin host shell; authenticates against trex. See `plugins/sibyl/README.md`. |
| [`plugins/strategus`](plugins/strategus) | `strategus-plugin` | sibyl sub-plugin | Strategus Analysis Spec Builder. SystemJS module hosted *inside* sibyl. |
| [`plugins/network`](plugins/network) | `network-plugin` | sibyl sub-plugin | Federated network studies — site plugin. SystemJS module hosted *inside* sibyl; auths to a central API via Cognito. |
| [`plugins/results-viewer`](plugins/results-viewer) | `results-viewer` | sibyl sub-plugin | OHDSI HADES analysis-results viewer — Shiny via WebR + DuckDB-WASM, in-browser. See `plugins/results-viewer/README.md`. |

Two kinds of plugin live here:

- **trex UI plugins** (notebook, sibyl) — standalone SPAs the trex backend serves
  directly via their `trex.ui.routes` registration.
- **sibyl sub-plugins** (strategus, network, results-viewer) — SystemJS modules
  built into `plugins/sibyl/public/plugins/<id>/` and registered in
  `plugins/sibyl/public/config/plugins.json`; the sibyl shell loads them at
  runtime. They ship as part of sibyl's `dist`, not as separate trex routes.

Each plugin is built independently:

    cd plugins/<name>
    npm install
    npm run build         # sub-plugins write into ../sibyl/public/plugins/<id>/

## Run sibyl on trex (custom image)

The root `docker-compose.yml` builds a custom image from [`Dockerfile`](Dockerfile):
the published trex backend (pinned to an immutable `sha-…` tag, since the image
publishes no semver tags) with the pre-built **sibyl** plugin baked into
`/usr/src/plugins`, served at `/plugins/sibyl`. Baking it in means the container
needs no bind-mounts. The **strategus** and **network** sub-plugins are built into
sibyl's `public/plugins/` and ship inside sibyl's `dist`, so they're baked too.
(The notebook plugin is a follow-up — it needs a base-path build first.)

The pinned base image is `ghcr.io/ohdsi/trexsql:sha-8eaa659…` — the build of
OHDSI/trex's `add hades plugin (#36)` commit, the first to bake the **hades**
DuckDB extension (`/usr/lib/trexsql/extensions/hades.trex`). hades is part of the
base image, not something this repo builds.

    # Build the sibyl sub-plugins first (they write into sibyl/public/plugins/)
    cd plugins/strategus && npm install && npm run build && cd ../..
    cd plugins/network   && npm install && npm run build && cd ../..
    # Then build sibyl (copies public/ into dist/) and bring up the stack
    cd plugins/sibyl && npm install && npm run build:trex && cd ../..
    docker compose up -d --build                            # build image + run stack

Open **`http://localhost:8011/plugins/sibyl`** (8011 = HTTP, 8010 = TLS; ports
are offset from trex's own compose so both can run in parallel). The strategus and
network sub-plugins appear in sibyl's navigation once loaded.

> **Network plugin runtime config:** the network sub-plugin expects the host to
> inject `window.__networkPluginConfig` (`apiUrl`, `cognitoDomain`, `clientId`,
> `redirectUri`) from the Central Serverless API deploy. Until that's provided it
> loads but its Cognito auth is inactive.

Re-run `docker compose up -d --build` after rebuilding any plugin's `dist`. To move
to a newer trex backend, bump the `sha-…` tag in `Dockerfile` (the `FROM`) and in
`docker-compose.yml` (the `trex-init` image).

> **Local note (Apple Silicon):** `trexsql` is an amd64-only image. Under QEMU
> emulation on arm64 the trexas HTTP server may not bind (`:8011` returns no
> response even though the log says "TrexSQL ready"). The image contents are
> correct; run on an amd64 host to exercise it live.

### First admin

trex seeds no user; the sign-up matching `ADMIN_EMAIL` (set to
`admin@ohdsi.local` in the compose) — or the first user — is promoted to admin.
A bootstrap admin has been created for local dev:

- **Username:** `admin@ohdsi.local`
- **Password:** `password` (change after first login)

To (re)create it, see `plugins/sibyl/README.md` → "First admin".

## Layout

```
trex-notebook/
  plugins/
    notebook/   # @trex/notebook — React notebook (standalone)
    sibyl/      # trex-sibyl — ATLAS-plugin host shell (standalone)
  Dockerfile           # pinned trex image + sibyl baked into /usr/src/plugins
  docker-compose.yml   # builds the image above + runs trex & postgres
  secrets/             # trex-init-generated keys (gitignored)
```
