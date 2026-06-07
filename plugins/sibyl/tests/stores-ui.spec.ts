import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui'

describe('ui store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('toggles settings and jobs independently', () => {
    const ui = useUiStore()
    expect(ui.settingsOpen).toBe(false)
    ui.toggleSettings()
    expect(ui.settingsOpen).toBe(true)
    ui.toggleSettings()
    expect(ui.settingsOpen).toBe(false)
  })

  it('opening one panel closes the other', () => {
    const ui = useUiStore()
    ui.openSettings()
    expect(ui.settingsOpen).toBe(true)
    ui.openJobs()
    expect(ui.jobsOpen).toBe(true)
    expect(ui.settingsOpen).toBe(false)
  })
})
