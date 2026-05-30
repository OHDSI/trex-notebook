<template>
  <div class="text-center mt-16">
    <v-progress-circular v-if="!error" indeterminate />
    <v-alert v-else type="error" variant="tonal">{{ error }}</v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { handleCallback } from '../auth/session';

const error = ref('');
const router = useRouter();

onMounted(async () => {
  try {
    await handleCallback(location.search);
    await router.replace('/sites');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'sign-in failed';
  }
});
</script>
