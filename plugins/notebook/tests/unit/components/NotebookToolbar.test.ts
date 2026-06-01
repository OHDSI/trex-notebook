import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import NotebookToolbar from '@/components/notebook/NotebookToolbar.vue'

describe('NotebookToolbar', () => {
  it('renders Add Cell and Run All', () => {
    render(NotebookToolbar, {
      props: { kernelStatus: 'idle', isExecuting: false, canUndo: false, canRedo: false },
    })
    expect(screen.getByText('Add Cell')).toBeInTheDocument()
    expect(screen.getByText('Run All')).toBeInTheDocument()
  })

  it('shows Stop while executing', () => {
    render(NotebookToolbar, {
      props: { kernelStatus: 'busy', isExecuting: true, canUndo: false, canRedo: false },
    })
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })
})
