<template>
  <div v-if="authed"><slot /></div>
  <v-card v-else class="pa-6 text-center mx-auto mt-12" max-width="420">
    <h3 class="text-h6 mb-2">Sign in</h3>
    <p class="text-medium-emphasis mb-4">Authenticate to view and submit network studies.</p>
    <v-btn @click="signIn">Sign in with Cognito</v-btn>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { isAuthenticated, login, handleCallback } from '../auth/session';

const authed = ref(isAuthenticated());

onMounted(async () => {
  if (location.search.includes('code=')) {
    try {
      await handleCallback(location.search);
      authed.value = isAuthenticated();
      history.replaceState({}, '', location.pathname);
    } catch {
      authed.value = false;
    }
  }
});

function signIn() {
  void login();
}
</script>
