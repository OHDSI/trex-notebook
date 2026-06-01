<template>
  <section class="envs-view">
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <p v-if="store.provisioning" class="note">Provisioning… renv::restore can take several minutes.</p>
    <table>
      <thead><tr><th>Environment</th><th>Path</th></tr></thead>
      <tbody>
        <tr v-for="e in store.envs" :key="e.envName"><td>{{ e.envName }}</td><td>{{ e.path }}</td></tr>
        <tr v-if="store.envs.length === 0"><td colspan="2" class="empty">No environments yet.</td></tr>
      </tbody>
    </table>
    <form class="provision" @submit.prevent="onProvision">
      <input data-test="env-name" v-model="envName" placeholder="env name (e.g. study1)" />
      <input data-test="lock-path" v-model="lockPath" placeholder="renv.lock path on the server" />
      <button data-test="provision" :disabled="!envName || !lockPath || store.provisioning">Provision</button>
    </form>
    <p class="note">Note: the job store is in-memory and resets if trex restarts.</p>
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useEnvsStore } from "../store/useEnvsStore";
const store = useEnvsStore();
const envName = ref("");
const lockPath = ref("");
async function onProvision() { await store.provision(envName.value, lockPath.value); }
onMounted(() => store.fetchEnvs());
</script>
<style scoped>
.envs-view { display: flex; flex-direction: column; gap: 12px; }
table { border-collapse: collapse; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; }
.empty { color: #888; }
.provision { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.provision input { padding: 4px 8px; }
.note { color: #666; font-size: 13px; }
.error { color: #c62828; }
</style>
