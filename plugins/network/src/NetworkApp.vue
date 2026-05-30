<template>
  <v-card flat class="pa-4">
    <LoginGate>
      <v-tabs v-model="tab" class="mb-4">
        <v-tab value="studies">Studies</v-tab>
        <v-tab value="submit">Submit</v-tab>
        <v-tab value="mine">My submissions</v-tab>
      </v-tabs>
      <v-window v-model="tab">
        <v-window-item value="studies"><StudiesToExecuteView /></v-window-item>
        <v-window-item value="submit"><SubmitResultsView /></v-window-item>
        <v-window-item value="mine"><MySubmissionsView /></v-window-item>
      </v-window>
    </LoginGate>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LoginGate from './components/LoginGate.vue';
import StudiesToExecuteView from './views/StudiesToExecuteView.vue';
import SubmitResultsView from './views/SubmitResultsView.vue';
import MySubmissionsView from './views/MySubmissionsView.vue';

const tab = ref('studies');
</script>
