<template>
  <v-row justify="center" class="mt-16">
    <v-col cols="12" sm="8" md="5">
      <v-card class="pa-6 text-center">
        <h2 class="text-h5 mb-2">Coordination Center</h2>
        <p class="text-medium-emphasis mb-6">Sign in to manage sites and studies.</p>
        <v-btn block @click="signIn">Sign in with Cognito</v-btn>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { login } from '../auth/session';
function signIn() {
  void login();
}
</script>
