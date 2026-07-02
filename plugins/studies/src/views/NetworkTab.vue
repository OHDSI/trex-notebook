<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Network"
    title="Network studies"
    subtitle="Studies shared across the federated network"
  >
    <template #actions>
      <AtlasIconButton icon="mdi-account-plus-outline" ariaLabel="Sign up for the network" size="sm" @click="goToSignup" />
      <AtlasIconButton icon="mdi-cog-outline" ariaLabel="Network settings" size="sm" @click="goToSettings" />
    </template>

    <AtlasAlert v-if="error" severity="danger" class="mb-4">{{ error }}</AtlasAlert>

    <AtlasDataTable
      :headers="headers"
      :items="studies"
      :loading="loading"
      item-value="studyId"
    >
      <template #item.name="{ item }">
        <a class="text-primary" style="cursor: pointer" @click="openStudy()">{{ item.name }}</a>
      </template>
      <template #no-data>No network studies</template>
    </AtlasDataTable>
  </AtlasPageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AtlasPageShell, AtlasDataTable, AtlasIconButton, AtlasAlert } from '@ohdsi/atlas-ui';
import { listStudies, type Study } from '../data/network';

const studies = ref<Study[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Version', key: 'version' },
  { title: 'Status', key: 'status' },
];

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    studies.value = await listStudies();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openStudy(): void {
  window.location.href = '/plugins/network-plugin/';
}

function goToSignup(): void {
  window.location.href = '/plugins/network-plugin/';
}

function goToSettings(): void {
  window.location.href = '/plugins/network-plugin/';
}

onMounted(reload);
</script>
