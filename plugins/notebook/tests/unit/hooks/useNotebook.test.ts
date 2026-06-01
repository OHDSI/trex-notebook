import { describe, it, expect, vi } from 'vitest'
import { withSetup } from '../../helpers/withSetup'
import { useNotebook } from '@/hooks/useNotebook'
import type { NotebookData } from '@/types/notebook'

const initialData: NotebookData = {
  metadata: { title: 'Test Notebook' },
  cells: [
    {
      id: 'cell-1',
      type: 'code',
      language: 'python',
      source: 'print("hello")',
      executionCount: null,
      executionState: 'idle',
      outputs: [],
    },
  ],
}

describe('useNotebook', () => {
  describe('addCell', () => {
    it('adds a code cell with specified language', () => {
      const [api] = withSetup(() => useNotebook())
      api.actions.addCell('code', undefined, 'python')
      expect(api.notebook.value.cells).toHaveLength(1)
      expect(api.notebook.value.cells[0].type).toBe('code')
      const cell = api.notebook.value.cells[0]
      if (cell.type === 'code') expect(cell.language).toBe('python')
    })

    it('adds a markdown cell', () => {
      const [api] = withSetup(() => useNotebook())
      api.actions.addCell('markdown')
      expect(api.notebook.value.cells).toHaveLength(1)
      expect(api.notebook.value.cells[0].type).toBe('markdown')
    })

    it('inserts cell at specified position', () => {
      const [api] = withSetup(() => useNotebook({ initialData }))
      api.actions.addCell('code', 0, 'r')
      expect(api.notebook.value.cells).toHaveLength(2)
      const cell = api.notebook.value.cells[0]
      if (cell.type === 'code') expect(cell.language).toBe('r')
    })

    it('selects newly added cell', () => {
      const [api] = withSetup(() => useNotebook())
      const newCellId = api.actions.addCell('code')
      expect(api.selectedCellId.value).toBe(newCellId)
    })
  })

  describe('deleteCell', () => {
    it('removes the cell', () => {
      const [api] = withSetup(() => useNotebook({ initialData }))
      api.actions.deleteCell('cell-1')
      expect(api.notebook.value.cells).toHaveLength(0)
    })

    it('updates selection when deleting selected cell', () => {
      const multiCellData: NotebookData = {
        metadata: {},
        cells: [
          { id: 'a', type: 'code', language: 'python', source: '', executionCount: null, executionState: 'idle', outputs: [] },
          { id: 'b', type: 'code', language: 'python', source: '', executionCount: null, executionState: 'idle', outputs: [] },
        ],
      }
      const [api] = withSetup(() => useNotebook({ initialData: multiCellData }))
      api.actions.selectCell('a')
      api.actions.deleteCell('a')
      expect(api.selectedCellId.value).toBe('b')
    })
  })

  describe('selectCell', () => {
    it('updates selectedCellId', () => {
      const [api] = withSetup(() => useNotebook({ initialData }))
      api.actions.selectCell('cell-1')
      expect(api.selectedCellId.value).toBe('cell-1')
    })

    it('can clear selection', () => {
      const [api] = withSetup(() => useNotebook({ initialData }))
      api.actions.selectCell('cell-1')
      api.actions.selectCell(null)
      expect(api.selectedCellId.value).toBeNull()
    })
  })

  describe('updateCellSource', () => {
    it('updates the source of a cell', () => {
      const [api] = withSetup(() => useNotebook({ initialData }))
      api.actions.updateCellSource('cell-1', 'x = 1')
      expect(api.notebook.value.cells[0].source).toBe('x = 1')
    })
  })

  describe('onChange', () => {
    it('fires onChange on mutation', () => {
      const onChange = vi.fn()
      const [api] = withSetup(() => useNotebook({ initialData, onChange }))
      api.actions.updateCellSource('cell-1', 'y = 2')
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('undo/redo', () => {
    it('undoes and redoes a mutation', () => {
      const [api] = withSetup(() => useNotebook({ initialData }))
      api.actions.updateCellSource('cell-1', 'changed')
      expect(api.history.value.canUndo).toBe(true)
      api.actions.undo()
      expect(api.notebook.value.cells[0].source).toBe('print("hello")')
      expect(api.history.value.canRedo).toBe(true)
      api.actions.redo()
      expect(api.notebook.value.cells[0].source).toBe('changed')
    })
  })
})
