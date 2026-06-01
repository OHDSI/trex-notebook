import { defineStore } from "pinia";
import { ref } from "vue";
import type { AnalysisResult } from "../api/metadataTypes";
import { GraphqlClient, defaultGraphqlEndpoint } from "../api/graphqlClient";

// Schema-prefixed postgraphile name (introspected live 2026-06-01).
// NOTE: NotebookAnalysisResultOrderBy has NO CREATED_AT_DESC (only NATURAL/
// PRIMARY_KEY/ROW_ID/DEFINITION_ID), so we omit orderBy and sort by createdAt
// DESC client-side.
const LIST = `query {
  allNotebookAnalysisResults {
    nodes { rowId definitionId jobId status storageBucket storageKey sizeBytes createdAt }
  }
}`;

export const useResultsStore = defineStore("results", () => {
  const gql = new GraphqlClient(defaultGraphqlEndpoint());
  const results = ref<AnalysisResult[]>([]);
  const error = ref<string | null>(null);

  async function fetch(): Promise<void> {
    try {
      const d = await gql.request<{ allNotebookAnalysisResults: { nodes: AnalysisResult[] } }>(LIST);
      results.value = [...d.allNotebookAnalysisResults.nodes].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { results, error, fetch };
});
