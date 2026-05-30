# Move `results-viewer` to trex-notebook and wire it into the sibyl shell

Date: 2026-05-30
Status: Approved

## Goal

Relocate the `results-viewer` micro-frontend plugin from
`Atlas3/plugins-dev/results-viewer/` into the `trex-notebook` monorepo as a
first-class plugin (`trex-notebook/plugins/results-viewer/`), wire it into the
**sibyl** host shell exactly the way `strategus` is wired, make it work both
**standalone** (base `/`) and **under trex** (base `/plugins/sibyl/`), move and
adapt its e2e tests, build it, and remove it from Atlas3.

## Context

`results-viewer` is a Vue 3 single-spa parcel built to a SystemJS bundle
(`index.system.js` + `style.css`). It is loaded at runtime by a host shell via
the host's `public/config/plugins.json` manifest (SystemJS + single-spa), not as
a standalone SPA. It renders a file loader / results library and embeds a
shinylive (Shiny-via-WebR + DuckDB-WASM) app in a nested iframe to run
OhdsiShinyModules entirely in-browser.

The `strategus` plugin in this monorepo is the precedent: it lives at
`plugins/strategus/` with its own `package.json`/`vite.config.mjs`, builds a
SystemJS bundle into `../sibyl/public/plugins/strategus-plugin/`, and is declared
in `sibyl/public/config/plugins.json`.

## Target layout

```
trex-notebook/plugins/results-viewer/      # new package "results-viewer"
  src/ scripts/ shinylive-app/             # moved verbatim
  package.json  tsconfig.json  vite.config.mts
  tests/e2e/                               # the 4 specs, adapted
trex-notebook/plugins/sibyl/
  public/config/plugins.json               # + results-viewer entry
  public/plugins/results-viewer/           # build output (index.system.js, style.css, shinylive/, r-packages/, httpuv-serviceworker.js)
```

## Design

### 1. The move
Copy `src/`, `scripts/`, `shinylive-app/`, `package.json`, `package-lock.json`,
`tsconfig.json`, `vite.config.mts`, `.gitignore` into
`plugins/results-viewer/`. Changes on arrival:
- `vite.config.mts`: `outDir` and `copyPublicAssets()` target change from
  `../../public/plugins/results-viewer` to `../sibyl/public/plugins/results-viewer`.
- `copyPublicAssets()` additionally copies `src/public/httpuv-serviceworker.js`
  to the outDir root (vite's default `publicDir` is `<root>/public`, not
  `src/public`, so the SW would otherwise not be emitted; it must be served at
  `<base>httpuv-serviceworker.js`).
- `package.json`: keep name `results-viewer` (matches manifest id convention used
  by strategus-plugin), no `trex.ui.routes` (parcels are host-loaded, not trex
  routes — strategus has none either).

### 2. Base-path strategy (runtime detection)
The plugin hardcodes `/plugins/results-viewer/` in four places:
`src/main.ts:9` (style.css), `src/webr/httpuv-bridge.ts:15` (SW path) and `:113`
(scope fallback), `src/components/ShinyFrame.vue:10` (shinylive iframe). These
work at base `/` but break under `/plugins/sibyl/`.

A single committed bundle must serve both deployments, so resolve the base at
runtime instead of at build time. single-spa only activates the plugin when the
URL contains `/plugins/results-viewer/`, so:

```ts
export function pluginBase(): string {
  const marker = '/plugins/results-viewer/'
  const i = location.pathname.indexOf(marker)
  const prefix = i >= 0 ? location.pathname.slice(0, i) : ''
  return `${prefix}${marker}`
}
```

Yields `/plugins/results-viewer/` standalone and
`/plugins/sibyl/plugins/results-viewer/` under trex. Used by all four sites
(style href, SW register path + scope, iframe src). Placed in a small shared
module (e.g. `src/pluginBase.ts`).

### 3. COOP/COEP headers
WebR/DuckDB need `SharedArrayBuffer`, so the host document must be cross-origin
isolated. Add to sibyl `vite.config.ts` `server` and `preview`:
`Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Embedder-Policy: require-corp`. Serving these headers behind the
trex published image is a backend concern outside this repo — documented as a
known limitation (same class as the notebook plugin's base-path follow-up).

### 4. Sibyl wiring
Add to `sibyl/public/config/plugins.json` alongside `strategus-plugin`:
```json
{ "id": "results-viewer", "name": "Analysis Results", "version": "0.2.0",
  "entryPoint": "results-viewer/index.system.js",
  "menuItems": [{ "id": "results-viewer.main", "name": "Results",
    "route": "/plugins/results-viewer/", "icon": "mdi-chart-box-outline", "order": 60 }],
  "metadata": { "author": "OHDSI", "description": "OHDSI HADES analysis results viewer — WebR + DuckDB-WASM" } }
```

### 5. Atlas3 removal
Delete `plugins-dev/results-viewer/`, the `results-viewer` entry in
`Atlas3/public/config/plugins.json`, the results-viewer lines in
`Atlas3/.eslintignore` and `Atlas3/.gitignore`, the 4
`tests/e2e/results-viewer*.spec.ts`, and revert the COOP/COEP additions in
`Atlas3/vite.config.ts` only if they were added solely for this plugin.

### 6. E2E tests
The parcel can't host itself, so the specs run against the sibyl host. Relocate
to `plugins/results-viewer/tests/e2e/` with a playwright config whose `baseURL`
is sibyl's preview server; adapt the route (`/plugins/results-viewer/` works in
sibyl standalone), the test-data path, and sibyl's auth gate (plugins load only
after login — reuse sibyl's existing e2e auth approach/stub). Documented run
sequence: build results-viewer → build sibyl → preview → playwright.

### 7. Build / toolchain
- npm/vite build (node present): produces `index.system.js` + `style.css` into
  sibyl's `public/plugins/results-viewer/`. Guaranteed-verifiable deliverable.
- R build (best-effort): install R + build tools + pandoc + the `shinylive` and
  OHDSI packages (`ResultModelManager`, `OhdsiShinyModules`,
  `OhdsiShinyAppBuilder`, `OhdsiReportGenerator`), then run
  `scripts/build-shim-packages.R` and `scripts/build-shinylive-export.R` to
  generate `shinylive-export/` and `r-packages/`, then re-run the npm build so
  `copyPublicAssets()` copies them into sibyl's public dir. If the OHDSI tree
  can't be installed in the environment, stop and document the remaining
  commands; wiring stays verifiable via the npm build.

## Risks / open questions
- OHDSI R dependency tree may not fully install (system libs, network).
  Mitigation: npm-build fallback above.
- Sibyl e2e auth mechanism must be confirmed and reused.

## Verification
- `npm run build` clean in the plugin; sibyl typecheck/build clean.
- results-viewer appears in sibyl nav; its route mounts (DataLoader renders).
- e2e green (or documented-blocked on R artifacts).
- Atlas3 still builds after removal.
