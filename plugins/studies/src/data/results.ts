export interface ResultMeta {
  id: string;
  name: string;
  size: number;
  addedAt: number;
}

export function listSavedResults(): ResultMeta[] {
  try {
    const raw = localStorage.getItem('results-viewer:index');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice().sort((a, b) => b.addedAt - a.addedAt) : [];
  } catch {
    return [];
  }
}

export function openResult(id: string): void {
  window.location.href = `/plugins/results-viewer/?open=${encodeURIComponent(id)}`;
}
