import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatusChip from "./StatusChip.vue";

describe("StatusChip", () => {
  it("shows the label and color class for RUNNING", () => {
    const w = mount(StatusChip, { props: { status: "RUNNING" } });
    expect(w.text()).toContain("Running");
    expect(w.classes()).toContain("status-running");
  });
  it("shows Completed for COMPLETED", () => {
    const w = mount(StatusChip, { props: { status: "COMPLETED" } });
    expect(w.text()).toContain("Completed");
    expect(w.classes()).toContain("status-completed");
  });
  it("shows Failed for FAILED", () => {
    const w = mount(StatusChip, { props: { status: "FAILED" } });
    expect(w.text()).toContain("Failed");
    expect(w.classes()).toContain("status-failed");
  });
  it("shows Cancelled for CANCELLED", () => {
    const w = mount(StatusChip, { props: { status: "CANCELLED" } });
    expect(w.text()).toContain("Cancelled");
    expect(w.classes()).toContain("status-cancelled");
  });
});
