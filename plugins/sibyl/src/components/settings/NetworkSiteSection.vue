<template>
  <div class="network-site-section" style="max-width: 520px">
    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-3">{{ store.error }}</v-alert>

    <v-alert v-if="store.status === 'active'" type="success" variant="tonal">
      This site is registered and connected to the network.
    </v-alert>

    <template v-else-if="store.status === 'pending'">
      <v-alert type="info" variant="tonal" class="mb-3">
        Registration request submitted. Awaiting coordinator approval…
      </v-alert>
      <v-btn :loading="busy" data-test="network-check" @click="checkNow">Check now</v-btn>
    </template>

    <template v-else>
      <p class="text-medium-emphasis mb-3">Register this site with the federated study network.</p>
      <v-text-field v-model="name" label="Site name" density="compact" :disabled="busy" data-test="network-name" />
      <v-text-field v-model="contact" label="Contact email" density="compact" :disabled="busy" data-test="network-contact" />
      <v-btn color="primary" :loading="busy" :disabled="!name || !contact" data-test="network-register" @click="submit">
        Request registration
      </v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSignupStore } from '@/stores/signup'

const store = useSignupStore()
const name = ref('')
const contact = ref('')
const busy = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

async function submit(): Promise<void> {
  busy.value = true
  try { await store.signup({ name: name.value, contact: contact.value }) }
  catch { /* surfaced via store.error */ }
  finally { busy.value = false }
  startPolling()
}

async function checkNow(): Promise<void> {
  busy.value = true
  try { await store.poll() } finally { busy.value = false }
}

function startPolling(): void {
  if (timer) return
  timer = setInterval(() => {
    if (store.status === 'pending') void store.poll()
    else stopPolling()
  }, 5000)
}
function stopPolling(): void { if (timer) { clearInterval(timer); timer = null } }

onMounted(async () => {
  await store.refreshState()
  if (store.status === 'pending') startPolling()
})
onUnmounted(stopPolling)
</script>
