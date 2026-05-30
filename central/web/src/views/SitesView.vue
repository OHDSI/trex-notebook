<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Sites</h1>
      <v-spacer />
      <RegisterSiteDialog @created="refresh" />
    </div>
    <v-table>
      <thead>
        <tr><th>Name</th><th>Contact</th><th>Status</th><th>Client ID</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in store.sites" :key="s.siteId">
          <td>{{ s.name }}</td>
          <td>{{ s.contact }}</td>
          <td><v-chip :color="s.status === 'active' ? 'success' : 'grey'">{{ s.status }}</v-chip></td>
          <td><code>{{ s.cognitoClientId }}</code></td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useSitesStore } from '../stores/sites';
import RegisterSiteDialog from '../components/RegisterSiteDialog.vue';

const store = useSitesStore();
function refresh() {
  void store.fetchAll();
}
onMounted(refresh);
</script>
