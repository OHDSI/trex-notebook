# Vuetify → atlas-ui Migration + Style-Loading Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every raw Vuetify control (`<v-*>`) in plugin templates with its `@ohdsi/atlas-ui` `AtlasX` equivalent, enforce the rule so it cannot regress, and fix the intermittent plugin style-loading bug.

**Architecture:** Vuetify stays the underlying engine; atlas-ui wraps it. Migration is per-plugin and prop-aware (Atlas APIs differ from Vuetify — not a tag rename). Enforcement is a CI-wired Node guard script (these plugins have no ESLint; only `vue-tsc`). The style fix makes each plugin's stylesheet injection await `link.onload` before single-spa `mount()`.

**Tech Stack:** Vue 3, Vuetify 3, `@ohdsi/atlas-ui`, single-spa + SystemJS, Vite (library/system build), Node (guard script), GitHub Actions.

**Working constraints:** commit locally only — **do not `git push`**, **do not open PRs**, **no `Co-Authored-By` trailers**. `docs/` is gitignored here; add plan/spec files with `git add -f`. Each plugin builds independently (no root workspace).

**Spec:** `docs/superpowers/specs/2026-06-05-vuetify-to-atlas-ui-migration-design.md`

---

## Pre-flight facts (verified)

- atlas-ui exports 36 `AtlasX` components (full catalogue). Pinned dep across plugins:
  `@ohdsi/atlas-ui@^0.1.0-20260605045838-e3c7c92`.
- ~520 raw `<v-*>` tags across 41 `.vue` files; **strategus ≈ 78%**.
- Plugins build to `plugins/sibyl/dist/plugins/<id>/` and are served at
  `http://localhost:8011/plugins/sibyl/plugins/<id>/`. Served dir ids: `strategus-plugin`,
  `network-plugin`, `jobs-plugin`, `notebook-plugin`, `results-viewer`.
- Stack run/verify: export `NODE_AUTH_TOKEN=$(gh auth token)` and
  `METADATA_ENC_KEY=$(openssl rand -base64 32)`, then
  `docker compose up -d --build`. Health: `curl -s -o /dev/null -w '%{http_code}' http://localhost:8011/trex/api/ready` → `200`.
  Rebuild one node after a plugin change: `docker compose build trex-data && docker compose up -d --build trex-server`.

## Component prop cheat-sheet (Atlas APIs differ from Vuetify)

Use when migrating each call site. Thin wrappers (no extra props) accept the same content;
the rest need prop remapping. Verify against the installed `.d.ts` if unsure.

| Vuetify | Atlas | Key prop/slot remap |
|---|---|---|
| `v-btn color="primary"` + slot text | `AtlasButton` | `variant` (`primary`/`ghost`/…), `tone`, `icon`+`icon-position`; drop `color`. Icon-only → `AtlasIconButton`. |
| `v-text-field v-model :rules variant density` | `AtlasTextField` | `model-value`/`@update:model-value`, `label`, `error` (string msg, not boolean), `hint`, `type`, `multiline`+`rows` (replaces `v-textarea`), `placeholder`. Drop `:rules`/`variant`/`density`. |
| `v-textarea` | `AtlasTextField multiline :rows` | as above |
| `v-select v-model :items item-title item-value` | `AtlasSelect` | `items`, `item-title`, `item-value`, `multiple`, `clearable`, `error`, `label`. |
| `v-checkbox v-model label` | `AtlasCheckbox` | `model-value`, `label`, `error`, `indeterminate`. |
| `v-switch v-model` | `AtlasSwitch` | `model-value`, `label`, `tone`, `error`. |
| `v-alert type="error"` | `AtlasAlert` | `severity` (`error`/`warning`/`info`/`success`), `title`, `variant`, `closable`. |
| `v-chip color closable` | `AtlasChip` | `tone`, `size`, `closable`, `prepend-icon`. |
| `v-card` + `v-card-title`/`-text`/`-actions` | `AtlasCard` | props: `padding` (`none`/`sm`/`md`/`lg`), `interactive`. Card has a single default slot — put former title/text/actions markup inside it (these `v-card-*` sub-tags are allow-listed when nested in `AtlasCard`). |
| `v-table` / `v-data-table` | `AtlasDataTable` | `headers` (`{key,title,sortable,align,width}[]`), `items`, `items-per-page`, `@update:page/itemsPerPage/sortBy`. |
| `v-snackbar v-model` | `AtlasSnackbar` | `model-value`, `severity`, `text`, `timeout`, `location`, `closable`. |
| `v-icon` | `AtlasIcon` | thin wrapper; pass icon name as before. |
| `v-tooltip` | `AtlasTooltip` | thin wrapper; verify activator slot. |
| `v-col`/`v-row` | `AtlasCol`/`AtlasRow` | thin layout wrappers. |
| `v-divider` | `AtlasDivider` | thin wrapper. |
| `v-spacer` | `AtlasSpacer` | thin wrapper. |
| `v-tabs`/`v-tab` | `AtlasTabs`/`AtlasTab` | verify model/slot shape against usage. |
| `v-list`/`v-list-item` | `AtlasList`/`AtlasListItem` | `v-list-item-title/-subtitle` allow-listed when nested. |
| `v-progress-circular` | `AtlasProgressCircular` | thin wrapper. |

