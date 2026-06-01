<template>
  <section class="definitions-view">
    <div class="toolbar">
      <button @click="store.fetch()">Refresh</button>
    </div>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <table>
      <thead>
        <tr><th>Name</th><th>Description</th><th>Updated</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="d in store.definitions" :key="d.rowId">
          <td>{{ d.name }}</td>
          <td>{{ d.description }}</td>
          <td>{{ new Date(d.updatedAt).toLocaleString() }}</td>
          <td class="actions">
            <button @click="open(d.rowId)">Open in Strategus</button>
            <button class="danger" @click="store.remove(d.rowId)">Delete</button>
          </td>
        </tr>
        <tr v-if="store.definitions.length === 0">
          <td colspan="4" class="empty">No saved definitions.</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
<script setup lang="ts">
import { onMounted } from "vue";
import { useDefinitionsStore } from "../store/useDefinitionsStore";

const store = useDefinitionsStore();

function open(rowId: string) {
  // Hand off to strategus via a query param it reads on mount.
  window.location.assign(
    `/plugins/strategus-plugin/?definition=${encodeURIComponent(rowId)}`,
  );
}

onMounted(() => store.fetch());
</script>
<style scoped>
.definitions-view { display: flex; flex-direction: column; gap: 8px; }
.toolbar { display: flex; gap: 8px; align-items: center; }
table { border-collapse: collapse; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; }
.actions { display: flex; gap: 6px; }
.empty { color: #888; text-align: center; }
.error { color: #c62828; }
.danger { color: #c62828; }
</style>
