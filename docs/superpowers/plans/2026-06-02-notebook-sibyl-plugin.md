# Notebook Sibyl Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `notebook-plugin` to the sibyl shell that lets users store, list, open, edit, rename, duplicate, and delete notebooks, with all CRUD done via trex's PostGraphile GraphQL endpoint; the notebook UI is consumed as the `@trex/notebook` library.

**Architecture:** A new backend migration adds a `notebook.document` table (auto-exposed by PostGraphile). A new Vue 3 + Vuetify + single-spa plugin (`plugins/notebook-plugin`) — structured exactly like `plugins/jobs` and built as a SystemJS bundle into `plugins/sibyl/public/plugins/notebook-plugin` — embeds the `<Notebook>` component from `@trex/notebook` and persists documents through a Pinia store backed by a tiny GraphQL client.

**Tech Stack:** Vue 3, Vuetify 3, Pinia, single-spa-vue, Vite (lib/`system` build), PostGraphile (GraphQL over `/trex/graphql`), Vitest, Playwright. Reference plugins: `plugins/jobs` (GraphQL CRUD pattern) and `plugins/results-viewer` (worker/WASM SystemJS build + COOP/COEP).

**Spec:** `docs/superpowers/specs/2026-06-02-notebook-sibyl-plugin-design.md`

---

## File Structure

**Backend (existing `plugins/metadata-api`):**
- Create: `plugins/metadata-api/migrations/V2__notebook_document.sql` — new `notebook.document` table.

**New plugin `plugins/notebook-plugin`:**
- Create: `plugins/notebook-plugin/package.json` — deps incl. `@trex/notebook: file:../notebook`.
- Create: `plugins/notebook-plugin/vite.config.ts` — lib/`system` build → sibyl public dir; tailwind; `@`/`@trex/notebook` aliases.
- Create: `plugins/notebook-plugin/tsconfig.json` — minimal Vue TS config.
- Create: `plugins/notebook-plugin/index.html` — dev harness.
- Create: `plugins/notebook-plugin/src/main.ts` — single-spa lifecycle (copied from jobs).
- Create: `plugins/notebook-plugin/src/NotebookApp.vue` — list⇄editor switch root.
- Create: `plugins/notebook-plugin/src/api/graphqlClient.ts` — tiny GraphQL client (copy of jobs).
- Create: `plugins/notebook-plugin/src/api/types.ts` — `NotebookSummary`, `NotebookDocument`.
- Create: `plugins/notebook-plugin/src/store/useNotebooksStore.ts` — Pinia CRUD store.
- Create: `plugins/notebook-plugin/src/views/NotebookListView.vue` — table + actions.
- Create: `plugins/notebook-plugin/src/views/NotebookEditorView.vue` — embeds `<Notebook>`.
- Create: `plugins/notebook-plugin/src/api/graphqlClient.spec.ts` — client unit test.
- Create: `plugins/notebook-plugin/src/store/useNotebooksStore.spec.ts` — store unit test.
- Create: `plugins/notebook-plugin/tests/e2e/notebook-crud.spec.ts` — Playwright smoke.

**Lib (`plugins/notebook`):**
- Modify: `plugins/notebook/package.json` — add `module`/`exports`/`types` fields pointing at `src/index.ts` so `@trex/notebook` resolves for type-check and tooling.

**Sibyl host:**
- Modify: `plugins/sibyl/public/config/plugins.json` — register `notebook-plugin`.

---

## Task 1: Backend — `notebook.document` table

**Files:**
- Create: `plugins/metadata-api/migrations/V2__notebook_document.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Stored notebooks. Distinct from notebook.analysis_definition (Strategus specs):
-- a `document` is a free-form notebook (cells + metadata) serialized into `content`.
CREATE TABLE IF NOT EXISTS notebook.document (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content     JSONB NOT NULL,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notebook_document_updated
    ON notebook.document(updated_at DESC);
```

- [ ] **Step 2: Sanity-check the SQL parses**

Run: `cat plugins/metadata-api/migrations/V2__notebook_document.sql`
Expected: file prints; it mirrors the column conventions of `V1__notebook_schema.sql` (UUID PK named `id`, `deleted_at` soft-delete, `updated_at DESC` index).

> NOTE: Migrations are **not** auto-applied. Applying V2 (and thus exposing
> `allNotebookDocuments` / `createNotebookDocument` / `updateNotebookDocumentByRowId`
> in GraphQL) happens during the trex migration run / redeploy. The plugin code is
> written against these PostGraphile names; they follow the exact pattern already
> verified for `notebook.analysis_definition` (the `id` PK surfaces as `rowId`).

- [ ] **Step 3: Commit**

