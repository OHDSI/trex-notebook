<template>
  <v-app>
    <NavBar v-if="!isLoginRoute" />
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'

// The login screen is a focused, full-page card (like Atlas3's login modal) —
// hide the app nav there.
const route = useRoute()
const isLoginRoute = computed(() => route.name === 'login')
</script>
