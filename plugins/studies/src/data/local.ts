import { authHeaders } from '../api/authToken';

export interface LocalItem {
  id: string;
  name: string;
  type: 'Notebook' | 'Strategus';
  updatedAt: string;
  /** Base-relative deep-link path, e.g. "/plugins/notebook-plugin/?open=<id>". */
  route: string;
}

interface NotebookNode {
  rowId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface AnalysisDefinitionNode {
  rowId: string;
  name: string;
  description: string;
  updatedAt: string;
  deletedAt: string | null;
}

const GRAPHQL_ENDPOINT = () => `${location.origin}/trex/graphql`;

const LIST_NOTEBOOKS = `query {
  allNotebookDocuments(orderBy: UPDATED_AT_DESC) {
    nodes { rowId name description createdAt updatedAt deletedAt }
  }
}`;

const LIST_DEFINITIONS = `query {
  allNotebookAnalysisDefinitions(orderBy: UPDATED_AT_DESC) {
    nodes { rowId name description updatedAt deletedAt }
  }
}`;

async function graphqlRequest<T>(query: string): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`graphql ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e: { message: string }) => e.message).join('; '));
  return body.data as T;
}

async function listNotebookItems(): Promise<LocalItem[]> {
  try {
    const data = await graphqlRequest<{ allNotebookDocuments: { nodes: NotebookNode[] } }>(LIST_NOTEBOOKS);
    const nodes = data.allNotebookDocuments?.nodes ?? [];
    return nodes
      .filter((n) => n.deletedAt == null)
      .map((n) => ({
        id: n.rowId,
        name: n.name,
        type: 'Notebook' as const,
        updatedAt: n.updatedAt,
        route: `/plugins/notebook-plugin/?open=${n.rowId}`,
      }));
  } catch {
    return [];
  }
}

async function listStrategusItems(): Promise<LocalItem[]> {
  try {
    const data = await graphqlRequest<{ allNotebookAnalysisDefinitions: { nodes: AnalysisDefinitionNode[] } }>(
      LIST_DEFINITIONS
    );
    const nodes = data.allNotebookAnalysisDefinitions?.nodes ?? [];
    return nodes
      .filter((n) => n.deletedAt == null)
      .map((n) => ({
        id: n.rowId,
        name: n.name,
        type: 'Strategus' as const,
        updatedAt: n.updatedAt,
        route: `/plugins/strategus-plugin/?study=${n.rowId}`,
      }));
  } catch {
    return [];
  }
}

export async function listLocalItems(): Promise<LocalItem[]> {
  const [notebooks, strategus] = await Promise.all([
    listNotebookItems(),
    listStrategusItems(),
  ]);
  return [...notebooks, ...strategus].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
