import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { GraphqlClient, defaultGraphqlEndpoint } from '../api/graphqlClient';
import { deserializeSpec } from '../services/SpecDeserializer';
import { serializeSpec } from '../services/SpecSerializer';
import { useStrategusStore } from './useStrategusStore';
import type { AnalysisSpecification } from '../models/AnalysisSpec';

// Minimal shape of the strategus editor store that save/serialize need. Kept
// structural so the store actions are unit-testable with a lightweight stub.
interface StrategusLike {
  studyName: string;
  description: string;
  snapshot: () => Record<string, unknown>;
}

// Fetch a single server-stored definition by our uuid PK. PostGraphile exposes
// the uuid `id` column as `rowId` (the `id` field is the opaque Node global id),
// so we select it via the list query's `condition: { rowId }` form rather than the
// single-fetch `notebookAnalysisDefinition(id:)` which wants the Node id.
const GET_DEFINITION = `query($id: UUID!) {
  allNotebookAnalysisDefinitions(condition: { rowId: $id }) {
    nodes { rowId name description spec }
  }
}`;

// Schema-prefixed PostGraphile mutations for notebook.analysis_definition
// (verified live: create/updateByRowId/deleteByRowId, *Patch arg).
const CREATE_DEFINITION = `mutation($name: String!, $description: String!, $spec: JSON!) {
  createNotebookAnalysisDefinition(input: { notebookAnalysisDefinition: { name: $name, description: $description, spec: $spec } }) {
    notebookAnalysisDefinition { rowId }
  }
}`;
const UPDATE_DEFINITION = `mutation($id: UUID!, $name: String!, $description: String!, $spec: JSON!) {
  updateNotebookAnalysisDefinitionByRowId(input: { rowId: $id, notebookAnalysisDefinitionPatch: { name: $name, description: $description, spec: $spec } }) {
    clientMutationId
  }
}`;
const DELETE_DEFINITION = `mutation($id: UUID!) {
  deleteNotebookAnalysisDefinitionByRowId(input: { rowId: $id }) {
    clientMutationId
  }
}`;

interface ServerDefinition {
  rowId: string;
  name: string;
  description: string;
  spec: AnalysisSpecification;
}

export interface StudyRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /** rowId of the server-persisted analysis_definition, once saved to the server. */
  serverId?: string;
  /**
   * Snapshot of the full strategus store state at save time.
   * Stored as serialized JSON-safe object — the editor restores
   * fields onto useStrategusStore when opening this study.
   */
  state: Record<string, unknown>;
}

const STORAGE_KEY = 'strategus-plugin:studies';

function loadFromStorage(): StudyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(studies: StudyRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studies));
  } catch {
    // localStorage may be full or unavailable — silently skip
  }
}

