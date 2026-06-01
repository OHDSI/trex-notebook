<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, shallowRef } from 'vue'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers as lineNumbersExt,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  type ViewUpdate,
} from '@codemirror/view'
import {
  foldGutter as foldGutterExt,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from '@codemirror/language'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import {
  closeBrackets,
  autocompletion as autocompletionExt,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'

interface Props {
  modelValue: string
  /** Language extensions (e.g. python(), markdown(), R legacy mode) */
  extensions?: Extension[]
  /** Theme extension (e.g. githubLight) */
  theme?: Extension
  editable?: boolean
  // showLineNumbers/foldGutter/autocomplete/tabSize are read once at mount
  // (construction-time config); they are not reactive after the editor exists.
  showLineNumbers?: boolean
  foldGutter?: boolean
  autocomplete?: boolean
  tabSize?: number
  autoFocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  extensions: () => [],
  theme: undefined,
  editable: true,
  showLineNumbers: true,
  foldGutter: true,
  autocomplete: true,
  tabSize: 4,
  autoFocus: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: []
  blur: []
}>()

const root = ref<HTMLElement | null>(null)
const view = shallowRef<EditorView | null>(null)
const languageCompartment = new Compartment()
const editableCompartment = new Compartment()

function buildBaseExtensions(): Extension[] {
  const exts: Extension[] = [
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    EditorState.tabSize.of(props.tabSize),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
    ]),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
      if (update.focusChanged) {
        if (update.view.hasFocus) emit('focus')
        else emit('blur')
      }
    }),
  ]
  if (props.showLineNumbers) exts.push(lineNumbersExt())
  if (props.foldGutter) exts.push(foldGutterExt())
  if (props.autocomplete) exts.push(autocompletionExt())
  if (props.theme) exts.push(props.theme)
  return exts
}

onMounted(() => {
  if (!root.value) return
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      languageCompartment.of(props.extensions),
      editableCompartment.of([
        EditorView.editable.of(props.editable),
        EditorState.readOnly.of(!props.editable),
      ]),
      ...buildBaseExtensions(),
    ],
  })
  view.value = new EditorView({ state, parent: root.value })
  if (props.autoFocus) view.value.focus()
})

// External value changes -> dispatch only when different (avoids cursor reset / loop)
watch(
  () => props.modelValue,
  (value) => {
    const v = view.value
    if (!v) return
    const current = v.state.doc.toString()
    if (value !== current) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }
)

// Language change (e.g. python <-> r) -> reconfigure
watch(
  () => props.extensions,
  (exts) => {
    view.value?.dispatch({ effects: languageCompartment.reconfigure(exts) })
  }
)

// Editable change -> reconfigure
watch(
  () => props.editable,
  (editable) => {
    view.value?.dispatch({
      effects: editableCompartment.reconfigure([
        EditorView.editable.of(editable),
        EditorState.readOnly.of(!editable),
      ]),
    })
  }
)

onUnmounted(() => {
  view.value?.destroy()
  view.value = null
})
</script>

<template>
  <div ref="root" class="cm-editor-host" />
</template>

<style scoped>
/* Match the 14px the React @uiw/react-codemirror wrapper set; CodeMirror inherits it. */
.cm-editor-host {
  font-size: 14px;
}
</style>
