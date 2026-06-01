import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import MarkdownCell from '@/components/notebook/MarkdownCell.vue'

describe('MarkdownCell', () => {
  it('renders markdown as HTML in display mode', () => {
    render(MarkdownCell, { props: { source: '# Title', isSelected: false } })
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
  })

  it('shows placeholder when empty', () => {
    render(MarkdownCell, { props: { source: '', isSelected: false } })
    expect(screen.getByText(/Click to add markdown content/)).toBeInTheDocument()
  })
})
