# trex-notebook

A monorepo of **trex UI plugins**. Each plugin under `plugins/` is a standalone
package (its own `package.json`, build and tests) loaded by the trex backend via
its `trex.ui.routes` registration.

## Plugins

| Plugin | Package | Route | What it is |
|--------|---------|-------|------------|
| [`plugins/notebook`](plugins/notebook) | `@trex/notebook` | `/plugins/trex/notebook` | React notebook component (Python via Pyodide, R via WebR, Markdown). |
| [`plugins/sibyl`](plugins/sibyl) | `trex-sibyl` | `/plugins/sibyl` | ATLAS-plugin host shell for Strategus; authenticates against trex. See `plugins/sibyl/README.md`. |
| [`plugins/results-viewer`](plugins/results-viewer) | `results-viewer` | sibyl-hosted `/plugins/results-viewer/` | OHDSI HADES analysis-results viewer — Shiny via WebR + DuckDB-WASM, in-browser. Built into sibyl's `public/plugins/` like a sibyl plugin. See `plugins/results-viewer/README.md`. |

Each plugin is built independently:

    cd plugins/<name>
    npm install
    npm run build

## Run on trex (published image)

The root `docker-compose.yml` runs the trex backend from its published image
(`ghcr.io/ohdsi/trexsql:latest`) and serves the built **sibyl** plugin at
`/plugins/sibyl`. (Per the current setup it mounts only sibyl; the notebook
plugin is registered but not mounted by this compose yet — serving it on trex
needs a base-path build, a follow-up.)

    cd plugins/sibyl && npm install && npm run build:trex   # base = /plugins/sibyl/
    cd ../.. && docker compose up -d                        # trex + postgres

Open **`http://localhost:8011/plugins/sibyl`** (8011 = HTTP, 8010 = TLS; ports
are offset from trex's own compose so both can run in parallel).

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
  docker-compose.yml   # runs trex (published image) + serves sibyl
  secrets/             # trex-init-generated keys (gitignored)
```
