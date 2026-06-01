import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import Button from '@/components/ui/Button.vue'

describe('Button', () => {
  it('renders default variant with slot content', () => {
    render(Button, { slots: { default: () => 'Click' } })
    const btn = screen.getByRole('button', { name: 'Click' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-primary')
  })

  it('applies the ghost variant and icon size classes', () => {
    render(Button, {
      props: { variant: 'ghost', size: 'icon' },
      slots: { default: () => 'x' },
    })
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('hover:bg-accent')
    expect(btn.className).toContain('w-9')
  })

  it('is disabled when disabled prop is set', () => {
    render(Button, { props: { disabled: true }, slots: { default: () => 'x' } })
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
