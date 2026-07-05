import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const settingsOpen = ref(false)

  function openSettings() { settingsOpen.value = true }
  function closeSettings() { settingsOpen.value = false }
  function toggleSettings() { settingsOpen.value ? closeSettings() : openSettings() }

  return {
    settingsOpen,
    openSettings, closeSettings, toggleSettings,
  }
})
