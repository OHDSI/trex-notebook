<template>
  <AtlasDialog
    :model-value="modelValue"
    eyebrow="NEW STUDY"
    title="Choose a study type"
    subtitle="Pick a typical OHDSI study. It pre-selects the right modules and defaults — you can change anything afterward."
    :max-width="820"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('update:modelValue', false)"
  >
    <div v-for="group in groups" :key="group" class="mb-4">
      <div class="text-eyebrow mb-2">{{ group }}</div>
      <div class="study-type-grid">
        <div
          v-for="p in byGroup(group)"
          :key="p.id"
          class="study-type-card-wrapper"
          @click="choose(p.id)"
        >
          <AtlasCard padding="md" interactive class="study-type-card">
            <div class="study-type-card__label">{{ p.label }}</div>
            <div class="study-type-card__q">{{ p.question }}</div>
          </AtlasCard>
        </div>
      </div>
    </div>
    <template #actions>
      <AtlasButton variant="ghost" @click="choose(null)">Start blank instead</AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
import { AtlasDialog, AtlasCard, AtlasButton } from '@ohdsi/atlas-ui'
import { STUDY_TYPE_PRESETS, type StudyTypeId, type StudyGroup } from '../services/StudyTypePresets'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; select: [StudyTypeId | null] }>()

const groups: StudyGroup[] = ['Characterization', 'Estimation', 'Prediction']
const byGroup = (g: StudyGroup) => STUDY_TYPE_PRESETS.filter(p => p.group === g)
function choose(id: StudyTypeId | null) {
  emit('select', id)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.study-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.study-type-card-wrapper { cursor: pointer; }
.study-type-card { height: 100%; }
.study-type-card__label { font-weight: 600; color: rgb(var(--v-theme-primary)); margin-bottom: 4px; }
.study-type-card__q { font-size: 0.82rem; color: rgb(var(--v-theme-on-surface-variant)); }
</style>
