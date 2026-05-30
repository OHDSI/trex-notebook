<template>
  <div>
    <h2 class="text-h6 mb-3">My submissions</h2>
    <v-text-field v-model="siteId" label="Site ID" append-inner-icon="mdi-magnify" @keyup.enter="load" />
    <v-table v-if="store.submissions.length">
      <thead>
        <tr><th>Study</th><th>Version</th><th>Status</th><th>Files</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in store.submissions" :key="`${s.studyId}-${s.version}`">
          <td>{{ s.studyId }}</td>
          <td>{{ s.version }}</td>
          <td><v-chip>{{ s.status }}</v-chip></td>
          <td>{{ s.files.length }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useNetworkStore } from '../store/useNetworkStore';

const store = useNetworkStore();
const siteId = ref('');
function load() {
  if (siteId.value) void store.loadMySubmissions(siteId.value);
}
</script>
