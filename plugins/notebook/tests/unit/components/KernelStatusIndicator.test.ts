import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import KernelStatusIndicator from '@/components/notebook/KernelStatusIndicator.vue'

describe('KernelStatusIndicator', () => {
  it('shows Ready for idle', () => {
    render(KernelStatusIndicator, { props: { status: 'idle' } })
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('shows kernel name when provided', () => {
    render(KernelStatusIndicator, { props: { status: 'busy', kernelName: 'Pyodide' } })
    expect(screen.getByText('Pyodide')).toBeInTheDocument()
    expect(screen.getByText('Running...')).toBeInTheDocument()
  })
})