**Allow-listed (stay on Vuetify — no Atlas equivalent):** `v-app`, `v-main`, `v-form`,
`v-window`, `v-window-item`, `v-expand-transition`, `v-file-input`, and the `v-card-*` /
`v-list-item-*` sub-tags when nested inside their Atlas parent.

Import pattern (already used in the repo, e.g. `plugins/strategus/src/components/RunAnalysisDialog.vue`):
```ts
import { AtlasButton, AtlasTextField } from '@ohdsi/atlas-ui';
```

---

# PHASE 0 — Style-loading fix (independent; do first)

Root cause: each plugin injects `style.css` as a `<link>` in single-spa `bootstrap()` **without
awaiting load**, so `mount()` paints before CSS applies → intermittent FOUC. The
`injectPluginCss`/`injectMdiCss` helpers are copy-pasted in
`plugins/{strategus,network,jobs,notebook-plugin}/src/main.ts`; results-viewer has a hardened
variant (`ensureStylesheet` + `pluginBase`).

## Task 0.1: Reproduce the failure first

**Files:** none (investigation).

- [ ] **Step 1: Bring the stack up and confirm a plugin's CSS 200s**

```bash
export NODE_AUTH_TOKEN=$(gh auth token); export METADATA_ENC_KEY=$(openssl rand -base64 32)
docker compose up -d --build
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8011/plugins/sibyl/plugins/strategus-plugin/style.css   # expect 200
```

- [ ] **Step 2: Observe the race in a throttled, cache-disabled load**

Use Playwright (login as `admin@ohdsi.local`, see spec for auth). Navigate to a plugin route
with network throttling + cache disabled; screenshot immediately after mount. Expected on a
slow/cold load: a brief unstyled (FOUC) frame before CSS applies. Record it as the baseline.
This is the symptom the fix removes.

## Task 0.2: Make stylesheet injection await load (strategus)

**Files:** Modify `plugins/strategus/src/main.ts`

- [ ] **Step 1: Replace `injectPluginCss` with an awaited version**

Replace the existing `injectPluginCss` (around lines 11-22) with:
```ts
function injectPluginCss(uiFilesUrl: string): Promise<void> {
  const existing = document.getElementById(CSS_LINK_ID) as HTMLLinkElement | null;
  if (existing) {
    return existing.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => resolve(), { once: true });
        });
  }
  const base = uiFilesUrl
    ? uiFilesUrl.replace(/\/$/, '')
    : `${window.location.origin}/plugins/strategus-plugin`;
  return new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.id = CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = base + '/style.css';
    // Resolve on load so mount() never paints before CSS applies; resolve (not
    // reject) on error so a missing file can't hang the parcel forever.
    link.addEventListener('load', () => { link.dataset.loaded = 'true'; resolve(); }, { once: true });
    link.addEventListener('error', () => { resolve(); }, { once: true });
    document.head.appendChild(link);
  });
}
```

