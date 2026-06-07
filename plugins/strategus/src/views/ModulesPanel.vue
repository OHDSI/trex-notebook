<template>
  <div class="modules-panel">
    <div class="text-overline text-medium-emphasis">
      Strategus Analysis
    </div>
    <div style="width: 28px; height: 2px; background: #eb6622; margin: 4px 0 8px" />
    <h1 class="text-h4 font-weight-light text-primary mb-1">
      Modules
    </h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Toggle each module to include it in the spec. Settings appear inline when enabled.
    </p>

    <!-- Only enabled modules render here; toggle modules on/off from the left nav. -->
    <section
      v-for="mod in enabledSections"
      :id="mod.id"
      :key="mod.id"
      class="module-section"
    >
      <h2 class="module-section__heading">
        <AtlasIcon
          :icon="mod.icon"
          size="18"
        />
        <span class="module-section__title">{{ mod.title }}</span>
        <AtlasTooltip
          :text="statusFor(mod.key).message"
          location="right"
          :open-delay="200"
        >
          <template #activator="{ props: tipProps }">
            <AtlasIcon
              v-bind="tipProps"
              :icon="iconFor(mod.key)"
              :color="colorFor(mod.key)"
              size="16"
              class="ml-2"
            />
          </template>
        </AtlasTooltip>
        <AtlasSpacer />
        <AtlasSwitch
          :model-value="true"
          color="primary"
          inset
          @update:model-value="store.toggleModule(mod.moduleName)"
        />
      </h2>
      <component
        :is="mod.component"
        :embedded="true"
      />
    </section>

    <p
      v-if="enabledSections.length === 0"
      class="module-empty text-body-2 text-medium-emphasis"
    >
      No modules enabled. Use the toggles in the left navigation to add modules to this study.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasIcon, AtlasTooltip, AtlasSpacer, AtlasSwitch } from '@ohdsi/atlas-ui';
import CohortDiagnosticsPanel from './modules/CohortDiagnosticsPanel.vue';
import CharacterizationPanel from './modules/CharacterizationPanel.vue';
import CohortIncidencePanel from './modules/CohortIncidencePanel.vue';
import CohortMethodPanel from './modules/CohortMethodPanel.vue';
import SccsPanel from './modules/SccsPanel.vue';
import PlpPanel from './modules/PlpPanel.vue';
import PlpValidationPanel from './modules/PlpValidationPanel.vue';
import TreatmentPatternsPanel from './modules/TreatmentPatternsPanel.vue';
import EvidenceSynthesisPanel from './modules/EvidenceSynthesisPanel.vue';
import { useStrategusStore } from '../store/useStrategusStore';
import { useValidation } from '../store/validation';
import type { SidebarItem, ValidationStatus } from '../models/Validation';

type ModuleName =
  | 'CohortDiagnostics'
  | 'Characterization'
  | 'CohortIncidence'
  | 'CohortMethod'
  | 'SCCS'
  | 'PLP'
  | 'PLPValidation'
  | 'TreatmentPatterns'
  | 'EvidenceSynthesis';

const store = useStrategusStore();
const { statusFor } = useValidation();

interface ModuleSection {
  id: string;
  key: SidebarItem;
  moduleName: ModuleName;
  icon: string;
  title: string;
  component: unknown;
}

const moduleSections = computed<ModuleSection[]>(() => [
  { id: 'sec-cohortDiagnostics', key: 'cohortDiagnostics', moduleName: 'CohortDiagnostics', icon: 'mdi-stethoscope', title: 'Cohort Diagnostics', component: CohortDiagnosticsPanel },
  { id: 'sec-characterization', key: 'characterization', moduleName: 'Characterization', icon: 'mdi-chart-bar', title: 'Characterization', component: CharacterizationPanel },
  { id: 'sec-cohortIncidence', key: 'cohortIncidence', moduleName: 'CohortIncidence', icon: 'mdi-chart-line', title: 'Incidence', component: CohortIncidencePanel },
  { id: 'sec-cohortMethod', key: 'cohortMethod', moduleName: 'CohortMethod', icon: 'mdi-scale-balance', title: 'Cohort Method', component: CohortMethodPanel },
  { id: 'sec-sccs', key: 'sccs', moduleName: 'SCCS', icon: 'mdi-lightning-bolt', title: 'SCCS', component: SccsPanel },
  { id: 'sec-plp', key: 'plp', moduleName: 'PLP', icon: 'mdi-crystal-ball', title: 'Prediction', component: PlpPanel },
  { id: 'sec-plpValidation', key: 'plpValidation', moduleName: 'PLPValidation', icon: 'mdi-check-decagram-outline', title: 'PLP Validation', component: PlpValidationPanel },
  { id: 'sec-treatmentPatterns', key: 'treatmentPatterns', moduleName: 'TreatmentPatterns', icon: 'mdi-sitemap-outline', title: 'Treatment Patterns', component: TreatmentPatternsPanel },
  { id: 'sec-evidenceSynthesis', key: 'evidenceSynthesis', moduleName: 'EvidenceSynthesis', icon: 'mdi-merge', title: 'Evidence Synthesis', component: EvidenceSynthesisPanel },
]);

const enabledSections = computed(() =>
  moduleSections.value.filter((mod) => store.isModuleEnabled(mod.moduleName))
);

const ICON_BY_STATUS: Record<ValidationStatus, string> = {
  valid: 'mdi-check-circle',
  warning: 'mdi-alert-circle',
  error: 'mdi-close-circle',
  neutral: 'mdi-circle-outline',
};
const COLOR_BY_STATUS: Record<ValidationStatus, string> = {
  valid: 'success',
  warning: 'warning',
  error: 'error',
  neutral: 'grey-lighten-1',
};

function iconFor(key: SidebarItem): string {
  return ICON_BY_STATUS[statusFor(key).status];
}
function colorFor(key: SidebarItem): string {
  return COLOR_BY_STATUS[statusFor(key).status];
}
</script>

<style scoped>
.module-section {
  padding: 18px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  scroll-margin-top: 24px;
}
.module-section:first-of-type {
  border-top: none;
  padding-top: 12px;
}
.module-section__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(0, 0, 0, 0.72);
  margin-bottom: 10px;
}
.module-section__heading .v-icon {
  color: rgba(0, 0, 0, 0.4);
}
.module-section__title {
  flex: 0 0 auto;
}

.module-empty {
  padding: 16px 4px;
}
</style>
