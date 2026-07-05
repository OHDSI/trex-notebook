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

const props = defineProps<{ messageBus?: unknown }>();

const view = ref<"list" | "editor">("list");
const activeId = ref<string | null>(null);

// The combined Studies overview is the single entry point for browsing studies +
// notebooks, so the notebook plugin no longer surfaces its own standalone list.
// Navigate there instead of rendering NotebookListView.
function goToStudiesOverview(): void {
  (props.messageBus as { send?: (t: string, p: unknown) => void })?.send?.(
    "navigation:request",
    { path: "/plugins/studies-plugin/" },
  );
}

function openNotebook(id: string): void {
  activeId.value = id;
  view.value = "editor";
}

function newNotebook(): void {
  activeId.value = null;
  view.value = "editor";
}

function goToList(): void {
  // Back from the editor returns to the combined Studies overview.
  goToStudiesOverview();
}

function onSaved(id: string): void {
  activeId.value = id;
}

// Under Atlas3's hash routing (createWebHashHistory), query params live in
// window.location.hash (e.g. "#/plugins/notebook-plugin/?new=1"), not
// window.location.search, which is always empty here.
function readHashQuery(): URLSearchParams {
  const hash = window.location.hash || "";
  const i = hash.indexOf("?");
  return i >= 0 ? new URLSearchParams(hash.slice(i + 1)) : new URLSearchParams();
}

// Deep-link: the Studies "Local" tab navigates here with ?open=<rowId> or
// ?new=1 to jump straight into the editor. Runs once on mount only.
onMounted(() => {
  if (typeof window === "undefined") return;
  const params = readHashQuery();
  const openId = params.get("open");
  if (openId) {
    openNotebook(openId);
  } else if (params.has("new")) {
    newNotebook();
  } else {
    // No deep-link would otherwise show the standalone notebook list; send the
    // user to the combined Studies overview instead.
    goToStudiesOverview();
  }
});
</script>

<style scoped>
.notebook-plugin { background: transparent; }
</style>
