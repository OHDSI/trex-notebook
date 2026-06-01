/**
 * Unit tests for cell reordering in useNotebook composable
 */

import { describe, it, expect } from 'vitest'
import { withSetup } from '../../helpers/withSetup'
import { useNotebook } from '@/hooks/useNotebook'

describe('useNotebook - cell reordering', () => {
  describe('moveCell', () => {
    it('moves cell from first to second position', () => {
      const [api] = withSetup(() => useNotebook())

      // Add 3 cells
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')

      const cellIds = api.notebook.value.cells.map((c) => c.id)
      const [first, second, third] = cellIds

      // Move first cell to position 1 (second position)
      api.actions.moveCell(first, 1)

      const newIds = api.notebook.value.cells.map((c) => c.id)
      expect(newIds).toEqual([second, first, third])
    })

    it('moves cell from last to first position', () => {
      const [api] = withSetup(() => useNotebook())

      // Add 3 cells
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')

      const cellIds = api.notebook.value.cells.map((c) => c.id)
      const [first, second, third] = cellIds

      // Move last cell to position 0 (first position)
      api.actions.moveCell(third, 0)

      const newIds = api.notebook.value.cells.map((c) => c.id)
      expect(newIds).toEqual([third, first, second])
    })

    it('moves cell from middle to end', () => {
      const [api] = withSetup(() => useNotebook())

      // Add 3 cells
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')

      const cellIds = api.notebook.value.cells.map((c) => c.id)
      const [first, second, third] = cellIds

      // Move second cell to position 2 (last position)
      api.actions.moveCell(second, 2)

      const newIds = api.notebook.value.cells.map((c) => c.id)
      expect(newIds).toEqual([first, third, second])
    })

    it('does nothing when moving to same position', () => {
      const [api] = withSetup(() => useNotebook())

      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')

      const cellIds = api.notebook.value.cells.map((c) => c.id)

      // Move first cell to position 0 (same position)
      api.actions.moveCell(cellIds[0], 0)

      const newIds = api.notebook.value.cells.map((c) => c.id)
      expect(newIds).toEqual(cellIds)
    })

    it('handles invalid cell id gracefully', () => {
      const [api] = withSetup(() => useNotebook())

      api.actions.addCell('code', undefined, 'python')

      const originalCells = [...api.notebook.value.cells]

      // Try to move non-existent cell
      api.actions.moveCell('non-existent-id', 0)

      // Cells should be unchanged
      expect(api.notebook.value.cells).toEqual(originalCells)
    })

    it('clamps position to valid range', () => {
      const [api] = withSetup(() => useNotebook())

      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')

      const cellIds = api.notebook.value.cells.map((c) => c.id)
      const [first, second] = cellIds

      // Move to position beyond array length
      api.actions.moveCell(first, 100)

      const newIds = api.notebook.value.cells.map((c) => c.id)
      // First should now be at the end
      expect(newIds).toEqual([second, first])
    })

    it('clamps negative position to 0', () => {
      const [api] = withSetup(() => useNotebook())

      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')

      const cellIds = api.notebook.value.cells.map((c) => c.id)
      const [first, second] = cellIds

      // Move to negative position
      api.actions.moveCell(second, -5)

      const newIds = api.notebook.value.cells.map((c) => c.id)
      // Second should now be at the beginning
      expect(newIds).toEqual([second, first])
    })

    it('preserves cell content after move', () => {
      const [api] = withSetup(() => useNotebook())

      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('markdown')

      const [codeCell, markdownCell] = api.notebook.value.cells

      // Update source content
      api.actions.updateCellSource(codeCell.id, 'print("hello")')
      api.actions.updateCellSource(markdownCell.id, '# Title')

      // Move cells
      api.actions.moveCell(markdownCell.id, 0)

      // Verify content is preserved
      const [first, second] = api.notebook.value.cells
      expect(first.id).toBe(markdownCell.id)
      expect(first.source).toBe('# Title')
      expect(second.id).toBe(codeCell.id)
      expect(second.source).toBe('print("hello")')
    })

    it('is tracked in undo history', () => {
      const [api] = withSetup(() => useNotebook())

      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')

      const originalOrder = api.notebook.value.cells.map((c) => c.id)
      const [first] = originalOrder

      // Move cell
      api.actions.moveCell(first, 1)

      expect(api.history.value.canUndo).toBe(true)

      // Undo should restore original order
      api.actions.undo()

      const restoredOrder = api.notebook.value.cells.map((c) => c.id)
      expect(restoredOrder).toEqual(originalOrder)
    })
  })

  describe('multiple cell operations', () => {
    it('handles sequence of add, move, delete operations', () => {
      const [api] = withSetup(() => useNotebook())

      // Add cells
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('code', undefined, 'python')
      api.actions.addCell('markdown')

      const [first, second, third] = api.notebook.value.cells.map((c) => c.id)

      // Move second to first
      api.actions.moveCell(second, 0)

      // Delete first (which is now second)
      api.actions.deleteCell(second)

      // Verify remaining cells
      const remaining = api.notebook.value.cells.map((c) => c.id)
      expect(remaining).toEqual([first, third])
    })
  })
})