```bash
git add plugins/metadata-api/migrations/V2__notebook_document.sql
git commit -m "feat(metadata-api): add notebook.document table for stored notebooks"
```

---

## Task 2: Make `@trex/notebook` resolvable as a lib

**Files:**
- Modify: `plugins/notebook/package.json`

- [ ] **Step 1: Add lib entry fields**

Add these top-level keys to `plugins/notebook/package.json` (alongside `"type": "module"`). The plugin bundles the notebook **from source** (Vite alias), but these fields make `@trex/notebook` resolve for `vue-tsc` type-checking and editor tooling:

```json
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/notebook/package.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add plugins/notebook/package.json
git commit -m "chore(notebook): expose src/index.ts as the @trex/notebook lib entry"
```

---

## Task 3: Scaffold the plugin and get an empty SystemJS build

**Files:**
- Create: `plugins/notebook-plugin/package.json`
- Create: `plugins/notebook-plugin/tsconfig.json`
- Create: `plugins/notebook-plugin/vite.config.ts`
- Create: `plugins/notebook-plugin/index.html`
- Create: `plugins/notebook-plugin/src/main.ts`
- Create: `plugins/notebook-plugin/src/NotebookApp.vue`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "notebook-plugin",
  "version": "0.1.0",
  "private": true,
  "description": "Create, store and run Python/R/Markdown notebooks inside sibyl",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@trex/notebook": "file:../notebook",
    "pinia": "^2.1.0",
    "vue": "^3.4.0",
    "vuetify": "^3.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.57.0",
    "@tailwindcss/vite": "^4.1.18",
    "@vitejs/plugin-vue": "^5.2.4",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^15.11.2",
    "single-spa-vue": "^3.0.0",
    "tailwindcss": "^4.1.18",
    "typescript": "^5.9.0",
    "vite": "^5.4.21",
    "vite-plugin-vuetify": "^2.0.0",
    "vitest": "^3.2.1",
    "vue-tsc": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["vite/client"],
    "paths": {
      "@/*": ["../notebook/src/*"],
      "@trex/notebook": ["../notebook/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

Mirrors `plugins/results-viewer/vite.config.mts` (lib/`system`, `vue` external, COOP/COEP dev headers for the Pyodide/WebR workers) plus tailwind and the aliases that let the notebook source compile here. `@` resolves the notebook's internal `@/...` imports; `@trex/notebook` resolves the lib entry.

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: 'none' }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // The notebook source uses the `@/...` alias internally; point it at the
      // notebook package so its components compile when bundled from source.
      '@': path.resolve(__dirname, '../notebook/src'),
      '@trex/notebook': path.resolve(__dirname, '../notebook/src/index.ts'),
    },
  },
  worker: { format: 'es' },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    cssCodeSplit: false,
    lib: {
      entry: './src/main.ts',
      formats: ['system'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue'],
      output: { format: 'system', globals: { vue: 'vue' } },
    },
    outDir: '../sibyl/public/plugins/notebook-plugin',
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.spec.ts'],
  },
});
```

- [ ] **Step 4: Write `index.html` (dev harness)**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Notebook Plugin (dev)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/dev.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `src/main.ts` (single-spa lifecycle, copied from jobs)**

```ts
import { h, createApp } from 'vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import singleSpaVue from 'single-spa-vue';
import NotebookApp from './NotebookApp.vue';

const CSS_LINK_ID = 'notebook-plugin-styles';
const MDI_LINK_ID = 'notebook-plugin-mdi';

function injectPluginCss(uiFilesUrl: string): void {
  if (document.getElementById(CSS_LINK_ID)) return;
  const base = uiFilesUrl
    ? uiFilesUrl.replace(/\/$/, '')
    : `${window.location.origin}/plugins/notebook-plugin`;
  const link = document.createElement('link');
  link.id = CSS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = base + '/style.css';
  document.head.appendChild(link);
}

function removePluginCss(): void {
  document.getElementById(CSS_LINK_ID)?.remove();
}

function injectMdiCss(): void {
  if (document.getElementById(MDI_LINK_ID)) return;
  if (typeof document.fonts !== 'undefined' && document.fonts.check && document.fonts.check('16px "Material Design Icons"')) {
    return;
  }
  const link = document.createElement('link');
  link.id = MDI_LINK_ID;
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7/css/materialdesignicons.min.css';
  document.head.appendChild(link);
}

