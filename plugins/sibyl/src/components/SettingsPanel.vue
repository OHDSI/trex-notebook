<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    temporary
    width="520"
    data-test="settings-panel"
  >
    <div class="d-flex align-center justify-space-between pa-4">
      <span class="text-h6">Settings</span>
      <v-btn icon="mdi-close" variant="text" aria-label="Close settings panel" data-test="settings-close" @click="ui.closeSettings()" />
    </div>
    <v-tabs v-model="tab" color="primary" class="px-2">
      <v-tab value="envs"><v-icon start>mdi-language-r</v-icon>R Environments</v-tab>
      <v-tab value="webapi"><v-icon start>mdi-api</v-icon>WebAPI</v-tab>
    </v-tabs>
    <v-tabs-window v-model="tab" class="pa-4">
      <v-tabs-window-item value="envs"><EnvironmentsSection /></v-tabs-window-item>
      <v-tabs-window-item value="webapi"><WebApiSection /></v-tabs-window-item>
    </v-tabs-window>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import EnvironmentsSection from '@/components/settings/EnvironmentsSection.vue'
import WebApiSection from '@/components/settings/WebApiSection.vue'

const ui = useUiStore()
const tab = ref('envs')
const open = computed({ get: () => ui.settingsOpen, set: v => { if (!v) ui.closeSettings() } })
</script>
