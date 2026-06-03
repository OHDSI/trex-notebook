# Notebook plugin for the sibyl shell

Date: 2026-06-02
Status: Approved (brainstorming) — pending implementation plan

## Goal

Make the React-turned-Vue notebook (`plugins/notebook`, exported as the
`@trex/notebook` lib) available inside the **sibyl** ATLAS-plugin host shell as a
first-class plugin, and add the ability to **store, list, open, edit, rename,
duplicate and delete** notebooks. All persistence is done through trex's
PostGraphile GraphQL endpoint (`/trex/graphql`) — no bespoke REST.

The notebook component is consumed **as a library**; a new, separate sibyl
plugin (`plugins/notebook-plugin`) provides the shell glue, the CRUD UI, and the
GraphQL store.

## Context (what already exists)

- `plugins/notebook` — the notebook, ported React→Vue, with a clean lib API in
  `src/index.ts` (`Notebook` component, `useNotebook`, `PyodideKernel`,
  `WebRKernel`, `JupyterKernel`, `createEmptyNotebook`, `toIpynb`/`fromIpynb`).
  Currently builds as a standalone app (`src/main.ts` mounts `App.vue`).
- `plugins/sibyl` — Vue 3 + Vuetify + single-spa + SystemJS host shell. Loads
  plugins listed in `public/config/plugins.json`; each plugin is an
  `index.system.js` bundle under `public/plugins/<id>/`.
- `plugins/jobs` — the reference sibyl plugin. It already does GraphQL CRUD
  against `/trex/graphql`, has a single-spa `main.ts`, Pinia stores, Vuetify
  views, and a `lib`/`system`-format `vite.config.ts` that outputs into
  `../sibyl/public/plugins/jobs-plugin`. **The notebook plugin copies this
  structure.**
- `plugins/metadata-api` — backend (Deno edge function + Flyway-style
  migrations, `trex.migrations.schema = notebook`). `V1__notebook_schema.sql`
  defines `notebook.analysis_definition`, `notebook.analysis_result`,
  `notebook.cdm_connection`. PostGraphile auto-exposes these tables.

### Known gotchas (carried from existing notes)

- **rowId gotcha**: the `id` UUID PK is exposed by PostGraphile as the GraphQL
  field `rowId` (`id` is the opaque Node global id). Stores SELECT `rowId` and
  treat it as the entity id.
- **Soft-delete filtering**: PostGraphile `condition`/`filter` may not expose
  `deletedAt`, so soft-deleted rows are filtered **client-side** after the list
  query (as `useDefinitionsStore` already does).
- **Migrations are not auto-applied** — applying `V2` requires the trex
  migration run / redeploy. This is a deploy step, not a code step.
- **PostGraphile v5** ignores v4 `@omit`; use `@behavior -*` to hide a column.
  (Not needed here — no secrets in `notebook.document`.)

## Decisions (from brainstorming)

1. **Workspace**: work on the `p-hoffmann/s` line (this worktree was reset to it).
2. **Storage**: a **new dedicated `notebook.document` table** (not reusing
   `analysis_definition`).
3. **Packaging**: a **new `plugins/notebook-plugin`** that depends on
   `@trex/notebook` (`file:../notebook`).
4. **Scope**: list, new, open/edit, save, delete **plus** rename, description,
   duplicate.
5. **Save** is an explicit button (no autosave).
6. A basic Playwright e2e smoke is included now.

## Components

### A. Backend — `notebook.document` table

New migration `plugins/metadata-api/migrations/V2__notebook_document.sql`:

```sql
-- Stored notebooks (distinct from analysis_definition, which holds Strategus specs).
CREATE TABLE IF NOT EXISTS notebook.document (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content     JSONB NOT NULL,        -- serialized NotebookData
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notebook_document_updated
    ON notebook.document(updated_at DESC);
```

PostGraphile then exposes (names follow the `analysis_definition` precedent):

