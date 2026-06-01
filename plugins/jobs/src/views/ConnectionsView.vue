<template>
  <section class="connections-view">
    <div class="toolbar">
      <button @click="store.fetch()">Refresh</button>
    </div>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <p v-if="pwNote" class="note">{{ pwNote }}</p>

    <table>
      <thead>
        <tr>
          <th>Label</th><th>DBMS</th><th>Host</th><th>Port</th>
          <th>Database</th><th>CDM schema</th><th>Vocab schema</th><th>User</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in store.connections" :key="c.rowId">
          <td>{{ c.label }}</td>
          <td>{{ c.dbms }}</td>
          <td>{{ c.host }}</td>
          <td>{{ c.port }}</td>
          <td>{{ c.database }}</td>
          <td>{{ c.cdmSchema }}</td>
          <td>{{ c.vocabSchema || "—" }}</td>
          <td>{{ c.user }}</td>
          <td class="actions">
            <button @click="startEdit(c)">Edit</button>
            <button class="danger" @click="store.remove(c.rowId)">Delete</button>
            <span class="pw">
              <input
                type="password"
                placeholder="set password"
                v-model="pwInputs[c.rowId]"
              />
              <button :disabled="!pwInputs[c.rowId]" @click="onSetPassword(c.rowId)">Set</button>
            </span>
          </td>
        </tr>
        <tr v-if="store.connections.length === 0">
          <td colspan="9" class="empty">No connections yet.</td>
        </tr>
      </tbody>
    </table>

    <form class="conn-form" @submit.prevent="onSubmit">
      <h4>{{ editing ? "Edit connection" : "New connection" }}</h4>
      <div class="grid">
        <input v-model="form.label" placeholder="label" required />
        <input v-model="form.dbms" placeholder="dbms (e.g. postgresql)" />
        <input v-model="form.host" placeholder="host" required />
        <input v-model.number="form.port" type="number" placeholder="port (e.g. 5432)" />
        <input v-model="form.database" placeholder="database" required />
        <input v-model="form.cdmSchema" placeholder="cdm schema" required />
        <input v-model="form.vocabSchema" placeholder="vocab schema (optional)" />
        <input v-model="form.user" placeholder="user" required />
      </div>
      <div class="form-actions">
        <button type="submit">{{ editing ? "Save" : "Create" }}</button>
        <button v-if="editing" type="button" @click="resetForm">Cancel</button>
      </div>
    </form>

    <p class="note">
      Password is stored encrypted server-side and never displayed. Use the per-row
      "Set password" field above; the value is sent to the metadata-api function,
      encrypted, and stored — it is never exposed via GraphQL.
    </p>
  </section>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useConnectionsStore, type CdmConnectionInput } from "../store/useConnectionsStore";
import type { CdmConnection } from "../api/metadataTypes";
import { MetadataClient, defaultMetadataBase } from "../api/metadataClient";

const store = useConnectionsStore();
const metadata = new MetadataClient(defaultMetadataBase());

const pwInputs = reactive<Record<string, string>>({});
const pwNote = ref("");
const editing = ref<string | null>(null);

function blankForm(): CdmConnectionInput {
  return {
    label: "",
    dbms: "postgresql",
    host: "",
    port: 5432,
    database: "",
    cdmSchema: "",
    vocabSchema: "",
    user: "",
  };
}
const form = reactive<CdmConnectionInput>(blankForm());

function resetForm() {
  editing.value = null;
  Object.assign(form, blankForm());
}

function startEdit(c: CdmConnection) {
  editing.value = c.rowId;
  Object.assign(form, {
    label: c.label,
    dbms: c.dbms,
    host: c.host,
    port: c.port,
    database: c.database,
    cdmSchema: c.cdmSchema,
    vocabSchema: c.vocabSchema ?? "",
    user: c.user,
  });
}

async function onSubmit() {
  const payload: CdmConnectionInput = {
    ...form,
    vocabSchema: form.vocabSchema ? form.vocabSchema : null,
  };
  if (editing.value) {
    await store.update(editing.value, payload);
  } else {
    await store.create(payload);
  }
  resetForm();
}

async function onSetPassword(rowId: string) {
  const pw = pwInputs[rowId];
  if (!pw) return;
  try {
    await metadata.setPassword(rowId, pw);
    pwInputs[rowId] = "";
    pwNote.value = "Password stored (encrypted server-side).";
  } catch (e) {
    pwNote.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(() => store.fetch());
</script>
<style scoped>
.connections-view { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; gap: 8px; align-items: center; }
table { border-collapse: collapse; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; }
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.pw { display: inline-flex; gap: 4px; align-items: center; }
.pw input { padding: 4px 8px; }
.empty { color: #888; text-align: center; }
.error { color: #c62828; }
.danger { color: #c62828; }
.note { color: #666; font-size: 13px; }
.conn-form { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #ddd; padding-top: 12px; }
.conn-form h4 { margin: 0; }
.grid { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 8px; }
.grid input { padding: 4px 8px; }
.form-actions { display: flex; gap: 8px; }
</style>
