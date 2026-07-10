import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import { nextTick } from 'vue'
import Notebook from '@/components/notebook/Notebook.vue'
import type { NotebookData } from '@/types/notebook'

const data: NotebookData = { metadata: { title: 'T' }, cells: [] }

describe('Notebook', () => {
  it('shows the empty state with add buttons', () => {
    render(Notebook, { props: { initialData: data } })
    expect(screen.getByText('Start your notebook')).toBeInTheDocument()
  })

  it('adds a cell when an empty-state button is clicked', async () => {
    render(Notebook, { props: { initialData: data } })
    await fireEvent.click(screen.getByRole('button', { name: /Python/ }))
    await nextTick()
    // The empty-state prompt disappears once a cell exists
    expect(screen.queryByText('Add your first cell')).toBeNull()
  })
})
