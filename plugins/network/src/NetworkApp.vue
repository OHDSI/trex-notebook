<template>
  <div class="network-app-body">
    <SectionHero
      eyebrow="OHDSI · Network"
      :title="isConfig ? 'Configuration' : 'Network'"
      :subtitle="isConfig
        ? 'Register and manage this site’s connection to the research network.'
        : 'Run federated network studies against this site and track your submissions.'"
    />
    <!-- No in-plugin login: access is gated by the trex session, and all API
         calls go through the network-api function proxy, which attaches the
         site's machine token server-side. -->
    <RegisterSiteView v-if="isConfig" />
    <template v-else>
      <StudiesToExecuteView />
      <AtlasDivider class="network-app__divider" />
      <SubmitResultsView />
      <AtlasDivider class="network-app__divider" />
      <MySubmissionsView />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasDivider } from '@ohdsi/atlas-ui';
import SectionHero from './components/SectionHero.vue';
import StudiesToExecuteView from './views/StudiesToExecuteView.vue';
import SubmitResultsView from './views/SubmitResultsView.vue';
import MySubmissionsView from './views/MySubmissionsView.vue';
import RegisterSiteView from './views/RegisterSiteView.vue';

const props = withDefaults(defineProps<{ section?: 'main' | 'configuration' }>(), {
  section: 'main',
});
const isConfig = computed(() => props.section === 'configuration');
</script>

<style scoped>
.network-app__divider {
  margin: 28px 0;
}
.network-app-body {
  padding: 20px 24px;
}
</style>
