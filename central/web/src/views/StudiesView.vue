<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Studies</h1>
      <v-spacer />
      <NewStudyDialog @created="refresh" />
    </div>
    <v-table>
      <thead>
        <tr><th>Name</th><th>Version</th><th>Status</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="s in store.studies" :key="s.studyId">
          <td>{{ s.name }}</td>
          <td>{{ s.version }}</td>
          <td><v-chip>{{ s.status }}</v-chip></td>
          <td class="text-right">
            <v-btn v-if="s.status === 'draft'" size="small" @click="publish(s.studyId)">Publish</v-btn>
            <v-btn v-if="s.status === 'published'" size="small" variant="text" @click="archive(s.studyId)">Archive</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useStudiesStore } from '../stores/studies';
import NewStudyDialog from '../components/NewStudyDialog.vue';

const store = useStudiesStore();
function refresh() {
  void store.fetchAll();
}
function publish(id: string) {
  void store.publish(id);
}
function archive(id: string) {
  void store.archive(id);
}
onMounted(refresh);
</script>
