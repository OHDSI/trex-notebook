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
    const patch: NotebookPatch = { deletedAt: new Date().toISOString() };
    await gql.request(UPDATE, { id, patch });
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
