<template>
  <header class="nav-bar">
    <div class="nav-bar__container">
      <img :src="ohdsiLogo" alt="OHDSI" class="nav-bar__ohdsi-logo" >
      <router-link to="/" class="nav-bar__brand" data-test="brand">SIBYL</router-link>

      <nav class="nav-bar__nav-wrapper" aria-label="Main">
        <ul class="nav-bar__nav nav-bar__nav-list">
          <li
            class="nav-bar__nav-item"
            :class="{ 'nav-bar__nav-item--active': isHomeActive }"
          >
            <router-link to="/" class="nav-bar__nav-link" data-test="nav-home">
              Home
            </router-link>
          </li>
          <li
            v-for="item in menuItems"
            :key="item.id"
            class="nav-bar__nav-item"
            :class="{ 'nav-bar__nav-item--active': isItemActive(item.route) }"
          >
            <router-link
              :to="item.route"
              class="nav-bar__nav-link"
              :data-test="`nav-${item.pluginId}`"
            >
              {{ item.name }}
            </router-link>
          </li>
          <li
            v-if="menuItems.length === 0"
            class="nav-bar__nav-item nav-bar__nav-item--muted"
            data-test="nav-empty"
          >
            <span class="nav-bar__nav-link nav-bar__nav-link--muted">No plugins registered</span>
          </li>
        </ul>
      </nav>

      <div class="nav-bar__actions">
        <v-btn
          icon="mdi-briefcase-clock-outline"
          variant="text"
          aria-label="Open jobs panel"
          data-test="nav-jobs"
          @click="ui.toggleJobs()"
        />
        <v-btn
          icon="mdi-cog"
          variant="text"
          aria-label="Open settings panel"
          data-test="nav-settings"
          @click="ui.toggleSettings()"
        />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  generatePluginMenuItems,
  filterTextNavItems,
  type PluginMenuItem,
} from '@/plugins/navigation/PluginMenuIntegration'
import { useUiStore } from '@/stores/ui'
import { pluginRegistry } from '@/plugins/core/PluginRegistry'
import ohdsiLogo from '@/assets/ohdsi-logo.png'

const route = useRoute()
const ui = useUiStore()

const menuItems = ref<PluginMenuItem[]>(filterTextNavItems(generatePluginMenuItems()))

// Plugins register AFTER the app mounts (see main.ts bootstrap order), so
// refresh the menu whenever the registry changes (add/remove/hot-reload).
const unsubscribe = pluginRegistry.onPluginChange(() => {
  menuItems.value = filterTextNavItems(generatePluginMenuItems())
})
onUnmounted(unsubscribe)

const isHomeActive = computed(() => route.path === '/')
function isItemActive(itemRoute: string): boolean {
  return route.path.startsWith(itemRoute)
}
</script>

<style scoped>
.nav-bar {
  width: 100%;
  height: 60px;
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), 0.16);
}

.nav-bar__container {
  display: flex;
  align-items: center;
  height: 100%;
}

.nav-bar__ohdsi-logo {
  display: block;
  height: 48px;
  margin-left: 1rem;
  margin-right: 0.5rem;
}

.nav-bar__brand {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  line-height: 1;
}

.nav-bar__brand:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 2px;
}

.nav-bar__nav-wrapper {
  display: flex;
  align-items: center;
}

.nav-bar__actions {
  margin-left: auto;
  margin-right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nav-bar__nav-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding-left: 1.5rem;
}

.nav-bar__nav-item {
  position: relative;
}

.nav-bar__nav-link {
  display: inline-block;
  padding: 20px 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-weight: 400;
  text-decoration: none;
  transition: color 0.15s ease-in-out;
  font-size: 14px;
}

.nav-bar__nav-link:hover {
  color: rgb(var(--v-theme-primary));
}

.nav-bar__nav-link--muted {
  font-style: italic;
  cursor: default;
  opacity: 0.7;
}

.nav-bar__nav-item--active .nav-bar__nav-link {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

.nav-bar__nav-item--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 8px;
  right: 8px;
  height: 2px;
  background-color: rgb(var(--v-theme-primary));
  border-radius: 2px;
}
</style>
