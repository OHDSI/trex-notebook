<template>
  <div>
    <h2 class="text-h6 mb-3">My submissions</h2>
    <AtlasTextField v-model="siteId" label="Site ID" append-icon="mdi-magnify" @keyup.enter="load" />
    <AtlasDataTable v-if="store.submissions.length" :headers="headers" :items="store.submissions" hide-default-footer>
      <template #item.status="{ item }">
        <AtlasChip>{{ item.status }}</AtlasChip>
      </template>
      <template #item.files="{ item }">
        {{ item.files.length }}
      </template>
    </AtlasDataTable>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AtlasTextField, AtlasDataTable, AtlasChip } from '@ohdsi/atlas-ui';
import { useNetworkStore } from '../store/useNetworkStore';

const store = useNetworkStore();
const siteId = ref('');

const headers = [
  { key: 'studyId', title: 'Study' },
  { key: 'version', title: 'Version' },
  { key: 'status', title: 'Status', sortable: false },
  { key: 'files', title: 'Files', sortable: false },
];

function load() {
  if (siteId.value) void store.loadMySubmissions(siteId.value);
}
</script>