export interface PluginProps {
  name: string;
  mountParcel: unknown;
  singleSpa: unknown;
  uiFilesUrl?: string;
  authContext: {
    user: { id: string; username: string; email?: string; permissions: string[] } | null;
    token: string | null;
    isAuthenticated: boolean;
    hasPermission: (permission: string) => boolean;
  };
  messageBus: {
    send: <T = unknown>(type: string, payload: T) => void;
    request: <TReq = unknown, TRes = unknown>(type: string, payload: TReq) => Promise<TRes>;
    subscribe: <T = unknown>(type: string, callback: (payload: T) => void) => () => void;
  };
}

function getSharedDefaults(): Record<string, Record<string, unknown>> {
  const config = (typeof window !== 'undefined')
    ? (window as unknown as { __atlasUiConfig?: { defaults?: Record<string, Record<string, unknown>> } }).__atlasUiConfig
    : undefined;
  if (config?.defaults) return config.defaults;
  return {
    VBtn: { variant: 'flat', color: 'primary', rounded: 'lg' },
    VCard: { variant: 'flat', rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'compact', rounded: 'md' },
    VSelect: { variant: 'outlined', density: 'compact', rounded: 'md' },
    VChip: { variant: 'tonal', rounded: 'md', density: 'compact' },
    VAlert: { variant: 'tonal', rounded: 'md' },
  };
}

const vuetify = createVuetify({
  theme: false as never,
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  defaults: getSharedDefaults(),
});

const vueLifecycles = singleSpaVue({
  createApp,
  appOptions: {
    render() {
      return h(NotebookApp);
    },
  },
  handleInstance(app) {
    const pinia = createPinia();
    app.use(pinia);
    app.use(vuetify);
  },
});

export const bootstrap = async (props: PluginProps) => {
  const baseUrl = props.uiFilesUrl ?? '';
  injectPluginCss(baseUrl);
  injectMdiCss();
  (window as unknown as { __notebookAuthUserId?: string | null }).__notebookAuthUserId =
    props.authContext?.user?.id ?? null;
  return vueLifecycles.bootstrap(props);
};

export const mount = vueLifecycles.mount;

export const unmount = async (props: PluginProps) => {
  const result = await vueLifecycles.unmount(props);
  removePluginCss();
  return result;
};
```

- [ ] **Step 6: Write a minimal `src/NotebookApp.vue` (placeholder for now)**

```vue
<template>
  <div class="notebook-plugin pa-4">
    <h2>Notebooks</h2>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.notebook-plugin { min-height: 200px; }
</style>
```

- [ ] **Step 7: Install dependencies**

Run: `cd plugins/notebook-plugin && npm install`
Expected: completes; `@trex/notebook` is linked from `../notebook`.

- [ ] **Step 8: Build and verify the SystemJS bundle is emitted**

Run: `cd plugins/notebook-plugin && npm run build`
Expected: build succeeds and `plugins/sibyl/public/plugins/notebook-plugin/index.system.js` exists.
Run: `ls plugins/sibyl/public/plugins/notebook-plugin/`
Expected: lists `index.system.js` (and `style.css` once styles are present).

- [ ] **Step 9: Commit**

```bash
git add plugins/notebook-plugin
git commit -m "feat(notebook-plugin): scaffold sibyl plugin with single-spa lifecycle and system build"
```

---

## Task 4: GraphQL client (TDD)

**Files:**
- Create: `plugins/notebook-plugin/src/api/graphqlClient.ts`
- Test: `plugins/notebook-plugin/src/api/graphqlClient.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { GraphqlClient, defaultGraphqlEndpoint } from "./graphqlClient";

