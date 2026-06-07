<template>
  <v-app>
    <NavBar v-if="!isLoginRoute" />
    <v-main>
      <router-view />
    </v-main>
    <template v-if="!isLoginRoute">
      <SettingsPanel />
      <JobsPanel />
    </template>
  </v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import JobsPanel from '@/components/JobsPanel.vue'

// The login screen is a focused, full-page card (like Atlas3's login modal) —
// hide the app nav there.
const route = useRoute()
const isLoginRoute = computed(() => route.name === 'login')
</script>

<style>
/* Paint the slightly-blue Atlas page background on every Vuetify root — the host
   shell and each sub-plugin parcel (which mounts its own .v-application). */
.v-application {
  background: rgb(var(--v-theme-background)) !important;
}

/* Atlas3 modal/drawer scrim — navy + blurred, matching @ohdsi/atlas-ui.
   The `temporary` v-navigation-drawer renders its backdrop as
   .v-navigation-drawer__scrim (a separate element from .v-overlay__scrim), so it
   must be targeted too — otherwise the drawer falls back to the default grey. */
.v-navigation-drawer__scrim,
.v-overlay__scrim {
  background-color: rgba(31, 66, 90, 0.45) !important;
  backdrop-filter: blur(4px);
  opacity: 1 !important;
}
</style>
