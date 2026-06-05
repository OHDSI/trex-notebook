<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Network"
    title="Network"
    subtitle="Manage federated network studies — execute, submit results, and register this site."
  >
    <!-- No in-plugin login: access is gated by the trex session, and all API
         calls go through the network-api function proxy, which attaches the
         site's machine token server-side. -->
    <AtlasTabs v-model="tab" class="mb-4">
      <AtlasTab value="studies">Studies</AtlasTab>
      <AtlasTab value="submit">Submit</AtlasTab>
      <AtlasTab value="mine">My submissions</AtlasTab>
      <AtlasTab value="register">Register site</AtlasTab>
    </AtlasTabs>
    <v-window v-model="tab">
      <v-window-item value="studies"><StudiesToExecuteView /></v-window-item>
      <v-window-item value="submit"><SubmitResultsView /></v-window-item>
      <v-window-item value="mine"><MySubmissionsView /></v-window-item>
      <v-window-item value="register"><RegisterSiteView /></v-window-item>
    </v-window>
  </AtlasPageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AtlasPageShell, AtlasTabs, AtlasTab } from '@ohdsi/atlas-ui';
import StudiesToExecuteView from './views/StudiesToExecuteView.vue';
import SubmitResultsView from './views/SubmitResultsView.vue';
import MySubmissionsView from './views/MySubmissionsView.vue';
import RegisterSiteView from './views/RegisterSiteView.vue';

const tab = ref('studies');
</script>
