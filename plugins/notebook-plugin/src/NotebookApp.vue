<template>
  <v-app class="notebook-plugin">
    <v-main>
      <div class="pa-4">
        <NotebookListView
          v-if="view === 'list'"
          @open="openNotebook"
          @new="newNotebook"
        />
        <NotebookEditorView
          v-else
          :id="activeId"
          @back="goToList"
          @saved="onSaved"
        />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from "vue";
import NotebookListView from "./views/NotebookListView.vue";
import NotebookEditorView from "./views/NotebookEditorView.vue";

const view = ref<"list" | "editor">("list");
const activeId = ref<string | null>(null);

function openNotebook(id: string): void {
  activeId.value = id;
  view.value = "editor";
}

function newNotebook(): void {
  activeId.value = null;
  view.value = "editor";
}

function goToList(): void {
  view.value = "list";
}

function onSaved(id: string): void {
  activeId.value = id;
}
</script>

<style scoped>
.notebook-plugin { background: transparent; }
</style>
