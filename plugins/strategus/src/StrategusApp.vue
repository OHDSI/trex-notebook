<template>
  <StrategusLayout>
    <component :is="activeComponent" />
    <StudyTypePicker v-model="showTypePicker" @select="onTypeSelected" />
  </StrategusLayout>
</template>

<script setup lang="ts">
import { computed, provide, onMounted, ref, watch } from 'vue';
import StudyTypePicker from './components/StudyTypePicker.vue';
import { applyStudyTypePreset, type StudyTypeId } from './services/StudyTypePresets';
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
import { useStrategusStore } from './store/useStrategusStore';
import { useStudiesStore } from './store/useStudiesStore';

const props = defineProps<{ authContext: unknown; messageBus: unknown }>();
provide('messageBus', props.messageBus);
const store = useStrategusStore();
const studiesStore = useStudiesStore();

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

const activeComponent = computed(() => panelMap[store.activePanel] ?? DesignPanel);

const showTypePicker = ref(false);

function onTypeSelected(id: StudyTypeId | null): void {
  if (id) applyStudyTypePreset(store as unknown as Parameters<typeof applyStudyTypePreset>[0], id);
  store.activePanel = 'study';
}

// The combined Studies plugin overview is the single entry point for browsing
// studies + notebooks, so Strategus no longer surfaces its own standalone list.
// Whenever the editor closes (Back, or after delete) — i.e. the store returns to
// 'list' mode — bounce to the Studies overview instead of rendering the local
// StudiesListView.
function goToStudiesOverview(): void {
  (props.messageBus as { send?: (t: string, p: unknown) => void })?.send?.(
    'navigation:request',
    { path: '/plugins/studies-plugin/' },
  );
}
watch(
  () => studiesStore.mode,
  (mode) => {
    if (mode === 'list') goToStudiesOverview();
  },
);

// Deep-link: the jobs "Open in Strategus" affordance navigates here with
// ?definition=<rowId> (fetch + open a server-stored definition); the Studies
// "Local" tab navigates here with ?study=<localId> (open a local study) or
// ?new=1 (start a fresh study). Only one fires, in that precedence order.
// Under Atlas3's hash routing (createWebHashHistory), query params live in
// window.location.hash (e.g. "#/plugins/strategus-plugin/?new=1"), not
// window.location.search, which is always empty here.
function readHashQuery(): URLSearchParams {
  const hash = window.location.hash || '';
  const i = hash.indexOf('?');
  return i >= 0 ? new URLSearchParams(hash.slice(i + 1)) : new URLSearchParams();
}

onMounted(() => {
  if (typeof window === 'undefined') return;
  const params = readHashQuery();
  // A server definition IS an analysis_definition rowId now, so both
  // deep-links resolve through the same store method.
  const studyId = params.get('definition') ?? params.get('study');
  if (studyId) {
    studiesStore.openStudy(studyId).catch((e) => {
      // Non-fatal: fall back to the studies list if the study can't be loaded.
      console.error('Failed to load study', studyId, e);
    });
  } else if (params.has('new')) {
    store.resetToDefaults();
    studiesStore.openNew();
    // New studies start from the type picker; the chosen preset pre-selects
    // modules and defaults before the design page shows.
    showTypePicker.value = true;
  } else {
    // Direct navigation with no deep-link would otherwise show the standalone
    // Strategus list; send the user to the combined Studies overview instead.
    goToStudiesOverview();
  }
});
</script>