- `allNotebookDocuments(orderBy: UPDATED_AT_DESC) { nodes { rowId name description createdAt updatedAt deletedAt } }`
- `allNotebookDocuments(condition: { rowId: $id }) { nodes { rowId name description content } }` (get one)
- `createNotebookDocument(input: { notebookDocument: { name, description, content, createdBy } }) { notebookDocument { rowId } }`
- `updateNotebookDocumentByRowId(input: { rowId, notebookDocumentPatch: { … } }) { notebookDocument { rowId } }`

`updated_at` is set explicitly in the update patch (`updatedAt: <ISO ts>`),
matching how `useDefinitionsStore` passes a timestamp for soft-delete.

The `content` payload is the notebook's in-memory `NotebookData` (cells +
metadata) as JSON. We persist `NotebookData` directly (round-trips losslessly
within the app); `toIpynb`/`fromIpynb` remain available for import/export but are
not the storage format.

### B. New plugin `plugins/notebook-plugin`

Directory layout mirrors `plugins/jobs`:

```
plugins/notebook-plugin/
  package.json          # deps: vue, vuetify, single-spa-vue, @trex/notebook (file:../notebook)
  vite.config.ts        # lib/system build -> ../sibyl/public/plugins/notebook-plugin
  index.html            # dev harness
  src/
    main.ts             # single-spa lifecycle (copied from jobs/main.ts)
    NotebookApp.vue      # root: list <-> editor switch
    api/
      graphqlClient.ts  # same tiny client as jobs -> /trex/graphql
    store/
      useNotebooksStore.ts
    views/
      NotebookListView.vue
      NotebookEditorView.vue
  tests/
    unit/...            # vitest store + client specs
    e2e/...             # playwright smoke (optional in sibyl)
```

**`vite.config.ts`** — same as `plugins/jobs/vite.config.ts` but:
- `outDir: '../sibyl/public/plugins/notebook-plugin'`
- Tailwind enabled (`@tailwindcss/vite`) and configured to scan
  `node_modules/@trex/notebook` (or the linked source) so the notebook
  component's utility classes are emitted into the plugin's `style.css`.
- `vue` stays `external` (host provides the singleton); `cssCodeSplit: false`.
- Pyodide/WebR workers: keep `worker.format: 'es'`; verify the worker assets are
  emitted/loadable under the plugin's public dir.

**`src/main.ts`** — copy `plugins/jobs/src/main.ts` verbatim, renaming ids
(`notebook-plugin-styles`, `notebook-plugin-mdi`) and rendering `NotebookApp`.
Keeps: `injectPluginCss(uiFilesUrl)`, `injectMdiCss()`, `getSharedDefaults()`
reading `window.__atlasUiConfig`, single-spa-vue bootstrap/mount/unmount,
Pinia + Vuetify install in `handleInstance`. `PluginProps.authContext` is used to
populate `created_by`.

**`src/api/graphqlClient.ts`** — copy of jobs' `GraphqlClient` +
`defaultGraphqlEndpoint()` (`${location.origin}/trex/graphql`).

**`src/store/useNotebooksStore.ts`** — Pinia store, modeled on
`useDefinitionsStore`:
- `notebooks: NotebookSummary[]`, `error: string | null`
- `fetch()` — list, filter `deletedAt == null` client-side
- `get(id) -> { rowId, name, description, content }`
- `create({ name, description, content, createdBy }) -> rowId`
- `update(id, patch)` — name/description/content/updatedAt
- `remove(id)` — soft-delete (`deletedAt = now`), then refetch
- `duplicate(id)` — get + create copy named `"<name> (copy)"`

**`src/views/NotebookListView.vue`** — Vuetify `v-data-table` of notebooks
(name, description, updated-at). Row actions: Open, Rename (inline/dialog),
Duplicate, Delete (confirm). Toolbar: "New notebook" (creates an empty
`createEmptyNotebook()` doc and opens the editor).

**`src/views/NotebookEditorView.vue`** — embeds `<Notebook>` from
`@trex/notebook`:
- `:initial-data` = loaded `content` (or `createEmptyNotebook()` for new)
- `:kernels="[new PyodideKernel(), new WebRKernel()]"`,
  `:default-kernel-config="{ type: 'pyodide' }"`
