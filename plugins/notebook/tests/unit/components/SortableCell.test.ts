import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/vue'
import SortableCell from '@/components/notebook/SortableCell.vue'
import type { CellData } from '@/types/notebook'

const cell: CellData = {
  id: 'c1',
  type: 'markdown',
  source: 'hi',
}

describe('SortableCell', () => {
  it('renders a drag handle', () => {
    const { container } = render(SortableCell, {
      props: { cell, isSelected: false },
    })
    expect(container.querySelector('.cell-drag-handle')).toBeTruthy()
  })

  it('applies content-visibility style when virtualization is on', () => {
    const { container } = render(SortableCell, {
      props: { cell, isSelected: false, useVirtualization: true },
    })
    const root = container.firstElementChild as HTMLElement
    expect(root.style.contentVisibility).toBe('auto')
  })
})
