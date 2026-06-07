<template>
  <div class="env-section">
    <AtlasAlert v-if="store.error" severity="danger" variant="tonal" class="mb-3">{{ store.error }}</AtlasAlert>
    <AtlasAlert v-if="store.provisioning" severity="info" variant="tonal" class="mb-3">
      Provisioning… renv::restore can take several minutes.
    </AtlasAlert>

    <AtlasDataTable
      :headers="envHeaders"
      :items="store.envs"
      hide-default-footer
      no-data-text="No environments yet."
      data-test="env-table"
    >
      <template #item.path="{ item }">
        <span class="text-medium-emphasis">{{ item.path }}</span>
      </template>
      <template #item.actions="{ item }">
        <div class="text-right">
          <AtlasIconButton
            icon="mdi-delete" size="sm" variant="text" tone="danger" ariaLabel="Delete environment"
            :loading="store.deleting === item.envName"
            :data-test="`env-delete-${item.envName}`"
            @click="confirm = item.envName"
          />
        </div>
      </template>
    </AtlasDataTable>

    <v-form class="d-flex ga-2 align-center flex-wrap mt-4" @submit.prevent="onProvision">
      <AtlasTextField v-model="envName" label="env name (e.g. study1)" hide-details density="compact" style="max-width: 220px" data-test="env-name" />
      <AtlasTextField v-model="lockPath" label="renv.lock path on the server" hide-details density="compact" style="max-width: 320px" data-test="lock-path" />
      <AtlasButton type="submit" :disabled="!envName || !lockPath || store.provisioning" data-test="provision">Provision</AtlasButton>
    </v-form>

    <v-dialog v-model="dialogOpen" max-width="420">
      <AtlasCard>
        <v-card-title>Delete environment</v-card-title>
        <v-card-text>Delete the R environment <strong>{{ confirm }}</strong>? This removes its installed packages and cannot be undone.</v-card-text>
        <v-card-actions>
          <AtlasSpacer />
          <AtlasButton variant="ghost" @click="confirm = null">Cancel</AtlasButton>
          <AtlasButton variant="danger" data-test="env-delete-confirm" @click="onDelete">Delete</AtlasButton>
        </v-card-actions>
      </AtlasCard>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEnvsStore } from '@/stores/envs'
import { AtlasAlert, AtlasDataTable, AtlasIconButton, AtlasTextField, AtlasButton, AtlasCard, AtlasSpacer } from '@ohdsi/atlas-ui'

const envHeaders = [
  { key: 'envName', title: 'Environment' },
  { key: 'path', title: 'Path', sortable: false },
  { key: 'actions', title: 'Actions', sortable: false, align: 'end' as const },
]

const store = useEnvsStore()
const envName = ref('')
const lockPath = ref('')
const confirm = ref<string | null>(null)
const dialogOpen = computed({ get: () => confirm.value !== null, set: v => { if (!v) confirm.value = null } })

async function onProvision() {
  await store.provision(envName.value, lockPath.value)
  if (!store.error) { envName.value = ''; lockPath.value = '' }
}
async function onDelete() {
  const name = confirm.value
  confirm.value = null
  if (name) await store.deleteEnv(name)
}
onMounted(() => store.fetchEnvs())
</script>
