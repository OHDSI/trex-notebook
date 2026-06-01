import { defineStore } from "pinia";
import { ref } from "vue";
import type { AnalysisDefinition } from "../api/metadataTypes";
import { GraphqlClient, defaultGraphqlEndpoint } from "../api/graphqlClient";

// Schema-prefixed postgraphile names (see notes 2026-06-01-metadata-write-path).
// NOTE: `filter` only exposes rowId/updatedAt (NOT deletedAt), so soft-deleted
// rows are dropped CLIENT-SIDE. `deletedAt` is still selected as a node field.
const LIST = `query {
  allNotebookAnalysisDefinitions(orderBy: UPDATED_AT_DESC) {
    nodes { rowId name description createdAt updatedAt deletedAt }
  }
}`;

const GET = `query($id: UUID!) {
  allNotebookAnalysisDefinitions(condition: { rowId: $id }) {
    nodes { rowId name description spec }
  }
}`;

const DELETE = `mutation($id: UUID!, $ts: Datetime!) {
  updateNotebookAnalysisDefinitionByRowId(
    input: { rowId: $id, notebookAnalysisDefinitionPatch: { deletedAt: $ts } }
  ) {
    notebookAnalysisDefinition { rowId }
  }
}`;

export const useDefinitionsStore = defineStore("definitions", () => {
  const gql = new GraphqlClient(defaultGraphqlEndpoint());
  const definitions = ref<AnalysisDefinition[]>([]);
  const error = ref<string | null>(null);

  async function fetch(): Promise<void> {
    try {
      const d = await gql.request<{
        allNotebookAnalysisDefinitions: { nodes: AnalysisDefinition[] };
      }>(LIST);
      definitions.value = d.allNotebookAnalysisDefinitions.nodes.filter(
        (n) => n.deletedAt == null,
      );
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function get(id: string): Promise<AnalysisDefinition> {
    const d = await gql.request<{
      allNotebookAnalysisDefinitions: { nodes: AnalysisDefinition[] };
    }>(GET, { id });
    return d.allNotebookAnalysisDefinitions.nodes[0];
  }

  async function remove(id: string): Promise<void> {
    await gql.request(DELETE, { id, ts: new Date().toISOString() });
    await fetch();
  }

  return { definitions, error, fetch, get, remove };
});
