<template>
  <AtlasButton
    v-if="props.notebookId"
    variant="ghost"
    icon="mdi-cloud-download-outline"
    :disabled="disabled"
    :loading="busy"
    :title="title"
    @click="sync"
  >{{ busy ? 'Syncing…' : 'Sync from Remote' }}</AtlasButton>
</template>

<script setup lang="ts">
// Check-and-pull on demand. The React original polls remote-diff-check every
// 30s and enables itself only when the remote differs, but that fires a request
// as soon as a notebook opens — and Atlas's login-guard shows its sign-in dialog
// on ANY 401, so a single failing poll logs the user out of the page. Checking
// only when the user clicks means nothing is requested on open, and it also
// drops 30s polling traffic per open editor.
import { computed, ref } from 'vue'
import { AtlasButton } from '@ohdsi/atlas-ui'
import { GIT_MIRROR_ENABLED, checkRemoteDiff, overwriteFromRemote } from '../api/notebookGit'

const props = defineProps<{ notebookId: string | null }>()
const emit = defineEmits<{
  (e: 'synced'): void
  (e: 'feedback', type: 'success' | 'error' | 'warning', message: string): void
}>()

const busy = ref(false)

// Git integration is configured on the setup page, not here. Until it is wired
// up the control stays visible but inert, so the feature is discoverable and
// its absence reads as "not configured yet" rather than "missing".
const disabled = computed(() => busy.value || !GIT_MIRROR_ENABLED)
const title = computed(() =>
  GIT_MIRROR_ENABLED
    ? 'Overwrite this notebook with the version in the remote repository'
    : 'Git integration is not configured. Set up a repository on the git integration setup page to enable this.',
)

async function sync(): Promise<void> {
  const id = props.notebookId
  if (!id || disabled.value) return
  busy.value = true
  try {
    const diff = await checkRemoteDiff(id)
    if (!diff.hasDifferences) {
      emit('feedback', 'success', diff.reason || 'Already up to date with remote.')
      return
    }
    await overwriteFromRemote(id)
    emit('feedback', 'success', 'Notebook overwritten from remote.')
    emit('synced')
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    emit('feedback', 'error', `Failed to sync from remote: ${detail}`)
  } finally {
    busy.value = false
  }
}
</script>
