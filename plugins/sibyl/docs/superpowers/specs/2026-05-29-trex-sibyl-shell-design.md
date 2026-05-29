# trex-sibyl — ATLAS-plugin Host Shell (Design)

Date: 2026-05-29
Status: Approved design → ready for implementation plan

## Context

Atlas3 (`../Atlas3`) is a Vue 3 application that doubles as a **host shell** for
micro-frontend plugins, loaded at runtime via SystemJS + single-spa and
configured through `public/config/plugins.json`. A Strategus UI already exists as
a self-contained plugin (`plugins-dev/strategus-plugin`, built in Atlas3's
`hadesui` worktree) covering OHDSI study modules (CohortMethod, SCCS, PLP,
Characterization, CohortDiagnostics, TreatmentPatterns, EvidenceSynthesis), spec
serialization, validation, and its own Pinia store.

The goal is a **second, dedicated host shell** — `trex-sibyl` — a sibling to
Atlas3 whose purpose is to host ATLAS plugins related to Strategus. It must
implement the *same plugin contract* as Atlas3 (so plugins built for Atlas3 run
unchanged) while carrying **none** of Atlas3's OHDSI domain UI.

### Dependency analysis (why the shell can be small)

The strategus-plugin was analysed against the Atlas3 host. It is almost fully
self-contained:

| Host dependency | Detail |
|---|---|
| `vue` (shared singleton) | The **only** externalized dep (`rollupOptions.external: ['vue']`), provided by the host via `System.register('vue', …)`. |
| single-spa lifecycle | Host calls `registerApplication`/`start`; plugin exports `bootstrap/mount/unmount`. `single-spa-vue` is bundled into the plugin. |
| `PluginProps` | Consumes only `authContext`, `messageBus`, `uiFilesUrl`, `name`, `mountParcel`, `singleSpa`. |
| One `messageBus` call | `request('data:request', { resource: 'cohorts' })` in `CohortPicker.vue`. Atlas3's own host returns a mock for this. |
| Manifest + route | `plugins.json` entry, route `/plugins/strategus-plugin/`, served from `/public/plugins/strategus-plugin/`. |

It does **not** use Atlas3's Vuetify singleton (builds its own with `theme:false`),
vue-router, Pinia singleton, auth services, WebAPI, or any `@/` host code.

**Conclusion:** sibyl needs only a strict subset of Atlas3 — the plugin-framework
files, the SystemJS bootstrap, a minimal Vuetify shell UI, and stubs for
`AuthContext` and `data:request`.

## Scope for v1

**v1 is an empty but fully working general plugin host.** It ships with **no
plugins** (empty `plugins.json`) and must:

- Boot a Vue 3 + Vuetify shell with an app bar and navigation.
- Initialize the plugin framework (SystemJS + single-spa) and gracefully render a
  "no plugins" state when the manifest is empty.
- Be demonstrably able to load and mount a plugin (validated by a test-only
  fixture plugin), so that moving the strategus-plugin in later is a
  configuration step, not a code change.

The strategus-plugin (and other Strategus-related plugins) will be **moved in
later** — out of scope for v1. No prebuilt bundle, no sync script in v1.

### Explicitly out of scope (YAGNI for v1)

Strategus-plugin bundle/sync, WebAPI proxy/backend, real authentication, i18n,
histoire, OHDSI domain views, Pythia/hello-world production plugins,
Docker/Caddy deployment (all deferred to follow-ups).

## Stack

Matched to Atlas3 so SystemJS shared singletons are byte-compatible with what
plugins expect:

- Vue 3.4, TypeScript (strict), Vite 5
- Vuetify 3 — **shell UI and a shared SystemJS singleton** (`window.__atlasVuetify`)
- Vue Router 4
- SystemJS + single-spa (+ vendored `single-spa-vue`)
- Pinia (shell state, if needed)
- Vitest + Playwright

## Architecture — a strict subset of Atlas3

