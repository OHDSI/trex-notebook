// These interfaces mirror the postgraphile-generated GraphQL fields for the
// `notebook` schema tables. NOTE: our `id` uuid PK column is exposed by
// postgraphile as the GraphQL field `rowId` (the `id` field is the opaque Node
// global id), so the id field is named `rowId` here — the stores SELECT `rowId`
// and treat it as the entity id. See
// docs/superpowers/notes/2026-06-01-metadata-write-path.md ("rowId gotcha").
export interface AnalysisDefinition {
  rowId: string; name: string; description: string;
  spec: unknown; createdAt: string; updatedAt: string; deletedAt: string | null;
}
export interface AnalysisResult {
  rowId: string; definitionId: string | null; jobId: string;
  cdmConnectionId: string | null; status: string;
  storageBucket: string; storageKey: string; sizeBytes: number | null; createdAt: string;
}
export interface CdmConnection {
  rowId: string; label: string; dbms: string; host: string; port: number;
  database: string; cdmSchema: string; vocabSchema: string | null;
  user: string; createdAt: string; updatedAt: string;
}
