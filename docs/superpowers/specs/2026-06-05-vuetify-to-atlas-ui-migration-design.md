# Vuetify → atlas-ui Migration + Style-Loading Fix — Design

**Date:** 2026-06-05
**Status:** Approved (design)

## Goal

Stop using raw Vuetify controls (`<v-*>`) directly in plugin templates. Always use the
corresponding `@ohdsi/atlas-ui` (`AtlasX`) component instead, so every plugin renders the
Atlas3 design consistently and the rule is enforced so it cannot regress. Bundle in a fix for
the intermittent plugin style-loading bug (styles sometimes not applied on load).

Vuetify remains the underlying engine — atlas-ui wraps Vuetify, and each plugin still calls
`createVuetify()`. "No Vuetify directly" means **no raw `<v-*>` in templates/views**, not
removing Vuetify from the stack.

## Background / current state

- **atlas-ui catalogue is complete.** The published library exports 36 `AtlasX` components
  (verified in the built `dist`): `AtlasAlert, AtlasAutocomplete, AtlasAvatar, AtlasBadge,
  AtlasBanner, AtlasButton, AtlasCard, AtlasCheckbox, AtlasChip, AtlasCol, AtlasContainer,
  AtlasDataTable, AtlasDialog, AtlasDivider, AtlasFab, AtlasIcon, AtlasIconButton, AtlasList,
  AtlasListItem, AtlasMenu, AtlasPageShell, AtlasPagination, AtlasProgressCircular,
  AtlasProgressLinear, AtlasRadio, AtlasRadioGroup, AtlasRow, AtlasSelect, AtlasSkeleton,
  AtlasSnackbar, AtlasSpacer, AtlasSwitch, AtlasTab, AtlasTabs, AtlasTextField, AtlasTooltip`.
  There is a target for essentially every control in use.
- **Prior work (already implemented on this branch):** registry plumbing (`.npmrc`, Docker
  BuildKit secret, CI auth), host Atlas theme via `buildVuetifyOptions()`, `tokens.css`, and
  partial adoption of `AtlasDialog`/`AtlasPageShell`. See
  `.claude/worktrees/nb2/docs/superpowers/plans/2026-06-05-atlas-ui-package-and-adoption.md`.
  This migration extends that to the raw form/layout controls and adds enforcement.
- **Scope:** ~520 raw `<v-*>` tags across **41 `.vue` files**. **Strategus is ~78%** of it.
  sibyl/jobs are nearly done; network, results-viewer, notebook-plugin are partial.

## Component mapping

Full inventory of distinct `<v-*>` in plugin templates (counts as of 2026-06-05).

### Ban-list — migrate to the Atlas equivalent

| Vuetify | Count | Atlas replacement | Notes |
|---|---|---|---|
| `v-text-field` | 105 | `AtlasTextField` | |
| `v-btn` | 69 | `AtlasButton` | icon-only buttons → `AtlasIconButton` |
| `v-checkbox` | 50 | `AtlasCheckbox` | |
| `v-select` | 40 | `AtlasSelect` | |
| `v-icon` | 33 | `AtlasIcon` | |
| `v-card` | 32 | `AtlasCard` | absorbs `v-card-title/-text/-subtitle/-actions` (see below) |
| `v-col` | 27 | `AtlasCol` | |
| `v-divider` | 17 | `AtlasDivider` | |
| `v-alert` | 15 | `AtlasAlert` | |
| `v-table` | 12 | `AtlasDataTable` | verify headers/items API shape |
| `v-chip` | 12 | `AtlasChip` | |
| `v-row` | 10 | `AtlasRow` | |
| `v-tooltip` | 5 | `AtlasTooltip` | |
| `v-spacer` | 5 | `AtlasSpacer` | |
| `v-tab` | 4 | `AtlasTab` | |
| `v-switch` | 4 | `AtlasSwitch` | |
| `v-snackbar` | 3 | `AtlasSnackbar` | |
| `v-progress-circular` | 3 | `AtlasProgressCircular` | |
| `v-list-item` | 2 | `AtlasListItem` | |
| `v-list` | 2 | `AtlasList` | |
| `v-tabs` | 1 | `AtlasTabs` | |
| `v-data-table` | 1 | `AtlasDataTable` | |

### Allow-list — structural / no Atlas equivalent (stays, lint-exempt)

