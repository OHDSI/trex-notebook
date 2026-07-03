import { defineStore, createPinia } from 'pinia';
import { ref } from 'vue';
import { GraphqlClient, defaultGraphqlEndpoint } from '../api/graphqlClient';
import { deserializeSpec } from '../services/SpecDeserializer';
import { serializeSpec } from '../services/SpecSerializer';
import { useStrategusStore } from './useStrategusStore';
import type { AnalysisSpecification } from '../models/AnalysisSpec';

// Minimal shape of the strategus editor store that save/load/serialize need.
// Kept structural so the store actions are unit-testable with a lightweight stub.
interface StrategusLike {
  studyName: string;
  description: string;
}

// Fetch a single server-stored definition by our uuid PK. PostGraphile exposes
// the uuid `id` column as `rowId` (the `id` field is the opaque Node global id),
// so we select it via the list query's `condition: { rowId }` form rather than the
// single-fetch `notebookAnalysisDefinition(id:)` which wants the Node id.
const LIST_DEFINITIONS = `query {
  allNotebookAnalysisDefinitions(orderBy: UPDATED_AT_DESC) {
    nodes { rowId name description updatedAt deletedAt }
  }
}`;

const GET_DEFINITION = `query($id: UUID!) {
  allNotebookAnalysisDefinitions(condition: { rowId: $id }) {
    nodes { rowId name description spec }
  }
}`;

// Schema-prefixed PostGraphile mutations for notebook.analysis_definition
// (verified live: create/updateByRowId, *Patch arg). Update uses the generic
// patch input so both a partial field save and a soft-delete (`deletedAt`
// only) go through the same mutation string.
const CREATE_DEFINITION = `mutation($name: String!, $description: String!, $spec: JSON!) {
  createNotebookAnalysisDefinition(input: { notebookAnalysisDefinition: { name: $name, description: $description, spec: $spec } }) {
    notebookAnalysisDefinition { rowId }
  }
}`;
const UPDATE_DEFINITION = `mutation($id: UUID!, $patch: NotebookAnalysisDefinitionPatch!) {
  updateNotebookAnalysisDefinitionByRowId(input: { rowId: $id, notebookAnalysisDefinitionPatch: $patch }) {
    clientMutationId
  }
}`;

interface ServerDefinition {
  rowId: string;
  name: string;
  description: string;
  spec: AnalysisSpecification;
}

