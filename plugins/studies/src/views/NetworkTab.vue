<template>
  <PluginEmbed pluginId="network-plugin" :parcel-props="{ section: props.section }" />
</template>

<script setup lang="ts">
import PluginEmbed from '../components/PluginEmbed.vue';

const props = withDefaults(defineProps<{ section?: 'main' | 'configuration' }>(), {
  section: 'main',
});
</script>