- [ ] **Step 2: Await it in `bootstrap`**

Change the `bootstrap` body (around lines 107-112) so CSS is awaited before the Vue bootstrap:
```ts
export const bootstrap = async (props: PluginProps) => {
  const baseUrl = props.uiFilesUrl ?? '';
  await injectPluginCss(baseUrl);
  injectMdiCss();
  return vueLifecycles.bootstrap(props);
};
```

- [ ] **Step 3: Stop removing CSS on unmount (kills the remove→remount race)**

In `unmount`, delete the `removePluginCss();` call (leave the stylesheet in `<head>` — it is
idempotent and harmless, and avoids a re-fetch FOUC on remount). Delete the now-unused
`removePluginCss` function.

- [ ] **Step 4: Make MDI offline-safe**

In `injectMdiCss`, replace the `cdn.jsdelivr.net` href branch with a no-CDN fallback (the host
shell always loads MDI before plugins bootstrap, so the font is normally already present):
```ts
function injectMdiCss(): void {
  if (typeof document.fonts !== 'undefined' && document.fonts.check?.('16px "Material Design Icons"')) {
    return; // host already provides MDI
  }
  // No external CDN (offline/air-gapped safe). The sibyl host imports
  // @mdi/font at module load; if it is somehow absent, surface it loudly.
  console.warn('[strategus] MDI font not present from host; icons may be missing.');
}
```
Delete the `MDI_LINK_ID` constant and the old CDN `<link>` creation.

- [ ] **Step 5: Type-check**

Run: `cd plugins/strategus && npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add plugins/strategus/src/main.ts
git commit -m "fix(strategus): await stylesheet load before mount; drop MDI CDN + unmount CSS race"
```

## Task 0.3: Apply the same fix to network, jobs, notebook-plugin

**Files:** Modify `plugins/network/src/main.ts`, `plugins/jobs/src/main.ts`,
`plugins/notebook-plugin/src/main.ts`.

- [ ] **Step 1:** For each of the three, apply Task 0.2 Steps 1-4 verbatim, changing only the
  fallback path id in `injectPluginCss` (`network-plugin`, `jobs-plugin`, `notebook-plugin`)
  and the `console.warn` plugin label. Each already has the same `injectPluginCss`/`injectMdiCss`
  copy and an `await`-able `bootstrap`.
- [ ] **Step 2:** Type-check each: `cd plugins/<p> && npx vue-tsc --noEmit` → no errors.
- [ ] **Step 3: Commit** (one commit):

```bash
git add plugins/network/src/main.ts plugins/jobs/src/main.ts plugins/notebook-plugin/src/main.ts
git commit -m "fix(plugins): await stylesheet load before mount; drop MDI CDN (network, jobs, notebook)"
```

## Task 0.4: Harden results-viewer

**Files:** Modify `plugins/results-viewer/src/main.ts` (the `ensureStylesheet` function).

- [ ] **Step 1:** results-viewer injects at module top-level via `ensureStylesheet()` using the
  already-hardened `pluginBase()`. Make `ensureStylesheet` return a `Promise<void>` that resolves
  on the link's `load`/`error` (same pattern as Task 0.2 Step 1), and `await` it in the parcel's
  `bootstrap` lifecycle before the Vue bootstrap. Keep the top-level call (eager warm-up) but
  also await in bootstrap so mount is gated.
- [ ] **Step 2:** Type-check: `cd plugins/results-viewer && npx vue-tsc --noEmit` → no errors.
- [ ] **Step 3: Commit**:

