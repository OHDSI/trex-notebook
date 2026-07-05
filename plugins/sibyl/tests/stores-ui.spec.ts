import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui'

describe('ui store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('toggles settings', () => {
    const ui = useUiStore()
    expect(ui.settingsOpen).toBe(false)
    ui.toggleSettings()
    expect(ui.settingsOpen).toBe(true)
    ui.toggleSettings()
    expect(ui.settingsOpen).toBe(false)
  })
})
