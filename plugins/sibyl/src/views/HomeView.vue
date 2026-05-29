<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6">
          <h1 class="text-h5 mb-2">Strategus Shell</h1>
          <p class="text-body-1 mb-4">
            ATLAS-plugin host shell. Strategus plugins appear in the top
            navigation once registered in <code>public/config/plugins.json</code>.
          </p>
          <v-alert v-if="!hasPlugins" type="info" variant="tonal" data-test="no-plugins">
            No plugins are currently registered.
          </v-alert>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { generatePluginMenuItems } from '@/plugins/navigation/PluginMenuIntegration'

const hasPlugins = computed(() => generatePluginMenuItems().length > 0)
</script>
