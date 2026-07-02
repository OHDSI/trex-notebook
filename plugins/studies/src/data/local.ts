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

interface StrategusStudyRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  serverId?: string;
  state: Record<string, unknown>;
}

const GRAPHQL_ENDPOINT = () => `${location.origin}/trex/graphql`;
const STRATEGUS_STORAGE_KEY = 'strategus-plugin:studies';

const LIST_NOTEBOOKS = `query {
  allNotebookDocuments(orderBy: UPDATED_AT_DESC) {
    nodes { rowId name description createdAt updatedAt deletedAt }
  }
}`;

async function listNotebookItems(): Promise<LocalItem[]> {
  try {
    const res = await fetch(GRAPHQL_ENDPOINT(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: LIST_NOTEBOOKS }),
    });
    if (!res.ok) throw new Error(`graphql ${res.status}`);
    const body = await res.json();
    if (body.errors?.length) throw new Error(body.errors.map((e: { message: string }) => e.message).join('; '));
    const nodes = (body.data?.allNotebookDocuments?.nodes ?? []) as NotebookNode[];
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

function listStrategusItems(): LocalItem[] {
  try {
    const raw = localStorage.getItem(STRATEGUS_STORAGE_KEY) ?? '[]';
    const parsed = JSON.parse(raw) as StrategusStudyRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({
      id: s.id,
      name: s.name,
      type: 'Strategus' as const,
      updatedAt: s.updatedAt,
      route: `/plugins/strategus-plugin/?study=${s.id}`,
    }));
  } catch {
    return [];
  }
}

export async function listLocalItems(): Promise<LocalItem[]> {
  const [notebooks, strategus] = await Promise.all([
    listNotebookItems(),
    Promise.resolve(listStrategusItems()),
  ]);
  return [...notebooks, ...strategus].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
