<template>
  <div class="register-site">
    <v-alert v-if="store.error" type="error" class="mb-3">{{ store.error }}</v-alert>

    <template v-if="store.status === 'active'">
      <v-alert type="success" variant="tonal">This site is registered and connected to the network.</v-alert>
    </template>

    <template v-else-if="store.status === 'pending'">
      <v-alert type="info" variant="tonal" class="mb-3">
        Registration request submitted. Awaiting coordinator approval…
      </v-alert>
      <v-btn :loading="busy" @click="checkNow">Check now</v-btn>
    </template>

    <template v-else>
      <h2 class="text-h6 mb-3">Register this site</h2>
      <v-text-field v-model="name" label="Site name" :disabled="busy" />
      <v-text-field v-model="contact" label="Contact email" :disabled="busy" />
      <v-btn color="primary" :loading="busy" :disabled="!name || !contact" @click="submit">Request registration</v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSignupStore } from '../store/useSignupStore';

const store = useSignupStore();
const name = ref('');
const contact = ref('');
const busy = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

async function submit(): Promise<void> {
  busy.value = true;
  try { await store.signup({ name: name.value, contact: contact.value }); } finally { busy.value = false; }
  startPolling();
}

async function checkNow(): Promise<void> {
  busy.value = true;
  try { await store.poll(); } finally { busy.value = false; }
}

function startPolling(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (store.status === 'pending') void store.poll();
    else stopPolling();
  }, 5000);
}
function stopPolling(): void { if (timer) { clearInterval(timer); timer = null; } }

onMounted(async () => {
  await store.refreshState();
  if (store.status === 'pending') startPolling();
});
onUnmounted(stopPolling);
</script>

<style scoped>
.register-site { max-width: 520px; }
</style>