| Vuetify | Count | Why kept |
|---|---|---|
| `v-card-text` | 27 | sub-slot of `AtlasCard`; migrated *with* the card, not a standalone tag |
| `v-card-title` | 22 | ″ (use `AtlasCard` title prop/slot) |
| `v-card-subtitle` | 3 | ″ |
| `v-card-actions` | 1 | ″ |
| `v-list-item-title` | 1 | sub-slot of `AtlasListItem` |
| `v-list-item-subtitle` | 1 | ″ |
| `v-window-item` | 4 | no Atlas equivalent |
| `v-window` | 1 | no Atlas equivalent |
| `v-main` | 2 | layout root, no equivalent |
| `v-app` | 2 | application root, no equivalent |
| `v-form` | 1 | no equivalent |
| `v-expand-transition` | 1 | transition wrapper, no equivalent |
| `v-file-input` | 1 | **no Atlas equivalent** — keep until atlas-ui adds one |

**TBD verify during implementation:**
- `v-textarea` (1) → `AtlasTextField` multiline if supported; else allow `v-textarea`.
- `AtlasCard` API: confirm it exposes title/subtitle/actions via props or named slots so the
  `v-card-*` sub-elements map cleanly. If not, the `v-card-*` sub-tags remain inside `AtlasCard`.
- `AtlasDataTable` headers/items prop shape vs the current `v-table`/`v-data-table` usage.

Each replacement's props/slots/events must be checked against the Vuetify usage it replaces —
they are wrappers but not always 1:1.

## Enforcement

Add an **ESLint rule** banning the ban-list `v-*` components in `plugins/*/src/**/*.vue`,
with the allow-list exempt. Prefer `vue/no-restricted-component` (eslint-plugin-vue) with the
ban-list; fall back to a small custom rule if `no-restricted-component` is unavailable in the
installed eslint-plugin-vue version. Wire it into the existing lint config + CI so violations
fail the build. Introduced as `warn` first, flipped to `error` per-plugin as each is cleaned,
then `error` repo-wide.

## Sequencing

1. **Tooling:** mapping table (this doc) + ESLint rule at `warn` + a short migration note.
2. **Verify atlas-ui exports** the full ban-list set in the pinned version
   (`0.1.0-20260605045838-e3c7c92`); if any are missing, bump/republish from Atlas3 first.
3. **Per-plugin migration, flip rule to `error` as each goes green:**
   sibyl → network → results-viewer → jobs → notebook-plugin.
4. **Strategus last**, panel-by-panel (it is ~78% of the work; the pattern is proven by then).
5. **Flip the rule to `error` repo-wide** once all plugins are clean.

Each plugin step ends with: rebuild image, Playwright screenshot of the migrated views,
confirm lint passes (no banned `v-*`), and confirm styles apply on a cold load.

## Style-loading fix (bundled)

### Root cause (confirm with a reproduction first)

Every plugin injects its `style.css` as a `<link>` appended in the single-spa `bootstrap()`
lifecycle **without awaiting `link.onload`**; `mount()` then renders immediately. On a cold or
slow load the parcel paints before its stylesheet applies → intermittent FOUC / unstyled
render that self-heals once the link loads. Paths are correct — all plugin `style.css` return
`200` at their real `/plugins/sibyl/plugins/<id>-plugin/style.css` URLs. The
`injectPluginCss` helper is copy-pasted across 5 `main.ts` files
(strategus, network, jobs, notebook-plugin) plus a variant in results-viewer
(`ensureStylesheet` + `pluginBase`, already hardened against an earlier route-based path race).

### Fix

- Make stylesheet injection **await load**: resolve a promise on `link.onload` / reject-or-warn
  on `link.onerror`, and **gate `mount` on it** so the parcel does not paint before its CSS is
  applied.
- Guard the unmount-remove → remount re-add race (idempotent inject keyed by id; do not remove
  while a remount is in flight).
- **Centralize** the duplicated `injectPluginCss`/MDI logic into one shared helper instead of
  5 near-identical copies.
- **MDI font:** the helpers currently inject MDI from a **jsDelivr CDN**
  (`cdn.jsdelivr.net/npm/@mdi/font`), which breaks offline/air-gapped installs. Switch to the
  MDI font already baked into the image/host. (Folded into this work per the same bug class.)

### Verification

Reproduce the intermittent failure first (e.g. throttled / disabled-cache load via Playwright,
observe FOUC and the CSS request timing), apply the fix, then confirm styles apply reliably on
cold load across all plugins.

## Risks

- **Pinned atlas-ui version** may predate a few components → Step 2 verifies exports and
  bumps/republishes from Atlas3 if needed.
- **Strategus volume** is the bulk of effort → panel-by-panel keeps diffs reviewable.
- **API drift** between `v-*` and `AtlasX` (slots/props) → verify per component; structural
  exceptions stay on Vuetify.

## Out of scope

- Removing Vuetify as the engine.
- Re-theming already covered by the prior atlas-ui adoption plan (tokens/background/scrim).
- The `notebook` plugin (Reka-UI/Tailwind, no Vuetify) — unaffected.
