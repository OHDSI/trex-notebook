<template>
  <div>
    <h1 class="text-h5 mb-4">Submissions</h1>
    <v-text-field v-model="studyId" label="Study ID" append-inner-icon="mdi-magnify" @keyup.enter="load" />
    <v-table v-if="store.items.length">
      <thead>
        <tr><th>Site</th><th>Version</th><th>Status</th><th>Files</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="s in store.items" :key="submissionId(s)">
          <td>{{ s.siteId }}</td>
          <td>{{ s.version }}</td>
          <td><v-chip>{{ s.status }}</v-chip></td>
          <td>{{ s.files.length }}</td>
          <td class="text-right">
            <v-btn size="small" variant="text" @click="download(s)">Download</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Submission } from '@central/shared';
import { useSubmissionsStore, submissionId } from '../stores/submissions';

const store = useSubmissionsStore();
const studyId = ref('');

function load() {
  if (studyId.value) void store.fetchByStudy(studyId.value);
}
async function download(s: Submission) {
  const urls = await store.downloadUrls(submissionId(s));
  for (const u of urls) window.open(u.url, '_blank');
}
</script>
