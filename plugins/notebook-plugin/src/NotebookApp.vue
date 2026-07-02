<template>
  <v-app class="notebook-plugin">
    <v-main>
      <!-- List view renders AtlasPageShell, which supplies its own page padding
           (matching every other plugin). Keep inner padding for the editor. -->
      <NotebookListView
        v-if="view === 'list'"
        @open="openNotebook"
        @new="newNotebook"
      />
      <div
        v-else
        class="pa-4"
      >
        <NotebookEditorView
          :id="activeId"
          @back="goToList"
          @saved="onSaved"
        />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
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

// Deep-link: the Studies "Local" tab navigates here with ?open=<rowId> or
// ?new=1 to jump straight into the editor. Runs once on mount only.
onMounted(() => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const openId = params.get("open");
  if (openId) {
    openNotebook(openId);
  } else if (params.has("new")) {
    newNotebook();
  }
});
</script>

<style scoped>
.notebook-plugin { background: transparent; }
</style>
