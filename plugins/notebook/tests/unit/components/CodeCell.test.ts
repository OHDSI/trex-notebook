import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import CodeCell from '@/components/notebook/CodeCell.vue'

const defaultProps = {
  source: 'print("hello")',
  language: 'python' as const,
  executionCount: null,
  executionState: 'idle' as const,
  isSelected: false,
}

describe('CodeCell', () => {
  it('renders code content', async () => {
    render(CodeCell, { props: defaultProps })
    await nextTick()
    expect(screen.getByText(/print/)).toBeInTheDocument()
  })

  it('displays execution count when set', () => {
    render(CodeCell, { props: { ...defaultProps, executionCount: 5 } })
    expect(screen.getByText('[5]')).toBeInTheDocument()
  })

  it('displays empty brackets when no execution count', () => {
    render(CodeCell, { props: defaultProps })
    expect(screen.getByText('[ ]')).toBeInTheDocument()
  })

  it('displays asterisk when running', () => {
    render(CodeCell, { props: { ...defaultProps, executionState: 'running' } })
    expect(screen.getByText('[*]')).toBeInTheDocument()
  })
})
