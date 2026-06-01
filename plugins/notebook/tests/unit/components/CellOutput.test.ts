import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import CellOutput from '@/components/notebook/CellOutput.vue'
import type { CellOutput as CellOutputType } from '@/types/notebook'

describe('CellOutput', () => {
  it('renders stream output text', () => {
    const outputs: CellOutputType[] = [{ type: 'stream', name: 'stdout', text: 'hello world' }]
    render(CellOutput, { props: { outputs } })
    expect(screen.getByText(/hello world/)).toBeInTheDocument()
  })

  it('renders error output with ename and evalue', () => {
    const outputs: CellOutputType[] = [
      { type: 'error', ename: 'ValueError', evalue: 'bad', traceback: ['line1'] },
    ]
    render(CellOutput, { props: { outputs } })
    expect(screen.getByText(/ValueError: bad/)).toBeInTheDocument()
  })

  it('renders nothing when outputs are empty', () => {
    const { container } = render(CellOutput, { props: { outputs: [] } })
    expect(container.textContent).toBe('')
  })

  it('renders nothing for a mime output with no content', () => {
    const outputs: CellOutputType[] = [
      { type: 'execute_result', executionCount: 1, data: {} },
    ]
    const { container } = render(CellOutput, { props: { outputs } })
    expect(container.textContent).not.toContain('undefined')
  })
})
