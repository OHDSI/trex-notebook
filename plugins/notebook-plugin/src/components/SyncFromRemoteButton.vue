<template>
  <AtlasButton
    v-if="props.notebookId"
    variant="ghost"
    icon="mdi-cloud-download-outline"
    :disabled="busy"
    :loading="busy"
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
import { ref } from 'vue'
import { AtlasButton } from '@ohdsi/atlas-ui'
import { checkRemoteDiff, overwriteFromRemote } from '../api/notebookGit'

const props = defineProps<{ notebookId: string | null }>()
const emit = defineEmits<{
  (e: 'synced'): void
  (e: 'feedback', type: 'success' | 'error' | 'warning', message: string): void
}>()

const busy = ref(false)

async function sync(): Promise<void> {
  const id = props.notebookId
  if (!id || busy.value) return
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