```bash
git add plugins/results-viewer/src/main.ts
git commit -m "fix(results-viewer): gate mount on stylesheet load"
```

## Task 0.5: Rebuild and verify the FOUC is gone

- [ ] **Step 1:** `docker compose build trex-data && docker compose up -d --build trex-server`
- [ ] **Step 2:** Re-run the Task 0.1 throttled/cache-disabled Playwright load for each plugin
  route. Expected: no unstyled frame — styles are applied on first paint. Compare against the
  Task 0.1 baseline screenshot.
- [ ] **Step 3:** Confirm no plugin requests `cdn.jsdelivr.net` (check the network log).

---

# PHASE 1 — Enforcement guard + atlas-ui verification

These plugins have **no ESLint** (only `vue-tsc`) and **no root workspace**. Enforcement is a
standalone Node guard script wired into CI, rolled out per-plugin.

## Task 1.1: Verify atlas-ui exports the full ban-list

**Files:** none (verification).

- [ ] **Step 1:** Confirm the pinned version exports every ban-list component. Inside the built
  image:
```bash
docker compose exec -T trex-server sh -c 'find / -path "*@ohdsi/atlas-ui*" -name "*.d.ts" 2>/dev/null | head'
```
  If node_modules are pruned in the image, instead check the source of truth in Atlas3:
```bash
grep -oE "Atlas[A-Za-z]+" /Users/ph/code/Atlas3/packages/atlas-ui/dist/atlas-ui.js | sort -u
```
  Expected: all of `AtlasButton, AtlasTextField, AtlasSelect, AtlasCheckbox, AtlasSwitch,
  AtlasAlert, AtlasChip, AtlasCard, AtlasDataTable, AtlasSnackbar, AtlasIcon, AtlasTooltip,
  AtlasCol, AtlasRow, AtlasDivider, AtlasSpacer, AtlasTabs, AtlasTab, AtlasList, AtlasListItem,
  AtlasProgressCircular` are present.
- [ ] **Step 2:** If any are missing from the **pinned** version, bump every plugin's
  `@ohdsi/atlas-ui` to a newer published version that includes them (republish from Atlas3 if
  needed — out of scope here, hand off to the user). Record the version used.

## Task 1.2: Write the guard script

**Files:** Create `scripts/check-no-raw-vuetify.mjs`

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
// Fails if banned raw Vuetify components appear in an ENFORCED plugin's templates.
// Rolled out per-plugin: add a plugin id to ENFORCED once it is fully migrated.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ENFORCED = [] // e.g. 'sibyl','network','results-viewer','jobs','notebook-plugin','strategus'

const BANNED = [
  'v-text-field','v-btn','v-checkbox','v-select','v-icon','v-card','v-col','v-divider',
  'v-alert','v-table','v-chip','v-row','v-tooltip','v-spacer','v-tab','v-tabs','v-switch',
  'v-snackbar','v-progress-circular','v-list','v-list-item','v-data-table','v-textarea',
]
// Allowed: structural / no Atlas equivalent, plus card/list sub-slots.
const ALLOWED = new Set([
  'v-app','v-application','v-main','v-form','v-window','v-window-item','v-expand-transition',
  'v-file-input','v-card-title','v-card-text','v-card-subtitle','v-card-actions',
  'v-list-item-title','v-list-item-subtitle',
])
const TAG = /<\/?(v-[a-z0-9-]+)/g

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist') continue
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (p.endsWith('.vue')) out.push(p)
  }
  return out
}

