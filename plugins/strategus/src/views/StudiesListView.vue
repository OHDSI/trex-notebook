<template>
  <div class="studies-list">
    <!-- Hero header -->
    <div class="studies-list__header">
      <div class="text-overline text-medium-emphasis">
        OHDSI · Strategus
      </div>
      <div class="studies-list__accent" />
      <h1 class="text-h4 font-weight-light text-primary">
        Analysis Specifications
      </h1>
      <p class="text-body-2 text-medium-emphasis mt-1">
        Build and manage Strategus analysis specifications for distribution across OMOP sites.
      </p>
    </div>

    <!-- Toolbar -->
    <div class="studies-list__toolbar">
      <v-text-field
        v-model="store.searchTerm"
        label="Search studies"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="compact"
        clearable
        hide-details
        class="studies-list__search"
      />
      <div class="flex-grow-1" />
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        @click="onNew"
      >
        New Study
      </v-btn>
    </div>

    <!-- Empty state -->
    <div
      v-if="store.studies.length === 0"
      class="studies-list__empty"
    >
      <v-icon
        icon="mdi-flask-empty-outline"
        size="48"
        color="grey-lighten-1"
      />
      <div class="text-subtitle-1 mt-3">
        No studies yet
      </div>
      <div class="text-body-2 text-medium-emphasis mt-1">
        Create your first Strategus analysis to get started.
      </div>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        class="mt-4"
        @click="onNew"
      >
        New Study
      </v-btn>
    </div>

    <!-- No search results -->
    <div
      v-else-if="store.filteredStudies.length === 0"
      class="studies-list__empty"
    >
      <v-icon
        icon="mdi-magnify-close"
        size="48"
        color="grey-lighten-1"
      />
      <div class="text-subtitle-1 mt-3">
        No studies match your search
      </div>
    </div>

    <!-- Table -->
    <table
      v-else
      class="studies-table"
    >
      <thead>
        <tr>
          <th>Name</th>
          <th class="studies-table__col-modules">
            Modules
          </th>
          <th class="studies-table__col-updated">
            Updated
          </th>
          <th class="studies-table__col-actions" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="study in store.filteredStudies"
          :key="study.id"
          class="studies-table__row"
          @click="onOpen(study.id)"
        >
          <td>
            <div class="studies-table__name">
              {{ study.name }}
            </div>
            <div
              v-if="study.description"
              class="studies-table__desc"
            >
              {{ study.description }}
            </div>
          </td>
          <td>
            <div class="d-flex flex-wrap ga-1">
              <span
                v-for="mod in enabledModuleLabels(study)"
                :key="mod"
                class="module-chip"
              >{{ mod }}</span>
            </div>
          </td>
          <td class="text-medium-emphasis text-caption">
            {{ formatDate(study.updatedAt) }}
          </td>
          <td>
            <div class="studies-table__actions">
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                density="comfortable"
                @click.stop="onOpen(study.id)"
              />
              <v-btn
                icon="mdi-content-copy"
                size="small"
                variant="text"
                density="comfortable"
                @click.stop="onDuplicate(study.id)"
              />
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                density="comfortable"
                color="error"
                @click.stop="confirmDelete(study.id)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Delete dialog -->
    <v-dialog
      v-model="deleteDialogOpen"
      max-width="420"
    >
      <v-card>
        <v-card-title class="text-h6">
          Delete study?
        </v-card-title>
        <v-card-text>
          This will permanently remove
          <strong>{{ pendingDeleteName }}</strong>
          and cannot be undone.
        </v-card-text>
        <v-card-actions>
          <div class="flex-grow-1" />
          <v-btn
            variant="text"
            @click="deleteDialogOpen = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            @click="doDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStudiesStore, type StudyRecord } from '../store/useStudiesStore';
import { useStrategusStore } from '../store/useStrategusStore';

const store = useStudiesStore();
const strategus = useStrategusStore();

const deleteDialogOpen = ref(false);
const pendingDeleteId = ref<string | null>(null);
const pendingDeleteName = computed(() => {
  if (!pendingDeleteId.value) return '';
  return store.studies.find((s) => s.id === pendingDeleteId.value)?.name ?? '';
});

const MODULE_LABELS: Record<string, string> = {
  CohortDiagnostics: 'Diagnostics',
  Characterization: 'Characterization',
  CohortIncidence: 'Incidence',
  CohortMethod: 'Cohort Method',
  SCCS: 'SCCS',
  PLP: 'Prediction',
  PLPValidation: 'PLP Validation',
  TreatmentPatterns: 'Treatment Patterns',
  EvidenceSynthesis: 'Evidence Synthesis',
};

function enabledModuleLabels(study: StudyRecord): string[] {
  const modules = (study.state.enabledModules as Record<string, boolean> | undefined) ?? {};
  return Object.entries(modules)
    .filter(([, on]) => on)
    .map(([key]) => MODULE_LABELS[key] ?? key);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function onNew(): void {
  strategus.resetToDefaults();
  store.openNew();
}

function onOpen(id: string): void {
  const study = store.openStudy(id);
  if (study) {
    strategus.restore(study.state);
  }
}

function onDuplicate(id: string): void {
  store.duplicateStudy(id);
}

function confirmDelete(id: string): void {
  pendingDeleteId.value = id;
  deleteDialogOpen.value = true;
}

function doDelete(): void {
  if (pendingDeleteId.value) {
    store.deleteStudy(pendingDeleteId.value);
  }
  deleteDialogOpen.value = false;
  pendingDeleteId.value = null;
}
</script>

<style scoped>
.studies-list { padding: 28px 32px; }

.studies-list__header { margin-bottom: 24px; }
.studies-list__accent {
  width: 32px;
  height: 2px;
  background: #eb6622;
  margin: 6px 0 10px;
}

.studies-list__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.studies-list__search { flex: 0 1 360px; }

.studies-list__empty {
  text-align: center;
  padding: 64px 24px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 10px;
}

/* Table */
.studies-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.studies-table thead th {
  text-align: left;
  padding: 10px 16px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.55);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.studies-table__col-modules { width: 30%; }
.studies-table__col-updated { width: 120px; }
.studies-table__col-actions { width: 130px; }

.studies-table__row {
  cursor: pointer;
  transition: background-color 120ms ease;
}
.studies-table__row:hover {
  background: rgba(31, 66, 90, 0.03);
}
.studies-table__row > td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  vertical-align: middle;
}

.studies-table__name {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.87);
}
.studies-table__desc {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
  margin-top: 2px;
  max-width: 480px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-chip {
  display: inline-block;
  padding: 1px 8px;
  background: rgba(31, 66, 90, 0.08);
  color: #1f425a;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.studies-table__actions {
  display: flex;
  gap: 2px;
  opacity: 0.4;
  transition: opacity 120ms ease;
}
.studies-table__row:hover .studies-table__actions {
  opacity: 1;
}
</style>
