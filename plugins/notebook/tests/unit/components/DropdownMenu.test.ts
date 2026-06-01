import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import { defineComponent, h } from 'vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuTrigger from '@/components/ui/DropdownMenuTrigger.vue'
import DropdownMenuContent from '@/components/ui/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'

const Harness = defineComponent({
  setup() {
    return () =>
      h(DropdownMenu, null, {
        default: () => [
          h(DropdownMenuTrigger, null, { default: () => h('button', 'Open') }),
          h(DropdownMenuContent, null, {
            default: () => h(DropdownMenuItem, null, { default: () => 'Item A' }),
          }),
        ],
      })
  },
})

describe('DropdownMenu', () => {
  it('opens on trigger click and shows items', async () => {
    render(Harness)
    await fireEvent.click(screen.getByText('Open'))
    expect(await screen.findByText('Item A')).toBeInTheDocument()
  })
})