let violations = 0
for (const plugin of ENFORCED) {
  const root = `plugins/${plugin}/src`
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8')
    const seen = new Set()
    for (const m of text.matchAll(TAG)) {
      const tag = m[1]
      if (BANNED.includes(tag) && !ALLOWED.has(tag) && !seen.has(tag)) {
        seen.add(tag)
        console.error(`${file}: banned <${tag}> — use the Atlas equivalent`)
        violations++
      }
    }
  }
}
if (violations) { console.error(`\n${violations} banned Vuetify usage(s) found.`); process.exit(1) }
console.log(`No banned Vuetify components in enforced plugins: [${ENFORCED.join(', ') || 'none yet'}]`)
```

- [ ] **Step 2: Run it (ENFORCED empty → passes)**

Run: `node scripts/check-no-raw-vuetify.mjs`
Expected: `No banned Vuetify components in enforced plugins: [none yet]`

- [ ] **Step 3: Commit**

```bash
git add -f scripts/check-no-raw-vuetify.mjs
git commit -m "build: add raw-Vuetify guard script (per-plugin rollout)"
```

## Task 1.3: Wire the guard into CI

**Files:** Modify `.github/workflows/ci.yml` (add a job that runs the guard on every push/PR).

- [ ] **Step 1:** Add a job to `.github/workflows/ci.yml`:
```yaml
  guard-vuetify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24.x' }
      - run: node scripts/check-no-raw-vuetify.mjs
