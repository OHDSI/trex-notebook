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
  deletedAt?: string;
}
