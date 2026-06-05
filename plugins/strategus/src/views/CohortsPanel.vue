<template>
  <div>
    <!-- Page header (standalone only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Study Design
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
    </template>
    <div
      v-if="!props.embedded"
      class="mb-4"
    >
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Cohorts
      </h1>
      <p class="text-body-2 text-medium-emphasis">
        Select cohorts and assign their roles
      </p>
    </div>

    <v-table
      v-if="store.cohorts.length > 0"
      density="compact"
      class="bordered-table mb-2"
    >
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Role</th>
          <th>Subjects</th>
          <th style="width: 48px" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="cohort in store.cohorts"
          :key="cohort.cohortId"
        >
          <td class="text-body-2 text-medium-emphasis">
            {{ cohort.cohortId }}
          </td>
          <td class="text-body-2">
            {{ cohort.cohortName }}
          </td>
          <td style="min-width: 160px">
            <v-select
              :model-value="cohort.role"
              :items="roleOptions"
              density="compact"
              variant="plain"
              hide-details
              class="role-select"
              @update:model-value="val => onRoleChange(cohort, val)"
            />
          </td>
          <td class="text-body-2 text-medium-emphasis">
            {{ cohort.subjectCount != null ? cohort.subjectCount.toLocaleString() : '—' }}
          </td>
          <td>
            <v-btn
              icon
              size="x-small"
              variant="text"
              color="error"
              @click="removeCohort(cohort.cohortId)"
            >
              <v-icon size="16">
                mdi-delete-outline
              </v-icon>
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
    <div
      v-else
      class="empty-state-compact"
    >
      No cohorts yet.
    </div>

    <div class="d-flex justify-end mb-4">
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-plus"
        @click="showAddDialog = true"
      >
        Add Cohort
      </v-btn>
    </div>

    <!-- CohortPicker Dialog -->
    <CohortPicker
      v-model="showAddDialog"
      :message-bus="messageBus"
      @select="onCohortSelected"
    />

    <!-- Cohort Subsets Advanced Section -->
    <AdvancedSection>
      <div class="text-subtitle-2 mb-2">
        Cohort Subsets
      </div>
      <p class="text-caption text-medium-emphasis mb-3">
        Define named subset restrictions (e.g., first-time use) and apply them to cohorts. User-defined
        subsets use IDs ≥ 1000 to avoid collision with TCI-derived subsets.
      </p>

      <!-- Subset definition cards -->
      <div
        v-if="store.cohortSubsetDefinitions.length > 0"
        class="mb-3"
      >
        <div
          v-for="def in store.cohortSubsetDefinitions"
          :key="def.id"
          class="subset-card d-flex align-center pa-2 mb-2 rounded"
        >
          <div class="flex-grow-1">
            <div class="text-body-2 font-weight-medium">
              {{ def.name }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ def.operators.length }} operator{{ def.operators.length !== 1 ? 's' : '' }}
              · ID {{ def.id }}
            </div>
          </div>
          <v-btn
            icon="mdi-pencil"
            size="x-small"
            variant="text"
            class="mr-1"
            @click="openEditSubsetDialog(def)"
          />
          <v-btn
            icon="mdi-delete"
            size="x-small"
            variant="text"
            color="error"
            @click="deleteSubsetDef(def.id)"
          />
        </div>
      </div>
      <div
        v-else
        class="text-body-2 text-medium-emphasis mb-3"
      >
        No subset definitions yet.
      </div>

      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-plus"
        class="mb-4"
        @click="openAddSubsetDialog"
      >
        Add Subset Definition
      </v-btn>

      <!-- Assignment table: cohorts × subsets -->
      <template v-if="store.cohortSubsetDefinitions.length > 0 && store.cohorts.length > 0">
        <div class="text-caption text-medium-emphasis mb-1">
          Apply subsets to cohorts
        </div>
        <v-table
          density="compact"
          class="bordered-table mb-2"
        >
          <thead>
            <tr>
              <th>Cohort</th>
              <th
                v-for="def in store.cohortSubsetDefinitions"
                :key="def.id"
                class="text-center"
                style="min-width: 80px"
              >
                <span
                  class="text-caption"
                  :title="def.name"
                >{{ def.name }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="cohort in store.cohorts"
              :key="cohort.cohortId"
            >
              <td class="text-body-2">
                {{ cohort.cohortName }}
              </td>
              <td
                v-for="def in store.cohortSubsetDefinitions"
                :key="def.id"
                class="text-center"
              >
                <v-checkbox
                  :model-value="isSubsetAssigned(cohort.cohortId, def.id)"
                  density="compact"
                  hide-details
                  class="d-flex justify-center"
                  @update:model-value="val => setSubsetAssignment(cohort.cohortId, def.id, !!val)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </AdvancedSection>

    <!-- Add/Edit Subset Definition Dialog -->
    <AtlasDialog
      v-model="showSubsetDialog"
      eyebrow="COHORT"
      :title="(editingSubset ? 'Edit' : 'Add') + ' Subset Definition'"
      :max-width="600"
      @close="showSubsetDialog = false"
    >
      <v-text-field
        v-model="subsetForm.name"
        label="Name"
        density="compact"
        variant="outlined"
        class="mb-3"
        hide-details
      />

      <div class="text-caption text-medium-emphasis mb-2">
        Operators
      </div>

      <div
        v-for="(op, idx) in subsetForm.operators"
        :key="idx"
        class="operator-card pa-3 mb-2 rounded"
      >
        <div class="d-flex align-center mb-2">
          <v-select
            v-model="op.type"
            :items="operatorTypeItems"
            label="Type"
            density="compact"
            variant="outlined"
            hide-details
            class="flex-grow-1 mr-2"
          />
          <v-btn
            icon="mdi-delete"
            size="x-small"
            variant="text"
            color="error"
            @click="removeOperator(idx)"
          />
        </div>

        <!-- LimitSubsetOperator fields -->
        <template v-if="op.type === 'LimitSubsetOperator'">
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="op.priorTime"
                label="Prior time (days)"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="op.followUpTime"
                label="Follow-up time (days)"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
          </v-row>
          <v-select
            v-model="op.limitTo"
            :items="limitToItems"
            label="Limit to"
            density="compact"
            variant="outlined"
            hide-details
            class="mt-2"
          />
          <v-row
            dense
            class="mt-2"
          >
            <v-col cols="6">
              <v-text-field
                v-model="op.calendarStartDate"
                label="Calendar start date"
                density="compact"
                variant="outlined"
                hide-details
                placeholder="YYYY-MM-DD"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="op.calendarEndDate"
                label="Calendar end date"
                density="compact"
                variant="outlined"
                hide-details
                placeholder="YYYY-MM-DD"
              />
            </v-col>
          </v-row>
        </template>

        <!-- DemographicSubsetOperator fields -->
        <template v-else-if="op.type === 'DemographicSubsetOperator'">
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="op.ageMin"
                label="Min age"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="op.ageMax"
                label="Max age"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
          </v-row>
          <v-select
            v-model="op.gender"
            :items="genderItems"
            label="Gender"
            density="compact"
            variant="outlined"
            hide-details
            multiple
            chips
            class="mt-2"
          />
        </template>

        <!-- CohortSubsetOperator fields -->
        <template v-else-if="op.type === 'CohortSubsetOperator'">
          <v-select
            v-model="op.cohortIds"
            :items="cohortSelectItems"
            label="Cohorts"
            density="compact"
            variant="outlined"
            hide-details
            multiple
            chips
            class="mb-2"
          />
          <v-checkbox
            v-model="op.negate"
            label="Negate (exclude these cohorts)"
            density="compact"
            hide-details
          />
        </template>
      </div>

      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-plus"
        @click="addOperator"
      >
        Add Operator
      </v-btn>

      <template #actions>
        <AtlasButton
          variant="ghost"
          @click="showSubsetDialog = false"
        >
          Cancel
        </AtlasButton>
        <AtlasButton
          :disabled="!subsetForm.name.trim()"
          @click="saveSubsetDef"
        >
          Save
        </AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import type { CohortEntry, CohortRole, CohortSubsetDefinition, CohortSubsetOperator } from '../store/useStrategusStore';
import CohortPicker from '../components/CohortPicker.vue';
import AdvancedSection from '../components/AdvancedSection.vue';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const messageBus = inject('messageBus') as
  | { request: <TReq, TRes>(t: string, p: TReq) => Promise<TRes> }
  | undefined;

const roleOptions: CohortRole[] = ['Target', 'Comparator', 'Outcome', 'Indication'];

const showAddDialog = ref(false);

// ── Subset dialog state ───────────────────────────────────────────────────────

const showSubsetDialog = ref(false);
const editingSubset = ref<CohortSubsetDefinition | null>(null);

interface OperatorForm extends CohortSubsetOperator {
  // all fields from CohortSubsetOperator, already covers everything
}

interface SubsetForm {
  name: string;
  operators: OperatorForm[];
}

const subsetForm = ref<SubsetForm>({ name: '', operators: [] });

const operatorTypeItems = [
  { title: 'Limit (first use, time window)', value: 'LimitSubsetOperator' },
  { title: 'Demographic (age, gender)', value: 'DemographicSubsetOperator' },
  { title: 'Cohort membership', value: 'CohortSubsetOperator' },
];

const limitToItems = [
  { title: 'First ever', value: 'firstEver' },
  { title: 'All', value: 'all' },
  { title: 'Last ever', value: 'lastEver' },
  { title: 'Earliest remaining', value: 'earliestRemaining' },
  { title: 'Latest remaining', value: 'latestRemaining' },
];

const genderItems = [
  { title: 'Male (8507)', value: 8507 },
  { title: 'Female (8532)', value: 8532 },
];

const cohortSelectItems = computed(() =>
  store.cohorts.map((c) => ({ title: `${c.cohortName} (${c.cohortId})`, value: c.cohortId }))
);

function nextSubsetId(): number {
  if (store.cohortSubsetDefinitions.length === 0) return 1000;
  return Math.max(...store.cohortSubsetDefinitions.map((d) => d.id)) + 1;
}

function openAddSubsetDialog() {
  editingSubset.value = null;
  subsetForm.value = { name: '', operators: [] };
  showSubsetDialog.value = true;
}

function openEditSubsetDialog(def: CohortSubsetDefinition) {
  editingSubset.value = def;
  subsetForm.value = {
    name: def.name,
    operators: def.operators.map((op) => ({ ...op })),
  };
  showSubsetDialog.value = true;
}

function addOperator() {
  subsetForm.value.operators.push({ type: 'LimitSubsetOperator', limitTo: 'firstEver', priorTime: 365, followUpTime: 1 });
}

function removeOperator(idx: number) {
  subsetForm.value.operators.splice(idx, 1);
}

function saveSubsetDef() {
  if (!subsetForm.value.name.trim()) return;

  if (editingSubset.value) {
    const idx = store.cohortSubsetDefinitions.findIndex((d) => d.id === editingSubset.value!.id);
    if (idx !== -1) {
      store.cohortSubsetDefinitions[idx] = {
        id: editingSubset.value.id,
        name: subsetForm.value.name,
        operators: subsetForm.value.operators.map((op) => ({ ...op })),
      };
    }
  } else {
    store.cohortSubsetDefinitions.push({
      id: nextSubsetId(),
      name: subsetForm.value.name,
      operators: subsetForm.value.operators.map((op) => ({ ...op })),
    });
  }

  showSubsetDialog.value = false;
}

function deleteSubsetDef(id: number) {
  const idx = store.cohortSubsetDefinitions.findIndex((d) => d.id === id);
  if (idx !== -1) store.cohortSubsetDefinitions.splice(idx, 1);
  // Remove assignments for this subset
  for (const assignment of store.cohortSubsetAssignments) {
    const sIdx = assignment.subsetIds.indexOf(id);
    if (sIdx !== -1) assignment.subsetIds.splice(sIdx, 1);
  }
  // Remove empty assignments
  const toRemove = store.cohortSubsetAssignments
    .filter((a) => a.subsetIds.length === 0)
    .map((a) => a.cohortId);
  for (const cohortId of toRemove) {
    const aIdx = store.cohortSubsetAssignments.findIndex((a) => a.cohortId === cohortId);
    if (aIdx !== -1) store.cohortSubsetAssignments.splice(aIdx, 1);
  }
}

// ── Assignment helpers ────────────────────────────────────────────────────────

function isSubsetAssigned(cohortId: number, subsetId: number): boolean {
  const assignment = store.cohortSubsetAssignments.find((a) => a.cohortId === cohortId);
  return assignment ? assignment.subsetIds.includes(subsetId) : false;
}

function setSubsetAssignment(cohortId: number, subsetId: number, assign: boolean) {
  let assignment = store.cohortSubsetAssignments.find((a) => a.cohortId === cohortId);
  if (assign) {
    if (!assignment) {
      store.cohortSubsetAssignments.push({ cohortId, subsetIds: [subsetId] });
    } else if (!assignment.subsetIds.includes(subsetId)) {
      assignment.subsetIds.push(subsetId);
    }
  } else {
    if (assignment) {
      const idx = assignment.subsetIds.indexOf(subsetId);
      if (idx !== -1) assignment.subsetIds.splice(idx, 1);
      if (assignment.subsetIds.length === 0) {
        const aIdx = store.cohortSubsetAssignments.indexOf(assignment);
        store.cohortSubsetAssignments.splice(aIdx, 1);
      }
    }
  }
}

// ── Cohort management ─────────────────────────────────────────────────────────

function syncOutcomeEntry(cohortId: number, cohortName: string, add: boolean) {
  const idx = store.outcomes.findIndex(o => o.cohortId === cohortId);
  if (add && idx === -1) {
    store.outcomes.push({ cohortId, cleanWindow: 365 });
  } else if (!add && idx !== -1) {
    store.outcomes.splice(idx, 1);
  }
}

function onCohortSelected(cohort: { cohortId: number; cohortName: string; subjectCount: number | null; cohortDefinition: string }) {
  const entry: CohortEntry = {
    cohortId: cohort.cohortId,
    cohortName: cohort.cohortName,
    role: 'Target',
    subjectCount: cohort.subjectCount,
    cohortDefinition: cohort.cohortDefinition,
  };

  store.cohorts.push(entry);

  if (entry.role === 'Outcome') {
    syncOutcomeEntry(entry.cohortId, entry.cohortName, true);
  }
}

function onRoleChange(cohort: CohortEntry, newRole: CohortRole) {
  const wasOutcome = cohort.role === 'Outcome';
  const isOutcome = newRole === 'Outcome';
  cohort.role = newRole;

  if (!wasOutcome && isOutcome) {
    syncOutcomeEntry(cohort.cohortId, cohort.cohortName, true);
  } else if (wasOutcome && !isOutcome) {
    syncOutcomeEntry(cohort.cohortId, cohort.cohortName, false);
  }
}

function removeCohort(cohortId: number) {
  const idx = store.cohorts.findIndex(c => c.cohortId === cohortId);
  if (idx !== -1) store.cohorts.splice(idx, 1);
  // Also remove from outcomes
  syncOutcomeEntry(cohortId, '', false);
  // Remove subset assignments for this cohort
  const aIdx = store.cohortSubsetAssignments.findIndex((a) => a.cohortId === cohortId);
  if (aIdx !== -1) store.cohortSubsetAssignments.splice(aIdx, 1);
}
</script>

<style scoped>
.role-select :deep(.v-field__input) {
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: unset;
}

.subset-card {
  background: rgb(var(--v-theme-surface-variant));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.operator-card {
  background: rgba(var(--v-theme-surface-variant), 0.5);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
