import { describe, it, expect } from "vitest";
import { ref } from "vue";
import type { NotebookData } from "@trex/notebook";
import { authoredKey, useSavedBaseline } from "./useSavedBaseline";

function nb(cells: Record<string, unknown>[], metadata: Record<string, unknown> = {}): NotebookData {
  return { cells, metadata } as unknown as NotebookData;
}

const code = (over: Record<string, unknown> = {}) => ({
  id: "c1", type: "code", language: "python", source: "x = 1", metadata: {},
  executionCount: null, executionState: "idle", outputs: [], ...over,
});
const md = (over: Record<string, unknown> = {}) => ({ id: "m1", type: "markdown", source: "# Hi", ...over });

describe("authoredKey", () => {
  it("ignores outputs, execution count and execution state", () => {
    const a = nb([code()]);
    const b = nb([code({ outputs: [{ type: "stream", text: "1" }], executionCount: 4, executionState: "running" })]);
    expect(authoredKey(b)).toBe(authoredKey(a));
  });

  it.each([
    ["source", nb([code({ source: "x = 2" })])],
    ["language", nb([code({ language: "r" })])],
    ["cell metadata", nb([code({ metadata: { tags: ["t"] } })])],
    ["cell type", nb([code({ type: "markdown" })])],
    ["cell id", nb([code({ id: "c9" })])],
    ["notebook metadata", nb([code()], { title: "T" })],
    ["an added cell", nb([code(), md()])],
  ])("changes when %s changes", (_label, changed) => {
    expect(authoredKey(changed)).not.toBe(authoredKey(nb([code()])));
  });

  it("changes when cells are reordered", () => {
    expect(authoredKey(nb([md(), code()]))).not.toBe(authoredKey(nb([code(), md()])));
  });

  it("treats a missing metadata the same as an empty one", () => {
    expect(authoredKey(nb([code({ metadata: undefined })]))).toBe(authoredKey(nb([code()])));
  });
});

describe("useSavedBaseline", () => {
  it("is clean for the content it starts with", () => {
    const current = ref(nb([code()]));
    expect(useSavedBaseline(current).dirty.value).toBe(false);
  });

  it("is dirty after an edit and clean again after editing back", () => {
    const current = ref(nb([code()]));
    const { dirty } = useSavedBaseline(current);
    current.value = nb([code({ source: "x = 2" })]);
    expect(dirty.value).toBe(true);
    current.value = nb([code()]);
    expect(dirty.value).toBe(false);
  });

  it("stays clean when only outputs change", () => {
    const current = ref(nb([code()]));
    const { dirty } = useSavedBaseline(current);
    current.value = nb([code({ outputs: [{ type: "stream", text: "1" }], executionCount: 1 })]);
    expect(dirty.value).toBe(false);
  });

  it("markSaved makes the given content the new baseline", () => {
    const current = ref(nb([code()]));
    const { dirty, markSaved } = useSavedBaseline(current);
    current.value = nb([code({ source: "x = 2" })]);
    markSaved(current.value);
    expect(dirty.value).toBe(false);
  });

  it("capture commits the content as it was when captured, not later edits", () => {
    const current = ref(nb([code()]));
    const { dirty, capture } = useSavedBaseline(current);
    current.value = nb([code({ source: "x = 2" })]);
    const commit = capture();
    current.value = nb([code({ source: "x = 3" })]);
    commit();
    expect(dirty.value).toBe(true);
    current.value = nb([code({ source: "x = 2" })]);
    expect(dirty.value).toBe(false);
  });
});
