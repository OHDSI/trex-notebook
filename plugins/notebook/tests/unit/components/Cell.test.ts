import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import Cell from '@/components/notebook/Cell.vue'
import type { CellData } from '@/types/notebook'

const codeCell: CellData = {
  id: 'c1',
  type: 'code',
  language: 'python',
  source: 'print(1)',
  executionCount: null,
  executionState: 'idle',
  outputs: [],
}

describe('Cell', () => {
  it('renders a code cell with the language label', () => {
    render(Cell, { props: { cell: codeCell, isSelected: false } })
    // The type label appears (Python)
    expect(screen.getAllByText('Python').length).toBeGreaterThan(0)
  })
})
