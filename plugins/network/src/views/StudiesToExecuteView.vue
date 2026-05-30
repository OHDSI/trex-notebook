<template>
  <div>
    <h2 class="text-h6 mb-3">Studies to execute</h2>
    <v-table>
      <thead>
        <tr><th>Name</th><th>Version</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="s in store.studies" :key="s.studyId">
          <td>{{ s.name }}</td>
          <td>{{ s.version }}</td>
          <td class="text-right">
            <v-btn size="small" variant="text" :loading="busy === s.studyId" @click="download(s.studyId)">
              Download package
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useNetworkStore } from '../store/useNetworkStore';

const store = useNetworkStore();
const busy = ref('');

onMounted(() => void store.loadStudies());

async function download(studyId: string) {
  busy.value = studyId;
  try {
    const pkg = await store.getPackage(studyId);
    window.open(pkg.strategusUrl, '_blank');
    window.open(pkg.renvLockUrl, '_blank');
  } finally {
    busy.value = '';
  }
}
</script>