function generateId(): string {
  return `study-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PluginMode = 'list' | 'editor';

export const useStudiesStore = defineStore('strategus-studies', () => {
  const studies = ref<StudyRecord[]>(loadFromStorage());
  const mode = ref<PluginMode>('list');
  const currentStudyId = ref<string | null>(null);
  // rowId of the server definition backing the open study (null until saved to
  // server / when a fresh study has never been persisted). Drives create-vs-update.
  const currentServerId = ref<string | null>(null);
  const searchTerm = ref('');

  const filteredStudies = computed(() => {
    const q = searchTerm.value.trim().toLowerCase();
    if (!q) return studies.value;
    return studies.value.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  });

  function persist(): void {
    saveToStorage(studies.value);
  }

  function createStudy(state: Record<string, unknown>, name = 'Untitled study', description = ''): StudyRecord {
    const now = new Date().toISOString();
    const study: StudyRecord = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      state,
    };
    studies.value = [study, ...studies.value];
    persist();
    return study;
  }

  function updateStudy(id: string, patch: Partial<Omit<StudyRecord, 'id' | 'createdAt'>>): void {
    const idx = studies.value.findIndex((s) => s.id === id);
    if (idx < 0) return;
    studies.value[idx] = {
      ...studies.value[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    persist();
  }

  function deleteStudy(id: string): void {
    studies.value = studies.value.filter((s) => s.id !== id);
    if (currentStudyId.value === id) {
      currentStudyId.value = null;
      mode.value = 'list';
    }
    persist();
  }

  function duplicateStudy(id: string): StudyRecord | null {
    const original = studies.value.find((s) => s.id === id);
    if (!original) return null;
    return createStudy(original.state, `${original.name} (copy)`, original.description);
  }

  function openStudy(id: string): StudyRecord | null {
    const study = studies.value.find((s) => s.id === id);
    if (!study) return null;
    currentStudyId.value = id;
    currentServerId.value = study.serverId ?? null;
    mode.value = 'editor';
    return study;
  }

  function openNew(): void {
    currentStudyId.value = null;
    currentServerId.value = null;
    mode.value = 'editor';
  }

  function closeEditor(): void {
    currentStudyId.value = null;
    currentServerId.value = null;
    mode.value = 'list';
  }

  /**
   * Persist the open study: snapshot the editor to a local study (create or
   * update by currentStudyId), then upsert the server analysis_definition
   * (create when there's no currentServerId, else update by rowId). The returned
   * rowId is tracked as currentServerId and persisted on the local record so a
   * later save updates the same definition instead of duplicating it.
   */
  async function saveCurrent(strategus: StrategusLike): Promise<StudyRecord> {
    const name = (strategus.studyName || '').trim() || 'Untitled study';
    const description = strategus.description || '';
    const state = strategus.snapshot();

    // Local upsert
    let id = currentStudyId.value;
    if (id && studies.value.some((s) => s.id === id)) {
      updateStudy(id, { name, description, state });
    } else {
      id = createStudy(state, name, description).id;
      currentStudyId.value = id;
    }

    // Server upsert
    const spec = serializeSpec(strategus as unknown as Parameters<typeof serializeSpec>[0]);
    const gql = new GraphqlClient(defaultGraphqlEndpoint());
    if (currentServerId.value) {
      await gql.request(UPDATE_DEFINITION, { id: currentServerId.value, name, description, spec });
    } else {
      const data = await gql.request<{
        createNotebookAnalysisDefinition: { notebookAnalysisDefinition: { rowId: string } };
      }>(CREATE_DEFINITION, { name, description, spec });
      currentServerId.value = data.createNotebookAnalysisDefinition.notebookAnalysisDefinition.rowId;
    }

    updateStudy(id, { serverId: currentServerId.value ?? undefined });
    return studies.value.find((s) => s.id === id) as StudyRecord;
  }

  /**
   * Delete the open study: remove the server definition (if it was saved), the
   * local record, and return to the list.
   */
  async function deleteCurrent(): Promise<void> {
    if (currentServerId.value) {
      const gql = new GraphqlClient(defaultGraphqlEndpoint());
      await gql.request(DELETE_DEFINITION, { id: currentServerId.value });
      currentServerId.value = null;
    }
    if (currentStudyId.value) deleteStudy(currentStudyId.value);
    closeEditor();
  }

  /**
   * Fetch a server-stored analysis definition by its rowId (uuid) over GraphQL
   * and hydrate the strategus editor with it. Reuses the same store-hydration
   * path as the local "Import JSON" / open-study flow: the server `spec` is an
   * AnalysisSpecification, exactly the shape `deserializeSpec` accepts. After
   * hydration we switch into editor mode so the deep-link lands on the editor.
   * Returns the fetched definition, or null if not found.
   */
  async function loadServerDefinition(id: string): Promise<ServerDefinition | null> {
    const gql = new GraphqlClient(defaultGraphqlEndpoint());
    const data = await gql.request<{
      allNotebookAnalysisDefinitions: { nodes: ServerDefinition[] };
    }>(GET_DEFINITION, { id });
    const def = data.allNotebookAnalysisDefinitions.nodes[0];
    if (!def) return null;

    const strategus = useStrategusStore();
    deserializeSpec(def.spec, strategus);
    if (typeof def.name === 'string' && def.name) strategus.studyName = def.name;
    if (typeof def.description === 'string') strategus.description = def.description;

    currentStudyId.value = null;
    // Track the server rowId so an in-editor Save updates this definition
    // instead of creating a duplicate.
    currentServerId.value = def.rowId;
    mode.value = 'editor';
    return def;
  }

  return {
    studies,
    mode,
    currentStudyId,
    currentServerId,
    searchTerm,
    filteredStudies,
    createStudy,
    updateStudy,
    deleteStudy,
    duplicateStudy,
    openStudy,
    openNew,
    closeEditor,
    saveCurrent,
    deleteCurrent,
    loadServerDefinition,
  };
});
