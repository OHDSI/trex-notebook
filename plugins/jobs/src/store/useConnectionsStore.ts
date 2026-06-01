import { defineStore } from "pinia";
import { ref } from "vue";
import type { CdmConnection } from "../api/metadataTypes";
import { GraphqlClient, defaultGraphqlEndpoint } from "../api/graphqlClient";

// Non-secret CDM connection input. `password_encrypted` is never written via
// GraphQL — it is set through the metadata-api function (encrypted server-side).
export interface CdmConnectionInput {
  label: string;
  dbms?: string;
  host: string;
  port?: number;
  database: string;
  cdmSchema: string;
  vocabSchema?: string | null;
  user: string;
}

// Schema-prefixed postgraphile names (introspected live 2026-06-01).
// NOTE: NotebookCdmConnectionOrderBy has NO LABEL_ASC (only NATURAL/PRIMARY_KEY/
// ROW_ID), so we omit orderBy and sort by label CLIENT-SIDE.
const LIST = `query {
  allNotebookCdmConnections {
    nodes { rowId label dbms host port database cdmSchema vocabSchema user createdAt updatedAt }
  }
}`;

const CREATE = `mutation($c: NotebookCdmConnectionInput!) {
  createNotebookCdmConnection(input: { notebookCdmConnection: $c }) {
    notebookCdmConnection { rowId }
  }
}`;

const UPDATE = `mutation($id: UUID!, $p: NotebookCdmConnectionPatch!) {
  updateNotebookCdmConnectionByRowId(input: { rowId: $id, notebookCdmConnectionPatch: $p }) {
    notebookCdmConnection { rowId }
  }
}`;

const DELETE = `mutation($id: UUID!) {
  deleteNotebookCdmConnectionByRowId(input: { rowId: $id }) {
    deletedNotebookCdmConnectionId
  }
}`;

export const useConnectionsStore = defineStore("connections", () => {
  const gql = new GraphqlClient(defaultGraphqlEndpoint());
  const connections = ref<CdmConnection[]>([]);
  const error = ref<string | null>(null);

  async function fetch(): Promise<void> {
    try {
      const d = await gql.request<{ allNotebookCdmConnections: { nodes: CdmConnection[] } }>(LIST);
      connections.value = [...d.allNotebookCdmConnections.nodes].sort((a, b) =>
        a.label.localeCompare(b.label),
      );
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function create(conn: CdmConnectionInput): Promise<void> {
    await gql.request(CREATE, { c: conn });
    await fetch();
  }

  async function update(id: string, patch: Partial<CdmConnectionInput>): Promise<void> {
    await gql.request(UPDATE, { id, p: patch });
    await fetch();
  }

  async function remove(id: string): Promise<void> {
    await gql.request(DELETE, { id });
    await fetch();
  }

  return { connections, error, fetch, create, update, remove };
});
