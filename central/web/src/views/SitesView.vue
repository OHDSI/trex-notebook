<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Sites</h1>
      <v-spacer />
      <RegisterSiteDialog @created="refresh" />
    </div>
    <v-table>
      <thead>
        <tr><th>Name</th><th>Contact</th><th>Status</th><th>Client ID</th><th class="text-right">Actions</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in store.sites" :key="s.siteId">
          <td>{{ s.name }}</td>
          <td>{{ s.contact }}</td>
          <td><v-chip :color="s.status === 'active' ? 'success' : 'grey'">{{ s.status }}</v-chip></td>
          <td><code>{{ s.cognitoClientId }}</code></td>
          <td class="text-right">
            <v-btn
              size="small"
              variant="text"
              :disabled="busy === s.siteId"
              @click="toggleStatus(s)"
            >
              {{ s.status === 'active' ? 'Disable' : 'Enable' }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              icon="mdi-delete"
              :loading="busy === s.siteId"
              @click="askDelete(s)"
            />
          </td>
        </tr>
      </tbody>
    </v-table>

    <!-- delete confirmation -->
    <v-dialog v-model="confirmOpen" max-width="440">
      <v-card class="pa-4">
        <v-card-title>Delete site</v-card-title>
        <v-card-text>
          Permanently delete <strong>{{ pending?.name }}</strong> and its client credentials?
          This cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmOpen = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Site } from '@central/shared';
import { useSitesStore } from '../stores/sites';
import RegisterSiteDialog from '../components/RegisterSiteDialog.vue';

const store = useSitesStore();
const busy = ref<string | null>(null);
const confirmOpen = ref(false);
const deleting = ref(false);
const pending = ref<Site | null>(null);

function refresh() {
  void store.fetchAll();
}
onMounted(refresh);

async function toggleStatus(s: Site) {
  busy.value = s.siteId;
  try {
    await store.setStatus(s.siteId, s.status === 'active' ? 'disabled' : 'active');
  } finally {
    busy.value = null;
  }
}

function askDelete(s: Site) {
  pending.value = s;
  confirmOpen.value = true;
}

async function confirmDelete() {
  if (!pending.value) return;
  deleting.value = true;
  try {
    await store.remove(pending.value.siteId);
    confirmOpen.value = false;
    pending.value = null;
  } finally {
    deleting.value = false;
  }
}
</script>
