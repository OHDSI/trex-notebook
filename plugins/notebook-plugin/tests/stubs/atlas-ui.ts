// Test-only stand-ins for @ohdsi/atlas-ui. The real package lives on GitHub
// Packages and needs NODE_AUTH_TOKEN, so it is not installed for local test
// runs; vite.config.ts aliases the package here under `test` only. These stubs
// carry just enough behaviour to assert wiring: slots render, v-model round
// trips, clicks emit. They are NOT used by the production build.
import { defineComponent, h } from "vue";

/** A button-ish stub: renders its slot, re-emits click, honours disabled. */
const button = (name: string) =>
  defineComponent({
    name,
    props: { disabled: Boolean, loading: Boolean, variant: String, tone: String, icon: String, iconPosition: String },
    emits: ["click"],
    setup(props, { slots, emit }) {
      return () =>
        h(
          "button",
          {
            disabled: props.disabled || props.loading,
            "data-variant": props.variant,
            "data-tone": props.tone,
            "data-icon": props.icon,
            "data-icon-position": props.iconPosition,
            onClick: (e: Event) => emit("click", e),
          },
          slots.default?.(),
        );
    },
  });

export const AtlasButton = button("AtlasButton");

export const AtlasIconButton = defineComponent({
  name: "AtlasIconButton",
  props: { icon: String, ariaLabel: String, size: String, disabled: Boolean },
  emits: ["click"],
  setup(props, { emit }) {
    return () =>
      h("button", {
        "aria-label": props.ariaLabel,
        "data-icon": props.icon,
        disabled: props.disabled,
        onClick: (e: Event) => emit("click", e),
      });
  },
});

export const AtlasSelect = defineComponent({
  name: "AtlasSelect",
  props: {
    modelValue: { type: [String, Number, Object, Array, Boolean], default: null },
    items: { type: Array as () => unknown[], default: () => [] },
    label: String,
    itemTitle: { type: String, default: "title" },
    itemValue: { type: String, default: "value" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h(
        "select",
        {
          value: props.modelValue,
          "aria-label": props.label,
          onChange: (e: Event) => emit("update:modelValue", (e.target as HTMLSelectElement).value),
        },
        props.items.map((it) => {
          const rec = it as Record<string, unknown>;
          const value = rec?.[props.itemValue] ?? it;
          const title = rec?.[props.itemTitle] ?? it;
          return h("option", { value: value as string }, String(title));
        }),
      );
  },
});

export const AtlasTextField = defineComponent({
  name: "AtlasTextField",
  props: { modelValue: { type: String, default: "" }, label: String, placeholder: String, autofocus: Boolean },
  emits: ["update:modelValue", "keyup"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        value: props.modelValue,
        "aria-label": props.label,
        placeholder: props.placeholder,
        onInput: (e: Event) => emit("update:modelValue", (e.target as HTMLInputElement).value),
      });
  },
});

export const AtlasDialog = defineComponent({
  name: "AtlasDialog",
  props: { modelValue: Boolean, eyebrow: String, title: String, maxWidth: [String, Number] },
  emits: ["update:modelValue", "close"],
  setup(props, { slots }) {
    // Render nothing when closed so `find()` in tests reflects visibility.
    return () =>
      props.modelValue
        ? h("div", { role: "dialog", "data-title": props.title }, [
            slots.default?.(),
            h("div", { class: "actions" }, slots.actions?.()),
          ])
        : null;
  },
});

export const AtlasSnackbar = defineComponent({
  name: "AtlasSnackbar",
  props: { modelValue: Boolean, timeout: [String, Number], severity: String, text: String, location: String, closable: Boolean },
  emits: ["update:modelValue"],
  setup(props, { slots }) {
    return () =>
      props.modelValue
        ? h("div", { role: "status", "data-severity": props.severity }, props.text ?? slots.default?.())
        : null;
  },
});

export const AtlasAlert = defineComponent({
  name: "AtlasAlert",
  props: {
    severity: String,
    tone: String,
    title: String,
    count: [String, Number],
    closable: Boolean,
    prependIcon: String,
  },
  emits: ["close"],
  setup(props, { slots }) {
    return () => h("div", { role: "alert", "data-severity": props.severity }, slots.default?.());
  },
});

export const AtlasChip = defineComponent({
  name: "AtlasChip",
  props: { tone: String, size: String },
  setup(props, { slots }) {
    return () => h("span", { "data-tone": props.tone }, slots.default?.());
  },
});

export const AtlasIcon = defineComponent({
  name: "AtlasIcon",
  props: { icon: String, size: [String, Number] },
  setup(props, { slots }) {
    return () => h("i", { "data-icon": props.icon }, slots.default?.());
  },
});

export const AtlasCard = defineComponent({
  name: "AtlasCard",
  setup(_, { slots }) {
    return () => h("div", { class: "atlas-card" }, slots.default?.());
  },
});

export const AtlasCheckbox = defineComponent({
  name: "AtlasCheckbox",
  props: { modelValue: Boolean, label: String },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        type: "checkbox",
        checked: props.modelValue,
        "aria-label": props.label,
        onChange: (e: Event) => emit("update:modelValue", (e.target as HTMLInputElement).checked),
      });
  },
});

export const AtlasProgressCircular = defineComponent({
  name: "AtlasProgressCircular",
  setup() {
    return () => h("div", { role: "progressbar" });
  },
});