```
- [ ] **Step 2: Commit**:
```bash
git add .github/workflows/ci.yml
git commit -m "ci: run raw-Vuetify guard on every push"
```

---

# PHASE 2 — Migrate the smaller plugins

For **each** plugin below, follow this repeatable procedure (the "Migrate procedure"), then add
the plugin id to `ENFORCED` in `scripts/check-no-raw-vuetify.mjs`.

### Migrate procedure (per plugin)
1. List target files: `grep -rlE '<v-[a-z0-9-]+' --include='*.vue' plugins/<p>/src`.
2. For each file, replace each ban-list `<v-*>` with its Atlas component using the cheat-sheet,
   add the `import { AtlasX } from '@ohdsi/atlas-ui'`, and remap props. Leave allow-listed tags.
3. Type-check: `cd plugins/<p> && npx vue-tsc --noEmit` → no errors.
4. Add `<p>` to `ENFORCED`; run `node scripts/check-no-raw-vuetify.mjs` → passes for `<p>`.
5. Rebuild + Playwright screenshot the plugin's main views; confirm parity with pre-migration.
6. Commit: `git add -A && git commit -m "refactor(<p>): use atlas-ui components, ban raw Vuetify"`.

## Task 2.1: sibyl (lightest — LoginView etc.)
**Files:** `plugins/sibyl/src/**/*.vue` (the ~3 files with `<v-*>`, e.g. `views/LoginView.vue`, `components/NavBar.vue`).
- [ ] Run the Migrate procedure for `sibyl`.

## Task 2.2: network
**Files:** `plugins/network/src/**/*.vue` (5 files, ~26 tags).
- [ ] Run the Migrate procedure for `network`.

## Task 2.3: results-viewer
**Files:** `plugins/results-viewer/src/**/*.vue` (3 files, ~19 tags; e.g. `components/ResultsLibrary.vue`).
- [ ] Run the Migrate procedure for `results-viewer`.

## Task 2.4: jobs
**Files:** `plugins/jobs/src/**/*.vue` (tables, `StatusChip.vue`).
- [ ] Run the Migrate procedure for `jobs`.

## Task 2.5: notebook-plugin
**Files:** `plugins/notebook-plugin/src/**/*.vue` (`views/NotebookListView.vue` etc., ~16 tags).
- [ ] Run the Migrate procedure for `notebook-plugin`. Note: this plugin also uses Tailwind/`v-data-table`; map the table to `AtlasDataTable`.

---

# PHASE 3 — Strategus (≈78%, panel-by-panel)

Strategus has ~450 tags across ~27 files. Migrate in small, independently-verifiable batches so
each diff stays reviewable. Use the Migrate procedure per file/panel; do **not** add `strategus`
to `ENFORCED` until every file is clean.

Heaviest files (migrate one per task, highest first):

## Task 3.1: `src/views/modules/CohortIncidencePanel.vue` (~37 tags)
- [ ] Migrate per the cheat-sheet; `vue-tsc --noEmit`; rebuild + screenshot the panel; commit.

## Task 3.2: `src/views/modules/PlpPanel.vue` (~35)
## Task 3.3: `src/views/TimeAtRiskPanel.vue` (~34)
## Task 3.4: `src/views/CohortsPanel.vue` (~33)
## Task 3.5: `src/views/modules/CohortMethodPanel.vue` (~33)
## Task 3.6: `src/views/modules/SccsPanel.vue` (~31)
## Task 3.7: `src/views/modules/EvidenceSynthesisPanel.vue` (~30)
## Task 3.8: `src/views/modules/TreatmentPatternsPanel.vue` (~26)
- [ ] Tasks 3.2–3.8: same as 3.1, one file per task (Migrate procedure steps 2-3, 5-6).

## Task 3.9: Remaining strategus files
- [ ] **Step 1:** `grep -rlE '<v-[a-z0-9-]+' --include='*.vue' plugins/strategus/src` and migrate
  every remaining file not covered by 3.1–3.8 (panels, `components/*`, `StrategusApp.vue`,
  `StrategusLayout.vue`), one commit per 1–3 files.
- [ ] **Step 2:** `npx vue-tsc --noEmit` clean.
- [ ] **Step 3:** Add `strategus` to `ENFORCED`; `node scripts/check-no-raw-vuetify.mjs` passes.
- [ ] **Step 4:** Rebuild + full Playwright sweep of every strategus panel; confirm parity. Commit.

---

# PHASE 4 — Lock it down

## Task 4.1: Confirm all plugins enforced
- [ ] **Step 1:** `ENFORCED` in `scripts/check-no-raw-vuetify.mjs` now contains all six:
  `sibyl, network, results-viewer, jobs, notebook-plugin, strategus`.
- [ ] **Step 2:** `node scripts/check-no-raw-vuetify.mjs` → passes; intentionally add a stray
  `<v-btn>` to a test file and confirm it exits non-zero, then revert.
- [ ] **Step 3:** Commit the final `ENFORCED` list:
```bash
git add scripts/check-no-raw-vuetify.mjs
git commit -m "build: enforce no-raw-Vuetify across all plugins"
```

## Task 4.2: Final verification
- [ ] **Step 1:** `docker compose build trex-data && docker compose up -d --build trex-server`.
- [ ] **Step 2:** Playwright sweep: Home, Strategus (list + each panel + a dialog), Notebooks,
  Jobs, Network, Results. Confirm: no `<v-*>` banned tags remain (guard green), styles apply on
  cold load (Phase 0), and each page renders at parity with before.
- [ ] **Step 3:** Dispatch a code review over the full diff, then use
  `superpowers:finishing-a-development-branch`.

---

## Self-review (plan vs spec)

- **"No raw Vuetify, always Atlas"** → Phases 2–3 migrate all ban-list tags; Phase 1/4 guard
  enforces it. ✓
- **"Enforced so it can't regress"** → guard script + CI (1.2, 1.3) + per-plugin rollout +
  repo-wide lock (4.1). Adapted from "ESLint rule" because these plugins have no ESLint; noted. ✓
- **Component mapping + structural exceptions** → cheat-sheet + guard ALLOWED set. ✓
- **Style-loading fix (await load, dedupe remount, centralize, MDI offline)** → Phase 0 (await
  `onload`, drop unmount-remove race, drop CDN). Note: true cross-plugin centralization needs a
  shared module (atlas-ui) and is deferred; each plugin gets the same fix inline. ✓
- **Verification (reproduce-first, throttled cold load)** → 0.1 baseline, 0.5 confirm. ✓
- **Risk: pinned atlas-ui may lack components** → 1.1 verifies/bumps. ✓
- **Strategus volume** → Phase 3 one-file-per-task. ✓

**Deviation from spec to flag:** enforcement is a Node guard script, not ESLint (no ESLint in
these plugins); centralizing the style helper into a shared module is deferred (no shared build).
