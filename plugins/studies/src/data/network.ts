export type StudyStatus = 'draft' | 'published' | 'archived';

export interface Study {
  studyId: string;
  name: string;
  description: string;
  version: string;
  status: StudyStatus;
}

interface NetworkConfigWindow {
  __networkPluginConfig?: { proxyUrl?: string };
}

export function networkBase(): string {
  const w = (typeof window !== 'undefined' ? window : {}) as NetworkConfigWindow;
  return (
    w.__networkPluginConfig?.proxyUrl ??
    `${location.origin}/plugins/network-api/network-api`
  );
}

export async function listStudies(): Promise<Study[]> {
  const res = await fetch(`${networkBase()}/studies`);
  if (!res.ok) throw new Error(`listStudies failed (${res.status})`);
  return (await res.json()) as Study[];
}