describe("GraphqlClient", () => {
  it("POSTs query+variables to the endpoint with credentials and returns data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { allNotebookDocuments: { nodes: [{ rowId: "n1" }] } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const c = new GraphqlClient("http://x/trex/graphql");
    const data = await c.request<{ allNotebookDocuments: { nodes: { rowId: string }[] } }>(
      "query { allNotebookDocuments { nodes { rowId } } }", {});
    expect(data.allNotebookDocuments.nodes[0].rowId).toBe("n1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/trex/graphql");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });

  it("throws on a GraphQL errors array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ errors: [{ message: "boom" }] }),
    }));
    const c = new GraphqlClient("http://x/trex/graphql");
    await expect(c.request("query{x}", {})).rejects.toThrow("boom");
  });

  it("defaultGraphqlEndpoint targets /trex/graphql on the current origin", () => {
    expect(defaultGraphqlEndpoint().endsWith("/trex/graphql")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugins/notebook-plugin && npx vitest run src/api/graphqlClient.spec.ts`
Expected: FAIL — cannot resolve `./graphqlClient`.

- [ ] **Step 3: Write the implementation**

```ts
export class GraphqlClient {
  constructor(private endpoint: string) {}
  async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const resp = await fetch(this.endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!resp.ok) throw new Error(`graphql ${resp.status}`);
    const body = await resp.json();
    if (body.errors?.length) throw new Error(body.errors.map((e: { message: string }) => e.message).join("; "));
    return body.data as T;
  }
}
export const defaultGraphqlEndpoint = () => `${location.origin}/trex/graphql`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugins/notebook-plugin && npx vitest run src/api/graphqlClient.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/notebook-plugin/src/api/graphqlClient.ts plugins/notebook-plugin/src/api/graphqlClient.spec.ts
git commit -m "feat(notebook-plugin): add GraphQL client targeting /trex/graphql"
```

---

## Task 5: API types

**Files:**
- Create: `plugins/notebook-plugin/src/api/types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { NotebookData } from "@trex/notebook";

// PostGraphile exposes notebook.document.id as the GraphQL field `rowId`
// (the `id` field is the opaque Node global id). See the spec's "rowId gotcha".
export interface NotebookSummary {
  rowId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NotebookDocument extends NotebookSummary {
  content: NotebookData;
}

export interface NewNotebookInput {
  name: string;
  description: string;
  content: NotebookData;
  createdBy?: string | null;
}

export interface NotebookPatch {
  name?: string;
  description?: string;
  content?: NotebookData;
}
```

- [ ] **Step 2: Type-check**

Run: `cd plugins/notebook-plugin && npx vue-tsc --noEmit`
Expected: no errors (relies on Task 2's `@trex/notebook` exports and the tsconfig `paths`).

- [ ] **Step 3: Commit**

```bash
git add plugins/notebook-plugin/src/api/types.ts
git commit -m "feat(notebook-plugin): add notebook document API types"
```

---

## Task 6: Pinia store with GraphQL CRUD (TDD)

**Files:**
- Create: `plugins/notebook-plugin/src/store/useNotebooksStore.ts`
- Test: `plugins/notebook-plugin/src/store/useNotebooksStore.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useNotebooksStore } from "./useNotebooksStore";

const request = vi.fn();
vi.mock("../api/graphqlClient", () => ({
  defaultGraphqlEndpoint: () => "http://x/trex/graphql",
  GraphqlClient: class {
    request = request;
  },
}));

const emptyContent = { metadata: {}, cells: [] };

describe("useNotebooksStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetch lists non-deleted notebooks ordered by updatedAt desc (soft-deleted dropped client-side)", async () => {
    request.mockResolvedValue({
      allNotebookDocuments: {
        nodes: [
          { rowId: "n1", name: "A", description: "", createdAt: "t", updatedAt: "t", deletedAt: null },
          { rowId: "n2", name: "B", description: "", createdAt: "t", updatedAt: "t", deletedAt: "2026-06-01T00:00:00Z" },
        ],
      },
    });
    const s = useNotebooksStore();
    await s.fetch();
    expect(s.notebooks).toHaveLength(1);
    expect(s.notebooks[0].rowId).toBe("n1");
    const q = request.mock.calls[0][0];
    expect(q).toContain("allNotebookDocuments");
    expect(q).toContain("UPDATED_AT_DESC");
  });

  it("fetch records an error on failure", async () => {
    request.mockRejectedValue(new Error("boom"));
    const s = useNotebooksStore();
    await s.fetch();
    expect(s.error).toBe("boom");
    expect(s.notebooks).toHaveLength(0);
  });

  it("get fetches one notebook with its content via condition rowId", async () => {
    request.mockResolvedValue({
      allNotebookDocuments: {
        nodes: [{ rowId: "n1", name: "A", description: "", content: emptyContent, createdAt: "t", updatedAt: "t", deletedAt: null }],
      },
    });
    const s = useNotebooksStore();
    const doc = await s.get("n1");
    expect(doc.rowId).toBe("n1");
    expect(doc.content).toEqual(emptyContent);
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("condition");
    expect(vars.id).toBe("n1");
  });

  it("create sends a createNotebookDocument mutation and returns the new rowId", async () => {
    request.mockResolvedValue({ createNotebookDocument: { notebookDocument: { rowId: "new1" } } });
    const s = useNotebooksStore();
    const id = await s.create({ name: "My nb", description: "d", content: emptyContent, createdBy: "u1" });
    expect(id).toBe("new1");
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("createNotebookDocument");
    expect((vars.input as any).notebookDocument.name).toBe("My nb");
    expect((vars.input as any).notebookDocument.createdBy).toBe("u1");
  });

  it("update patches name/content and stamps updatedAt", async () => {
    request.mockResolvedValue({ updateNotebookDocumentByRowId: { notebookDocument: { rowId: "n1" } } });
    const s = useNotebooksStore();
    await s.update("n1", { name: "Renamed", content: emptyContent });
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("updateNotebookDocumentByRowId");
    expect(q).toContain("notebookDocumentPatch");
    expect(vars.id).toBe("n1");
    expect((vars.patch as any).name).toBe("Renamed");
    expect(typeof (vars.patch as any).updatedAt).toBe("string");
  });

  it("remove sends a soft-delete patch with an ISO timestamp then refetches", async () => {
    request
      .mockResolvedValueOnce({ updateNotebookDocumentByRowId: { notebookDocument: { rowId: "n1" } } })
      .mockResolvedValueOnce({ allNotebookDocuments: { nodes: [] } });
    const s = useNotebooksStore();
    await s.remove("n1");
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("updateNotebookDocumentByRowId");
    expect((vars.patch as any).deletedAt).toBeTruthy();
    expect(() => new Date((vars.patch as any).deletedAt).toISOString()).not.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("duplicate fetches the source then creates a copy named '<name> (copy)'", async () => {
    request
      .mockResolvedValueOnce({ allNotebookDocuments: { nodes: [{ rowId: "n1", name: "Orig", description: "d", content: emptyContent, createdAt: "t", updatedAt: "t", deletedAt: null }] } })
      .mockResolvedValueOnce({ createNotebookDocument: { notebookDocument: { rowId: "copy1" } } });
    const s = useNotebooksStore();
    const id = await s.duplicate("n1");
    expect(id).toBe("copy1");
    const createVars = request.mock.calls[1][1];
    expect((createVars.input as any).notebookDocument.name).toBe("Orig (copy)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugins/notebook-plugin && npx vitest run src/store/useNotebooksStore.spec.ts`
Expected: FAIL — cannot resolve `./useNotebooksStore`.

- [ ] **Step 3: Write the implementation**

```ts
import { defineStore } from "pinia";
import { ref } from "vue";
import type { NotebookData } from "@trex/notebook";
import type { NotebookSummary, NotebookDocument, NewNotebookInput, NotebookPatch } from "../api/types";
import { GraphqlClient, defaultGraphqlEndpoint } from "../api/graphqlClient";

const LIST = `query {
  allNotebookDocuments(orderBy: UPDATED_AT_DESC) {
    nodes { rowId name description createdAt updatedAt deletedAt }
  }
}`;

const GET = `query($id: UUID!) {
  allNotebookDocuments(condition: { rowId: $id }) {
    nodes { rowId name description content createdAt updatedAt deletedAt }
  }
}`;

const CREATE = `mutation($input: CreateNotebookDocumentInput!) {
  createNotebookDocument(input: $input) {
    notebookDocument { rowId }
  }
}`;

const UPDATE = `mutation($id: UUID!, $patch: NotebookDocumentPatch!) {
  updateNotebookDocumentByRowId(input: { rowId: $id, notebookDocumentPatch: $patch }) {
    notebookDocument { rowId }
  }
}`;

function currentUserId(): string | null {
  return (window as unknown as { __notebookAuthUserId?: string | null }).__notebookAuthUserId ?? null;
}

export const useNotebooksStore = defineStore("notebooks", () => {
  const gql = new GraphqlClient(defaultGraphqlEndpoint());
  const notebooks = ref<NotebookSummary[]>([]);
  const error = ref<string | null>(null);

  async function fetch(): Promise<void> {
    try {
      const d = await gql.request<{ allNotebookDocuments: { nodes: NotebookSummary[] } }>(LIST);
      notebooks.value = d.allNotebookDocuments.nodes.filter((n) => n.deletedAt == null);
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function get(id: string): Promise<NotebookDocument> {
    const d = await gql.request<{ allNotebookDocuments: { nodes: NotebookDocument[] } }>(GET, { id });
    const node = d.allNotebookDocuments.nodes[0];
    if (!node) throw new Error("Notebook not found");
    return node;
  }

  async function create(input: NewNotebookInput): Promise<string> {
    const d = await gql.request<{ createNotebookDocument: { notebookDocument: { rowId: string } } }>(CREATE, {
      input: {
        notebookDocument: {
          name: input.name,
          description: input.description,
          content: input.content,
          createdBy: input.createdBy ?? currentUserId(),
        },
      },
    });
    await fetch();
    return d.createNotebookDocument.notebookDocument.rowId;
  }

  async function update(id: string, patch: NotebookPatch): Promise<void> {
    await gql.request(UPDATE, { id, patch: { ...patch, updatedAt: new Date().toISOString() } });
    await fetch();
  }

  async function remove(id: string): Promise<void> {
    await gql.request(UPDATE, { id, patch: { deletedAt: new Date().toISOString() } });
    await fetch();
  }

  async function duplicate(id: string): Promise<string> {
    const src = await get(id);
    return create({
      name: `${src.name} (copy)`,
      description: src.description,
      content: src.content as NotebookData,
    });
  }

  return { notebooks, error, fetch, get, create, update, remove, duplicate };
});
```

> NOTE: `update`/`remove` accept an extra `updatedAt`/`deletedAt` field in the
> patch object; the typed `NotebookPatch` covers the user-facing fields and the
> store adds the timestamp. The GraphQL input type names
> (`CreateNotebookDocumentInput`, `NotebookDocumentPatch`) follow the PostGraphile
> convention already verified for `NotebookAnalysisDefinition`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugins/notebook-plugin && npx vitest run src/store/useNotebooksStore.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/notebook-plugin/src/store/useNotebooksStore.ts plugins/notebook-plugin/src/store/useNotebooksStore.spec.ts
git commit -m "feat(notebook-plugin): add Pinia store with GraphQL CRUD for notebooks"
```

---

## Task 7: Notebook list view

**Files:**
- Create: `plugins/notebook-plugin/src/views/NotebookListView.vue`

- [ ] **Step 1: Write the component**

```vue
<template>
  <div class="notebook-list">
    <div class="d-flex align-center mb-4">
      <h2 class="text-h6">Notebooks</h2>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="emit('new')">New notebook</v-btn>
    </div>

    <v-alert v-if="store.error" type="error" class="mb-4">{{ store.error }}</v-alert>

    <v-data-table
      :headers="headers"
      :items="store.notebooks"
      :loading="loading"
      item-value="rowId"
      density="comfortable"
    >
      <template #item.name="{ item }">
        <a class="text-primary" style="cursor: pointer" @click="emit('open', item.rowId)">{{ item.name }}</a>
      </template>
      <template #item.updatedAt="{ item }">{{ formatDate(item.updatedAt) }}</template>
      <template #item.actions="{ item }">
        <v-btn icon="mdi-pencil" variant="text" size="small" title="Rename" @click="rename(item)" />
        <v-btn icon="mdi-content-copy" variant="text" size="small" title="Duplicate" @click="duplicate(item.rowId)" />
        <v-btn icon="mdi-delete" variant="text" size="small" title="Delete" @click="remove(item)" />
      </template>
      <template #no-data>No notebooks yet. Create one with "New notebook".</template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useNotebooksStore } from "../store/useNotebooksStore";
import type { NotebookSummary } from "../api/types";

const emit = defineEmits<{ (e: "open", id: string): void; (e: "new"): void }>();

const store = useNotebooksStore();
const loading = ref(false);

const headers = [
  { title: "Name", key: "name" },
  { title: "Description", key: "description" },
  { title: "Updated", key: "updatedAt" },
  { title: "", key: "actions", sortable: false, align: "end" as const },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

async function reload(): Promise<void> {
  loading.value = true;
  await store.fetch();
  loading.value = false;
}

async function rename(item: NotebookSummary): Promise<void> {
  const name = window.prompt("Rename notebook", item.name);
  if (name && name !== item.name) await store.update(item.rowId, { name });
}

async function duplicate(id: string): Promise<void> {
  await store.duplicate(id);
}

async function remove(item: NotebookSummary): Promise<void> {
  if (window.confirm(`Delete "${item.name}"?`)) await store.remove(item.rowId);
}

onMounted(reload);
</script>

<style scoped>
.notebook-list { padding: 4px; }
</style>
```

- [ ] **Step 2: Type-check**

Run: `cd plugins/notebook-plugin && npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add plugins/notebook-plugin/src/views/NotebookListView.vue
git commit -m "feat(notebook-plugin): add notebook list view with rename/duplicate/delete"
```

---

## Task 8: Notebook editor view (embeds `@trex/notebook`)

**Files:**
- Create: `plugins/notebook-plugin/src/views/NotebookEditorView.vue`

- [ ] **Step 1: Write the component**

```vue
<template>
  <div class="notebook-editor">
    <div class="d-flex align-center mb-3" style="gap: 8px;">
      <v-btn icon="mdi-arrow-left" variant="text" title="Back" @click="emit('back')" />
      <v-text-field
        v-model="name"
        label="Name"
        hide-details
        density="compact"
        style="max-width: 320px;"
      />
      <v-text-field
        v-model="description"
        label="Description"
        hide-details
        density="compact"
      />
      <v-spacer />
      <v-chip v-if="dirty" color="warning" size="small">Unsaved</v-chip>
      <v-btn color="primary" :loading="saving" :disabled="!name" @click="save">Save</v-btn>
    </div>

    <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>

    <Notebook
      v-if="ready"
      :initial-data="initialData"
      :kernels="kernels"
      :default-kernel-config="{ type: 'pyodide' }"
      :on-change="onChange"
    />
    <div v-else class="text-medium-emphasis">Loading…</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, shallowRef } from "vue";
import {
  Notebook,
  PyodideKernel,
  WebRKernel,
  createEmptyNotebook,
} from "@trex/notebook";
import type { NotebookData } from "@trex/notebook";
import { useNotebooksStore } from "../store/useNotebooksStore";

const props = defineProps<{ id: string | null }>();
const emit = defineEmits<{ (e: "back"): void; (e: "saved", id: string): void }>();

const store = useNotebooksStore();
const kernels = [new PyodideKernel(), new WebRKernel()];

const ready = ref(false);
const saving = ref(false);
const dirty = ref(false);
const error = ref<string | null>(null);
const name = ref("Untitled notebook");
const description = ref("");
const initialData = shallowRef<NotebookData>(createEmptyNotebook());
const current = shallowRef<NotebookData>(initialData.value);
const docId = ref<string | null>(props.id);

function onChange(data: NotebookData): void {
  current.value = data;
  dirty.value = true;
}

async function load(): Promise<void> {
  if (props.id) {
    try {
      const doc = await store.get(props.id);
      name.value = doc.name;
      description.value = doc.description;
      initialData.value = doc.content;
      current.value = doc.content;
      docId.value = doc.rowId;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }
  ready.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    if (docId.value) {
      await store.update(docId.value, {
        name: name.value,
        description: description.value,
        content: current.value,
      });
    } else {
      docId.value = await store.create({
        name: name.value,
        description: description.value,
        content: current.value,
      });
    }
    dirty.value = false;
    emit("saved", docId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.notebook-editor { padding: 4px; }
</style>
```

- [ ] **Step 2: Type-check**

Run: `cd plugins/notebook-plugin && npx vue-tsc --noEmit`
Expected: no errors (resolves `Notebook`, `PyodideKernel`, `WebRKernel`, `createEmptyNotebook`, `NotebookData` from `@trex/notebook`).

- [ ] **Step 3: Commit**

```bash
git add plugins/notebook-plugin/src/views/NotebookEditorView.vue
git commit -m "feat(notebook-plugin): add editor view embedding the notebook component with save"
```

---

## Task 9: Wire `NotebookApp.vue` (list ⇄ editor)

**Files:**
- Modify: `plugins/notebook-plugin/src/NotebookApp.vue`

- [ ] **Step 1: Replace the placeholder with the real root**

```vue
<template>
  <v-app class="notebook-plugin">
    <v-main>
      <div class="pa-4">
        <NotebookListView
          v-if="view === 'list'"
          @open="openNotebook"
          @new="newNotebook"
        />
        <NotebookEditorView
          v-else
          :id="activeId"
          @back="goToList"
          @saved="onSaved"
        />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from "vue";
import NotebookListView from "./views/NotebookListView.vue";
import NotebookEditorView from "./views/NotebookEditorView.vue";

const view = ref<"list" | "editor">("list");
const activeId = ref<string | null>(null);

function openNotebook(id: string): void {
  activeId.value = id;
  view.value = "editor";
}

function newNotebook(): void {
  activeId.value = null;
  view.value = "editor";
}

function goToList(): void {
  view.value = "list";
}

function onSaved(id: string): void {
  activeId.value = id;
}
</script>

<style scoped>
.notebook-plugin { background: transparent; }
</style>
```

- [ ] **Step 2: Type-check and build**

Run: `cd plugins/notebook-plugin && npx vue-tsc --noEmit && npm run build`
Expected: type-check passes; build emits `plugins/sibyl/public/plugins/notebook-plugin/index.system.js` and `style.css`.

- [ ] **Step 3: Run all unit tests**

Run: `cd plugins/notebook-plugin && npm test`
Expected: PASS (graphqlClient 3 + store 7 = 10 tests).

- [ ] **Step 4: Commit**

```bash
git add plugins/notebook-plugin/src/NotebookApp.vue
git commit -m "feat(notebook-plugin): wire list and editor views in the app root"
```

---

## Task 10: Register the plugin in sibyl

**Files:**
- Modify: `plugins/sibyl/public/config/plugins.json`

- [ ] **Step 1: Add the `notebook-plugin` entry**

Insert this object into the `plugins` array (e.g. after the `strategus-plugin` entry):

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
    },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/sibyl/public/config/plugins.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add plugins/sibyl/public/config/plugins.json
git commit -m "feat(sibyl): register notebook-plugin in plugins.json"
```

---

## Task 11: Playwright e2e smoke (in sibyl dev)

**Files:**
- Create: `plugins/notebook-plugin/tests/e2e/notebook-crud.spec.ts`
- Create: `plugins/notebook-plugin/playwright.config.ts`

> NOTE: This smoke drives the **sibyl dev server** with the plugin built into its
> public dir. It exercises list → new → save → reopen → delete against a running
> trex backend (the same one sibyl's own e2e uses). If no backend is available in
> CI, mark the spec `test.skip` behind an env flag (`NOTEBOOK_E2E=1`) so the suite
> stays green — mirror how `plugins/sibyl` gates its fixture-backed e2e.

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.SIBYL_URL ?? "http://localhost:5174",
    headless: true,
  },
});
```

- [ ] **Step 2: Write the smoke spec**

```ts
import { test, expect } from "@playwright/test";

const RUN = process.env.NOTEBOOK_E2E === "1";

test.describe("notebook-plugin CRUD", () => {
  test.skip(!RUN, "set NOTEBOOK_E2E=1 with a running sibyl+trex to run");

  test("create, save, reopen and delete a notebook", async ({ page }) => {
    await page.goto("/plugins/notebook-plugin/");

    await page.getByRole("button", { name: "New notebook" }).click();
    const nameField = page.getByLabel("Name");
    await nameField.fill("E2E Notebook");
    await page.getByRole("button", { name: "Save" }).click();

    // Back to list, the new notebook is listed.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("E2E Notebook")).toBeVisible();

    // Reopen it.
    await page.getByText("E2E Notebook").click();
    await expect(page.getByLabel("Name")).toHaveValue("E2E Notebook");
    await page.getByRole("button", { name: "Back" }).click();

    // Delete it (auto-accept the confirm dialog).
    page.on("dialog", (d) => d.accept());
    await page
      .getByRole("row", { name: /E2E Notebook/ })
      .getByTitle("Delete")
      .click();
    await expect(page.getByText("E2E Notebook")).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Verify the spec is collected (skipped without the env flag)**

Run: `cd plugins/notebook-plugin && npx playwright test --list`
Expected: lists `notebook-crud.spec.ts` (the test is skipped unless `NOTEBOOK_E2E=1`).

- [ ] **Step 4: Commit**

```bash
git add plugins/notebook-plugin/tests/e2e/notebook-crud.spec.ts plugins/notebook-plugin/playwright.config.ts
git commit -m "test(notebook-plugin): add Playwright CRUD smoke (env-gated)"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full plugin gate**

Run: `cd plugins/notebook-plugin && npx vue-tsc --noEmit && npm test && npm run build`
Expected: type-check clean, 10 unit tests pass, build emits `index.system.js` + `style.css` into `plugins/sibyl/public/plugins/notebook-plugin/`.

- [ ] **Step 2: Confirm sibyl can see the bundle and config**

Run: `ls plugins/sibyl/public/plugins/notebook-plugin/ && node -e "const c=require('./plugins/sibyl/public/config/plugins.json'); console.log(c.plugins.map(p=>p.id).join(','))"`
Expected: bundle files listed; plugin id list includes `notebook-plugin`.

- [ ] **Step 3: Manual smoke (optional, needs running stack)**

Per `plugins/sibyl/README.md`, run sibyl against a trex backend (apply the V2 migration first), open the Notebooks menu, create/save/reopen/delete a notebook. Confirm Pyodide executes a `print("hi")` cell (validates COOP/COEP + workers under the plugin mount).

---

## Self-Review Notes

- **Spec coverage:** table (Task 1), plugin scaffold/build (Task 3), lib consumption (Tasks 2–3), GraphQL client (Task 4), CRUD store incl. duplicate + soft-delete (Task 6), list view with rename/duplicate/delete + new (Task 7), editor with embedded notebook + explicit Save + editable name/description (Task 8), navigation (Task 9), sibyl registration (Task 10), unit + e2e tests (Tasks 4/6/11). All spec sections map to a task.
- **Risks tracked:** COOP/COEP + workers validated in Task 12 Step 3 (precedent: results-viewer); tailwind bundling handled in the Task 3 vite config; `vue` externalized; `created_by` sourced from `authContext` via `window.__notebookAuthUserId` (set in `main.ts` bootstrap, read in the store).
- **Type consistency:** store methods (`fetch/get/create/update/remove/duplicate`) and types (`NotebookSummary`, `NotebookDocument`, `NewNotebookInput`, `NotebookPatch`) are used consistently across Tasks 5–9. GraphQL operation names match across store and tests.