```
trex-sibyl/
  index.html                     # SystemJS bootstrap; register vue, vue-router,
                                 #   vuetify(+components/directives), single-spa-vue
  vite.config.ts, tsconfig*.json, package.json
  public/
    config/plugins.json          # EMPTY plugin list in v1
    vendor/single-spa-vue.js     # vendored (as in Atlas3)
  src/
    main.ts                      # init Vue + Vuetify + router, expose window.__atlasVuetify,
                                 #   then initializePluginFramework(authStub)
    App.vue                      # shell: app bar + nav (from plugins.json) +
                                 #   <router-view> + PluginContainer mount points + no-plugins state
    models/PluginModels.ts       # ported plugin contract (types + zod) — verbatim from Atlas3
    services/PluginConfigService.ts   # load/validate plugins.json; empty-manifest fallback
    services/auth/authStub.ts    # no-auth AuthContext stub (isAuthenticated:true, hasPermission:()=>true)
    plugins/
      index.ts                   # initializePluginFramework
      core/{PluginRegistry,PluginLoader,PluginIsolation}.ts
      messaging/{HostMessageBus,MessageTypes}.ts   # data:request → stub {success:true,data:[]}
      navigation/{PluginRoutes,PluginMenuIntegration}.ts
      components/PluginContainer.vue
      vuetify.ts                 # createVuetifyInstance (shell + shared singleton)
    router/routes.ts             # plugin catch-all /plugins/:pluginId/:rest*
    components/NavBar.vue
    utils/logger.ts
  tests/
    fixtures/hello-fixture-plugin/   # TEST-ONLY minimal plugin to prove loading e2e
```

The `src/plugins/*`, `PluginConfigService`, `PluginModels`, and the `index.html`
SystemJS block are **ported from Atlas3 with import-path cleanup** — they have
zero OHDSI domain coupling. Everything domain-specific is dropped.

### Vuetify's dual role

1. **Shell UI** — app bar, nav, layout, using the same Vuetify defaults/theme as
   Atlas3 so the chrome matches.
2. **Shared singleton** — host registers `vuetify`, `vuetify/components`,
   `vuetify/directives` via SystemJS and exposes the instance on
   `window.__atlasVuetify`, byte-for-byte with Atlas3. Plugins that externalize
   Vuetify resolve to this single instance; plugins that bundle their own (like
   the current strategus-plugin) coexist fine.

### The one host integration: `data:request`

`HostMessageBus` handles `data:request` exactly as Atlas3 does — returns a stub
`{ success: true, data: [] }`. When a real cohort source is wired later, only this
handler changes.

### Auth

No-auth stub for v1 (`authStub.ts`) providing a dev `AuthContext`. Real auth is a
later isolated swap of the same shape.

## Testing

- **Vitest**: `PluginConfigService` manifest validation + empty-manifest fallback;
  `PluginLoader` URL resolution. Ported and trimmed from Atlas3 tests.
- **Playwright smoke test**: load shell → empty state renders; then, using the
  test-only `hello-fixture-plugin` registered via a test `plugins.json`, navigate
  to `/plugins/hello-fixture-plugin/` and assert it mounts. This proves the shell
  can host plugins without shipping one in production.

## Verification (end-to-end)

1. `npm install && npm run dev` → shell boots at the Vite dev port, app bar + nav
   render, "no plugins" state shown.
2. `npm run build && npm run preview` → production bundle serves and boots.
3. `npm run test:unit` → PluginConfigService + PluginLoader tests pass.
4. `npm run test:e2e` → smoke test mounts the fixture plugin.
5. Manual: drop a plugin bundle into `public/plugins/<id>/`, add an entry to
   `plugins.json`, reload → plugin appears in nav and mounts. (This is the path
   the strategus-plugin will follow when moved in.)

## Follow-ups (post-v1)

1. Move the strategus-plugin in (bundle + `plugins.json` entry, or vendor source).
2. Wire `data:request` to a real cohort source.
3. Real authentication.
4. Docker/Caddy deployment parity with Atlas3.
