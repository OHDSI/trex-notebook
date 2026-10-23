// Saved/unsaved tracking for the notebook editor (OHDSI/Data2Evidence#3570).
// The notebook is unsaved exactly when what the user authored differs from the
// last saved or loaded content. A flag set from onChange cannot do this: the
// @trex/notebook hook fires onChange on load and on every cell run, so the
// editor looked unsaved the moment a notebook opened.
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { NotebookData } from '@trex/notebook'

/**
 * Fingerprint of the authored content only. Outputs, execution count and
 * execution state are run results, not edits, so they are left out. Objects
 * are built explicitly so key order is stable.
 */
export function authoredKey(data: NotebookData): string {
  return JSON.stringify({
    metadata: data.metadata ?? {},
    cells: (data.cells ?? []).map((cell) => ({
      id: cell.id,
      type: cell.type,
      source: cell.source,
      metadata: cell.metadata ?? {},
      language: cell.type === 'code' ? cell.language : undefined,
    })),
  })
}

export function useSavedBaseline(current: Ref<NotebookData>): {
  dirty: ComputedRef<boolean>
  markSaved: (data: NotebookData) => void
  capture: () => () => void
} {
  const baseline = ref(authoredKey(current.value))
  const dirty = computed(() => authoredKey(current.value) !== baseline.value)

  function markSaved(data: NotebookData): void {
    baseline.value = authoredKey(data)
  }

  /**
   * Fingerprints the current content now and returns a function that makes it
   * the baseline. A save captures before its request and commits on success,
   * so edits typed while the request is in flight remain unsaved.
   */
  function capture(): () => void {
    const key = authoredKey(current.value)
    return () => {
      baseline.value = key
    }
  }

  return { dirty, markSaved, capture }
}
