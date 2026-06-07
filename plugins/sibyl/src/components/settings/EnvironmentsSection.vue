<template>
  <div class="env-section">
    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-3">{{ store.error }}</v-alert>
    <v-alert v-if="store.provisioning" type="info" variant="tonal" class="mb-3">
      Provisioning… renv::restore can take several minutes.
    </v-alert>

    <v-table density="compact" data-test="env-table">
      <thead>
        <tr><th>Environment</th><th>Path</th><th class="text-right">Actions</th></tr>
      </thead>
      <tbody>
        <tr v-for="e in store.envs" :key="e.envName">
          <td>{{ e.envName }}</td>
          <td class="text-medium-emphasis">{{ e.path }}</td>
          <td class="text-right">
            <v-btn
              icon="mdi-delete" size="small" variant="text" color="error"
              :loading="store.deleting === e.envName"
              :data-test="`env-delete-${e.envName}`"
              @click="confirm = e.envName"
            />
          </td>
        </tr>
        <tr v-if="store.envs.length === 0">
          <td colspan="3" class="text-medium-emphasis">No environments yet.</td>
        </tr>
      </tbody>
    </v-table>

    <v-form class="d-flex ga-2 align-center flex-wrap mt-4" @submit.prevent="onProvision">
      <v-text-field v-model="envName" label="env name (e.g. study1)" hide-details density="compact" style="max-width: 220px" data-test="env-name" />
      <v-text-field v-model="lockPath" label="renv.lock path on the server" hide-details density="compact" style="max-width: 320px" data-test="lock-path" />
      <v-btn type="submit" :disabled="!envName || !lockPath || store.provisioning" data-test="provision">Provision</v-btn>
    </v-form>

    <v-dialog v-model="dialogOpen" max-width="420">
      <v-card>
        <v-card-title>Delete environment</v-card-title>
        <v-card-text>Delete the R environment <strong>{{ confirm }}</strong>? This removes its installed packages and cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirm = null">Cancel</v-btn>
          <v-btn color="error" data-test="env-delete-confirm" @click="onDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEnvsStore } from '@/stores/envs'

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
