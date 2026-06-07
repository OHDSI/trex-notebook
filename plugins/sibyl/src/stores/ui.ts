import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const settingsOpen = ref(false)
  const jobsOpen = ref(false)

  function openSettings() { jobsOpen.value = false; settingsOpen.value = true }
  function closeSettings() { settingsOpen.value = false }
  function toggleSettings() { settingsOpen.value ? closeSettings() : openSettings() }

  function openJobs() { settingsOpen.value = false; jobsOpen.value = true }
  function closeJobs() { jobsOpen.value = false }
  function toggleJobs() { jobsOpen.value ? closeJobs() : openJobs() }

  return {
    settingsOpen, jobsOpen,
    openSettings, closeSettings, toggleSettings,
    openJobs, closeJobs, toggleJobs,
  }
})