interface ServerSummaryNode {
  rowId: string;
  name: string;
  description: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface StudySummary {
  rowId: string;
  name: string;
  description: string;
  updatedAt: string;
}

/** Shape of a study record from the retired localStorage persistence, kept
 * only to drive the one-time migration below. */
interface LegacyStudyRecord {
  name?: string;
  description?: string;
  serverId?: string;
  state?: Record<string, unknown>;
}

const LEGACY_STORAGE_KEY = 'strategus-plugin:studies';

export type PluginMode = 'list' | 'editor';

export const useStudiesStore = defineStore('strategus-studies', () => {
  const mode = ref<PluginMode>('list');
  const currentRowId = ref<string | null>(null);

  let migrated = false;

  // One-time best-effort migration of studies persisted under the old
  // localStorage scheme to server-backed analysis_definition rows. Any record
  // that already carries a serverId was migrated previously and is skipped.
  // Failures (bad JSON, network) must never block listing, so this swallows
  // all errors; the key is cleared up front so a poison record can't retry
  // forever.
  async function migrateLegacyLocalStorage(): Promise<void> {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      const records: unknown = JSON.parse(raw);
      if (!Array.isArray(records)) return;

      const gql = new GraphqlClient(defaultGraphqlEndpoint());
      for (const rec of records as LegacyStudyRecord[]) {
        if (!rec || typeof rec !== 'object' || rec.serverId) continue;
        try {
          const name = (typeof rec.name === 'string' && rec.name.trim()) || 'Untitled study';
          const description = typeof rec.description === 'string' ? rec.description : '';
          // A legacy `state` is the raw editor snapshot, NOT an AnalysisSpecification.
          // Restore it onto an isolated store (its own pinia, so the live editor is
          // untouched) and run it through serializeSpec to produce a valid spec.
          const scratch = useStrategusStore(createPinia());
          scratch.restore(rec.state ?? {});
          const spec = serializeSpec(scratch as unknown as Parameters<typeof serializeSpec>[0]);
          await gql.request(CREATE_DEFINITION, { name, description, spec });
        } catch {
          // best-effort per record: skip a study that fails to restore/serialize/create
        }
      }
    } catch {
      // best-effort; a failed migration must not break listing
    }
  }

  async function listStudies(): Promise<StudySummary[]> {
    if (!migrated) {
      migrated = true;
      await migrateLegacyLocalStorage();
    }

    const gql = new GraphqlClient(defaultGraphqlEndpoint());
    const data = await gql.request<{ allNotebookAnalysisDefinitions: { nodes: ServerSummaryNode[] } }>(
      LIST_DEFINITIONS
    );
    return data.allNotebookAnalysisDefinitions.nodes
      .filter((n) => n.deletedAt == null)
      .map((n) => ({ rowId: n.rowId, name: n.name, description: n.description, updatedAt: n.updatedAt }));
  }

  /**
   * Fetch a server-stored analysis definition by its rowId (uuid) over GraphQL
   * and hydrate the strategus editor with it, then switch into editor mode.
   */
  async function openStudy(rowId: string): Promise<void> {
    const gql = new GraphqlClient(defaultGraphqlEndpoint());
    const data = await gql.request<{ allNotebookAnalysisDefinitions: { nodes: ServerDefinition[] } }>(
      GET_DEFINITION,
      { id: rowId }
    );
    const def = data.allNotebookAnalysisDefinitions.nodes[0];
    if (!def) return;

    const strategus = useStrategusStore();
    deserializeSpec(def.spec, strategus as unknown as Parameters<typeof deserializeSpec>[1]);
    if (typeof def.name === 'string' && def.name) strategus.studyName = def.name;
    if (typeof def.description === 'string') strategus.description = def.description;

    currentRowId.value = rowId;
    mode.value = 'editor';
  }

  function openNew(): void {
    currentRowId.value = null;
    mode.value = 'editor';
  }

  function closeEditor(): void {
    currentRowId.value = null;
    mode.value = 'list';
  }

  /**
   * Persist the open study to the server: create when there's no
   * currentRowId, else update the existing definition by rowId. The returned
   * rowId is tracked as currentRowId so a later save updates the same
   * definition instead of creating a duplicate.
   */
  async function saveCurrent(): Promise<string> {
    const strategus = useStrategusStore() as unknown as StrategusLike;
    const name = (strategus.studyName || '').trim() || 'Untitled study';
    const description = strategus.description || '';
    const spec = serializeSpec(strategus as unknown as Parameters<typeof serializeSpec>[0]);

    const gql = new GraphqlClient(defaultGraphqlEndpoint());
    if (!currentRowId.value) {
      const data = await gql.request<{
        createNotebookAnalysisDefinition: { notebookAnalysisDefinition: { rowId: string } };
      }>(CREATE_DEFINITION, { name, description, spec });
      currentRowId.value = data.createNotebookAnalysisDefinition.notebookAnalysisDefinition.rowId;
    } else {
      await gql.request(UPDATE_DEFINITION, {
        id: currentRowId.value,
        patch: { name, description, spec, updatedAt: new Date().toISOString() },
      });
    }
    return currentRowId.value;
  }

  /** Soft-delete the open study on the server (patch `deletedAt`), then return to the list. */
  async function deleteCurrent(): Promise<void> {
    if (currentRowId.value) {
      const gql = new GraphqlClient(defaultGraphqlEndpoint());
      await gql.request(UPDATE_DEFINITION, {
        id: currentRowId.value,
        patch: { deletedAt: new Date().toISOString() },
      });
    }
    closeEditor();
  }

  return {
    mode,
    currentRowId,
    listStudies,
    openStudy,
    openNew,
    closeEditor,
    saveCurrent,
    deleteCurrent,
  };
});
