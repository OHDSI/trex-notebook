<template>
  <v-dialog v-model="open" max-width="520">
    <template #activator="{ props }">
      <v-btn v-bind="props" prepend-icon="mdi-plus">Register site</v-btn>
    </template>
    <v-card class="pa-4">
      <v-card-title>Register site</v-card-title>
      <v-card-text>
        <template v-if="!secret">
          <v-text-field v-model="name" label="Name" />
          <v-text-field v-model="contact" label="Contact email" />
        </template>
        <template v-else>
          <v-alert type="warning" variant="tonal" class="mb-3">
            Copy the client secret now — it will not be shown again.
          </v-alert>
          <v-text-field :model-value="clientId" label="Client ID" readonly />
          <v-text-field :model-value="secret" label="Client secret" readonly />
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn v-if="!secret" :loading="busy" @click="submit">Create</v-btn>
        <v-btn v-else variant="text" @click="close">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSitesStore } from '../stores/sites';

const emit = defineEmits<{ created: [] }>();
const store = useSitesStore();
const open = ref(false);
const busy = ref(false);
const name = ref('');
const contact = ref('');
const clientId = ref('');
const secret = ref('');

async function submit() {
  busy.value = true;
  try {
    const created = await store.register({ name: name.value, contact: contact.value });
    clientId.value = created.cognitoClientId;
    secret.value = created.clientSecret;
    emit('created');
  } finally {
    busy.value = false;
  }
}
function close() {
  open.value = false;
  name.value = contact.value = clientId.value = secret.value = '';
}
</script>