- `:on-change` captures the latest `NotebookData` into a local ref (marks dirty)
- Editable name + description fields
- Explicit **Save** button → `create` (first save) or `update` (subsequent);
  Back returns to the list.

**`src/NotebookApp.vue`** — holds `view: 'list' | 'editor'` and the active
notebook id; renders the matching view. (Internal switch, like `JobsApp.vue`'s
tabs — no nested vue-router needed.)

### C. Register in sibyl

Add to `plugins/sibyl/public/config/plugins.json`:

```json
{
  "id": "notebook-plugin",
  "name": "Notebooks",
  "version": "0.1.0",
  "entryPoint": "notebook-plugin/index.system.js",
  "menuItems": [
    {
      "id": "notebook.main",
      "name": "Notebooks",
      "route": "/plugins/notebook-plugin/",
      "icon": "mdi-notebook-outline",
      "order": 52
    }
  ],
  "metadata": {
    "author": "OHDSI",
    "description": "Create, store and run Python/R/Markdown notebooks (Pyodide/WebR)"
  }
}
```

## Data flow

| Action     | GraphQL                                                                 |
|------------|-------------------------------------------------------------------------|
| List       | `allNotebookDocuments(orderBy: UPDATED_AT_DESC)` → filter `deletedAt`    |
| Open       | `allNotebookDocuments(condition:{rowId})` select `content`              |
| New        | local `createEmptyNotebook()`, persisted on first Save                  |
| Save (new) | `createNotebookDocument(input:{notebookDocument:{…content, createdBy}})` |
| Save       | `updateNotebookDocumentByRowId(patch:{content, updatedAt})`             |
| Rename     | `updateNotebookDocumentByRowId(patch:{name, updatedAt})`               |
| Description| `updateNotebookDocumentByRowId(patch:{description, updatedAt})`         |
| Duplicate  | `get` + `createNotebookDocument` (name + " (copy)")                     |
| Delete     | `updateNotebookDocumentByRowId(patch:{deletedAt})` (soft)               |

## Error handling

- Store catches GraphQL errors into `error` (string); views surface a
  Vuetify alert/snackbar. Matches `useDefinitionsStore`.
- Save failures keep the editor dirty (no navigation away on error).
- A missing/deleted notebook on Open returns to the list with an error message.

## Risks / open considerations

1. **Cross-origin isolation (COOP/COEP)** is required for Pyodide/WebR workers
   and SharedArrayBuffer. `results-viewer` already runs WebR + DuckDB-WASM inside
   sibyl, so precedent exists — confirm the sibyl/trex host serves the headers
   for the plugin's worker assets. If unavailable, view/edit/save still works;
   only in-browser execution degrades.
2. **Tailwind bundling** of `@trex/notebook` inside the SystemJS lib build is the
   main build wrinkle (content-scan the dependency; ship one `style.css`).
3. **`vue` externalization** — the notebook lib must use the host's Vue singleton
   (already `external: ['vue']`, as in jobs).
4. **Worker asset paths** under the plugin base must resolve at the
   `/plugins/notebook-plugin/` mount.

## Testing

- **Unit (vitest)**: `useNotebooksStore` CRUD against a mocked `GraphqlClient`
  (mirror `useDefinitionsStore.spec.ts`); `graphqlClient.spec.ts` (mirror jobs).
- **E2E (playwright)**: sibyl smoke — load plugin, create New, add a markdown
  cell, Save, return to list, reopen, delete. Heavy kernel-execution e2e is
  deferred.
- `npm run check-all` style gate per plugin (type-check + unit + build).

## Out of scope (YAGNI)

- Sharing/permissions, folders/tags, version history, real-time collaboration.
- Notebook execution against remote Jupyter/HADES from this plugin.
- Importing the `.ipynb` import/export UI beyond what `@trex/notebook` already
  provides.
