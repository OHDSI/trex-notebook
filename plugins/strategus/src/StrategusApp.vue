<template>
  <!-- List mode: studies list (no sidebar) -->
  <AtlasPageShell
    v-if="studiesStore.mode === 'list'"
    hero
    eyebrow="OHDSI · Strategus"
    title="Studies"
    subtitle="Build and manage Strategus analysis specifications for distribution across OMOP sites."
  >
    <template #actions>
      <AtlasButton
        variant="ghost"
        prepend-icon="mdi-cloud-download-outline"
        @click="listViewRef?.openServerDialog()"
      >
        Load from server
      </AtlasButton>
      <AtlasButton
        variant="primary"
        prepend-icon="mdi-plus"
        @click="listViewRef?.onNew()"
      >
        New Study
      </AtlasButton>
    </template>
    <StudiesListView ref="listViewRef" />
  </AtlasPageShell>

  <!-- Editor mode: full sidebar + detail layout -->
  <StrategusLayout v-else>
    <component :is="activeComponent" />
  </StrategusLayout>
</template>

<script setup lang="ts">
import { computed, provide, onMounted, ref } from 'vue';
import { AtlasPageShell, AtlasButton } from '@ohdsi/atlas-ui';
import StrategusLayout from './components/StrategusLayout.vue';
import OverviewPanel from './views/OverviewPanel.vue';
import DesignPanel from './views/DesignPanel.vue';
import StudySetupPanel from './views/StudySetupPanel.vue';
import CohortsPanel from './views/CohortsPanel.vue';
import ComparisonsPanel from './views/ComparisonsPanel.vue';
import OutcomesPanel from './views/OutcomesPanel.vue';
import TimeAtRiskPanel from './views/TimeAtRiskPanel.vue';
import ExportPanel from './views/ExportPanel.vue';
import CohortDiagnosticsPanel from './views/modules/CohortDiagnosticsPanel.vue';
import CharacterizationPanel from './views/modules/CharacterizationPanel.vue';
import CohortIncidencePanel from './views/modules/CohortIncidencePanel.vue';
import CohortMethodPanel from './views/modules/CohortMethodPanel.vue';
import SccsPanel from './views/modules/SccsPanel.vue';
import PlpPanel from './views/modules/PlpPanel.vue';
import PlpValidationPanel from './views/modules/PlpValidationPanel.vue';
import TreatmentPatternsPanel from './views/modules/TreatmentPatternsPanel.vue';
import EvidenceSynthesisPanel from './views/modules/EvidenceSynthesisPanel.vue';
import StudiesListView from './views/StudiesListView.vue';
import { useStrategusStore } from './store/useStrategusStore';
import { useStudiesStore } from './store/useStudiesStore';

const props = defineProps<{ authContext: unknown; messageBus: unknown }>();
provide('messageBus', props.messageBus);
const store = useStrategusStore();
const studiesStore = useStudiesStore();
const listViewRef = ref<InstanceType<typeof StudiesListView> | null>(null);

const panelMap: Record<string, unknown> = {
  overview: OverviewPanel,
  // study + modules are one combined, scrollable page now
  study: DesignPanel,
  modules: DesignPanel,
  setup: StudySetupPanel,
  cohorts: CohortsPanel,
  comparisons: ComparisonsPanel,
  outcomes: OutcomesPanel,
  tar: TimeAtRiskPanel,
  export: ExportPanel,
  cohortDiagnostics: CohortDiagnosticsPanel,
  characterization: CharacterizationPanel,
  cohortIncidence: CohortIncidencePanel,
  cohortMethod: CohortMethodPanel,
  sccs: SccsPanel,
  plp: PlpPanel,
  plpValidation: PlpValidationPanel,
  treatmentPatterns: TreatmentPatternsPanel,
  evidenceSynthesis: EvidenceSynthesisPanel,
};

const activeComponent = computed(() => panelMap[store.activePanel] ?? OverviewPanel);

// Deep-link: the jobs "Open in Strategus" affordance navigates here with
// ?definition=<rowId>. On mount, fetch that server-stored definition and open it
// in the editor (same hydration path as opening a local study).
onMounted(() => {
  if (typeof window === 'undefined') return;
  const id = new URLSearchParams(window.location.search).get('definition');
  if (!id) return;
  studiesStore.loadServerDefinition(id).catch((e) => {
    // Non-fatal: fall back to the studies list if the definition can't be loaded.
    console.error('Failed to load server definition', id, e);
  });
});
</script>
