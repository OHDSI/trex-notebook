import { defineStore } from "pinia";
import { ref } from "vue";
import type { NotebookData } from "@trex/notebook";
import type { NotebookSummary, NotebookDocument, NewNotebookInput, NotebookPatch } from "../api/types";
import { GraphqlClient, defaultGraphqlEndpoint } from "../api/graphqlClient";
import { GIT_MIRROR_ENABLED, mirrorNotebook } from "../api/notebookGit";

// `canEdit` is a computed field (notebook.document_can_edit) that only exists
// once the server's schema has notebook ownership. Against an older schema the
// field is unknown and the whole query fails, so the store falls back to the
// same query without it.
const summaryFields = (withCanEdit: boolean) =>
  `rowId name description createdAt updatedAt deletedAt${withCanEdit ? " canEdit" : ""}`;

const LIST = (withCanEdit: boolean) => `query {
  allNotebookDocuments(orderBy: UPDATED_AT_DESC) {
    nodes { ${summaryFields(withCanEdit)} }
  }
}`;

const GET = (withCanEdit: boolean) => `query($id: UUID!) {
  allNotebookDocuments(condition: { rowId: $id }) {
    nodes { ${summaryFields(withCanEdit)} content }
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

export const READ_ONLY_MESSAGE =
  "This notebook is shared and read-only. Save a copy to keep your changes.";

type UpdateResult = { updateNotebookDocumentByRowId: { notebookDocument: { rowId: string } | null } | null };

// Row-level security hides a row the user may not change from UPDATE. Rather
// than an error, PostGraphile then answers with a null notebookDocument, so a
// refused save would otherwise look like a successful one.
function assertUpdated(d: UpdateResult): void {
  if (!d?.updateNotebookDocumentByRowId?.notebookDocument) throw new Error(READ_ONLY_MESSAGE);
}

const isUnknownCanEdit = (e: unknown) =>
  e instanceof Error && /canEdit/.test(e.message);

export const useNotebooksStore = defineStore("notebooks", () => {
  const gql = new GraphqlClient(defaultGraphqlEndpoint());
  const notebooks = ref<NotebookSummary[]>([]);
  const error = ref<string | null>(null);
  // Set when the row write succeeded but the git mirror did not. The save still
  // stands — the repo is simply one revision behind until the next write or an
  // overwrite-all repair run. Rendered as a warning, never an error.
  const mirrorWarning = ref<string | null>(null);

  // Flips to false the first time the server rejects `canEdit`, so an older
  // schema costs one failed request rather than one per call.
  let canEditSupported = true;
  async function query<T>(build: (withCanEdit: boolean) => string, variables: Record<string, unknown> = {}): Promise<T> {
    if (canEditSupported) {
      try {
        return await gql.request<T>(build(true), variables);
      } catch (e) {
        if (!isUnknownCanEdit(e)) throw e;
        canEditSupported = false;
      }
    }
    return gql.request<T>(build(false), variables);
  }

  async function mirror(id: string): Promise<void> {
    // Disabled: the mirror call 401s and Atlas's login-guard turns any 401 into a
    // sign-in dialog, which would log the user out on every save.
    if (!GIT_MIRROR_ENABLED) return;
    try {
      await mirrorNotebook(id);
      mirrorWarning.value = null;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      mirrorWarning.value = `Saved, but not pushed to git: ${detail}`;
      console.error(`Failed to mirror notebook ${id}: ${detail}`);
    }
  }

  async function fetch(): Promise<void> {
    try {
      const d = await query<{ allNotebookDocuments: { nodes: NotebookSummary[] } }>(LIST);
      notebooks.value = d.allNotebookDocuments.nodes.filter((n) => n.deletedAt == null);
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function get(id: string): Promise<NotebookDocument> {
    const d = await query<{ allNotebookDocuments: { nodes: NotebookDocument[] } }>(GET, { id });
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
          // No createdBy: the server makes the signed-in user the owner.
        },
      },
    });
    const id = d.createNotebookDocument.notebookDocument.rowId;
    await mirror(id);
    await fetch();
    return id;
  }

  async function update(id: string, patch: NotebookPatch): Promise<void> {
    assertUpdated(await gql.request<UpdateResult>(UPDATE, { id, patch: { ...patch, updatedAt: new Date().toISOString() } }));
    await mirror(id);
    await fetch();
  }

  async function remove(id: string): Promise<void> {
    const patch: NotebookPatch = { deletedAt: new Date().toISOString() };
    assertUpdated(await gql.request<UpdateResult>(UPDATE, { id, patch }));
    // Mirror after the soft-delete so the function sees deleted_at and removes
    // the file from the repo.
    await mirror(id);
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

  return { notebooks, error, mirrorWarning, fetch, get, create, update, remove, duplicate };
});
