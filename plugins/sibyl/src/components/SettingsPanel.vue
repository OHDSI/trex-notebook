<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    temporary
    :width="drawerWidth"
    data-test="settings-panel"
  >
    <div class="d-flex align-center justify-space-between pa-4">
      <span class="text-h6">Settings</span>
      <AtlasIconButton icon="mdi-close" variant="text" ariaLabel="Close settings panel" data-test="settings-close" @click="ui.closeSettings()" />
    </div>
    <AtlasTabs v-model="tab" color="primary" class="px-2">
      <AtlasTab value="envs"><AtlasIcon class="mr-1">mdi-language-r</AtlasIcon>R Environments</AtlasTab>
      <AtlasTab value="webapi"><AtlasIcon class="mr-1">mdi-api</AtlasIcon>WebAPI</AtlasTab>
      <AtlasTab value="network"><AtlasIcon class="mr-1">mdi-lan-connect</AtlasIcon>Network</AtlasTab>
    </AtlasTabs>
    <v-tabs-window v-model="tab" class="pa-4">
      <v-tabs-window-item value="envs"><EnvironmentsSection /></v-tabs-window-item>
      <v-tabs-window-item value="webapi"><WebApiSection /></v-tabs-window-item>
      <v-tabs-window-item value="network"><NetworkSiteSection /></v-tabs-window-item>
    </v-tabs-window>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useDrawerWidth } from '@/composables/useDrawerWidth'
import EnvironmentsSection from '@/components/settings/EnvironmentsSection.vue'
import WebApiSection from '@/components/settings/WebApiSection.vue'
import NetworkSiteSection from '@/components/settings/NetworkSiteSection.vue'
import { AtlasIconButton, AtlasTabs, AtlasTab, AtlasIcon } from '@ohdsi/atlas-ui'

const ui = useUiStore()
const drawerWidth = useDrawerWidth()
const tab = ref('envs')
const open = computed({ get: () => ui.settingsOpen, set: v => { if (!v) ui.closeSettings() } })
</script>
