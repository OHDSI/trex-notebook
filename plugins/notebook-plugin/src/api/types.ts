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
  // Whether the signed-in user may save, rename or delete this notebook. Only
  // the owner (or an admin) may; shared notebooks are read-only. Undefined when
  // the server's schema predates ownership, in which case everything is
  // editable as before.
  canEdit?: boolean;
}

export interface NotebookDocument extends NotebookSummary {
  content: NotebookData;
}

export interface NewNotebookInput {
  name: string;
  description: string;
  content: NotebookData;
}

export interface NotebookPatch {
  name?: string;
  description?: string;
  content?: NotebookData;
  deletedAt?: string;
}

// --- git mirror (notebook-git-api) -----------------------------------------
// Shapes match the React notebook's types.ts so both clients stay comparable.

export interface RemoteDiffCheckResponse {
  hasDifferences: boolean;
  reason: string;
}

export interface OverwriteFromRemoteResponse {
  message: string;
  overwritten: boolean;
  notebookId: string;
}

export interface MirrorResponse {
  status: "ok" | "skipped";
  /** "saved" | "deleted" when status is "ok" */
  action?: string;
  /** why it was skipped, e.g. "Git config not set" */
  reason?: string;
}

// --- notebook templates (notebook-git-api GET /templates) -------------------

export interface NotebookTemplateDto {
  id: string;
  name: string;
  description: string;
  content: unknown;
}
