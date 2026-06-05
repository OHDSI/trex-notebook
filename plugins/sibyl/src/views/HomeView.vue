<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Strategus"
    title="Strategus Shell"
    subtitle="ATLAS-plugin host shell. Plugins appear in the top navigation once registered in public/config/plugins.json."
  >
    <v-alert v-if="!hasPlugins" type="info" variant="tonal" data-test="no-plugins">
      No plugins are currently registered.
    </v-alert>
  </AtlasPageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AtlasPageShell } from '@ohdsi/atlas-ui'
import { generatePluginMenuItems } from '@/plugins/navigation/PluginMenuIntegration'

const hasPlugins = computed(() => generatePluginMenuItems().length > 0)
</script>
