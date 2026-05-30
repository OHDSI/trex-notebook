<template>
  <v-app>
    <v-app-bar flat density="comfortable">
      <v-app-bar-title>Network Studies — Coordination Center</v-app-bar-title>
      <template v-if="authed">
        <v-btn to="/sites" variant="text">Sites</v-btn>
        <v-btn to="/studies" variant="text">Studies</v-btn>
        <v-btn to="/submissions" variant="text">Submissions</v-btn>
        <v-btn variant="text" @click="logout">Sign out</v-btn>
      </template>
    </v-app-bar>
    <v-main>
      <v-container><router-view /></v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isAuthenticated, logout as doLogout } from './auth/session';

const authed = computed(() => isAuthenticated());
function logout() {
  doLogout();
}
</script>
