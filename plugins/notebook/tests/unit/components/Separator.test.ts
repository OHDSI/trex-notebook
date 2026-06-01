import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/vue'
import Separator from '@/components/ui/Separator.vue'

describe('Separator', () => {
  it('renders horizontal by default', () => {
    const { container } = render(Separator)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('h-[1px]')
  })

  it('renders vertical when orientation=vertical', () => {
    const { container } = render(Separator, { props: { orientation: 'vertical' } })
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('w-[1px]')
  })
})
