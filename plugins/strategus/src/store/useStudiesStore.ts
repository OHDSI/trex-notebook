import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface StudyRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Snapshot of the full strategus store state at save time.
   * Stored as serialized JSON-safe object — the editor restores
   * fields onto useStrategusStore when opening this study.
   */
  state: Record<string, unknown>;
}

const STORAGE_KEY = 'strategus-plugin:studies';

function loadFromStorage(): StudyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(studies: StudyRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studies));
  } catch {
    // localStorage may be full or unavailable — silently skip
  }
}

function generateId(): string {
  return `study-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PluginMode = 'list' | 'editor';

export const useStudiesStore = defineStore('strategus-studies', () => {
  const studies = ref<StudyRecord[]>(loadFromStorage());
  const mode = ref<PluginMode>('list');
  const currentStudyId = ref<string | null>(null);
  const searchTerm = ref('');

  const filteredStudies = computed(() => {
    const q = searchTerm.value.trim().toLowerCase();
    if (!q) return studies.value;
    return studies.value.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  });

  function persist(): void {
    saveToStorage(studies.value);
  }

  function createStudy(state: Record<string, unknown>, name = 'Untitled study', description = ''): StudyRecord {
    const now = new Date().toISOString();
    const study: StudyRecord = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      state,
    };
    studies.value = [study, ...studies.value];
    persist();
    return study;
  }

  function updateStudy(id: string, patch: Partial<Omit<StudyRecord, 'id' | 'createdAt'>>): void {
    const idx = studies.value.findIndex((s) => s.id === id);
    if (idx < 0) return;
    studies.value[idx] = {
      ...studies.value[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    persist();
  }

  function deleteStudy(id: string): void {
    studies.value = studies.value.filter((s) => s.id !== id);
    if (currentStudyId.value === id) {
      currentStudyId.value = null;
      mode.value = 'list';
    }
    persist();
  }

  function duplicateStudy(id: string): StudyRecord | null {
    const original = studies.value.find((s) => s.id === id);
    if (!original) return null;
    return createStudy(original.state, `${original.name} (copy)`, original.description);
  }

  function openStudy(id: string): StudyRecord | null {
    const study = studies.value.find((s) => s.id === id);
    if (!study) return null;
    currentStudyId.value = id;
    mode.value = 'editor';
    return study;
  }

  function openNew(): void {
    currentStudyId.value = null;
    mode.value = 'editor';
  }

  function closeEditor(): void {
    currentStudyId.value = null;
    mode.value = 'list';
  }

  return {
    studies,
    mode,
    currentStudyId,
    searchTerm,
    filteredStudies,
    createStudy,
    updateStudy,
    deleteStudy,
    duplicateStudy,
    openStudy,
    openNew,
    closeEditor,
  };
});
