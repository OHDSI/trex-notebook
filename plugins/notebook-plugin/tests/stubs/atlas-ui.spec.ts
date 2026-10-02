import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { AtlasButton, AtlasSelect } from "@ohdsi/atlas-ui";

describe("atlas-ui test stubs", () => {
  it("AtlasButton renders its slot and emits click", async () => {
    const w = mount(AtlasButton, { slots: { default: "Save" } });
    expect(w.text()).toContain("Save");
    await w.trigger("click");
    expect(w.emitted("click")).toBeTruthy();
  });

  it("AtlasSelect emits update:modelValue when changed", async () => {
    const w = mount(AtlasSelect, {
      props: {
        modelValue: "a",
        items: [{ title: "A", value: "a" }, { title: "B", value: "b" }],
        itemTitle: "title",
        itemValue: "value",
      },
    });
    await w.find("select").setValue("b");
    expect(w.emitted("update:modelValue")?.[0]).toEqual(["b"]);
  });
});
