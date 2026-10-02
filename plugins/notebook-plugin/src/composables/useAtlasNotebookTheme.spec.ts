import { describe, it, expect, afterEach } from "vitest";
import { useAtlasNotebookTheme } from "./useAtlasNotebookTheme";

function elWith(vars: Record<string, string>): HTMLElement {
  const el = document.createElement("div");
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useAtlasNotebookTheme", () => {
  it("wraps an Atlas rgb triple as an rgb() colour", () => {
    const theme = useAtlasNotebookTheme(elWith({ "--v-theme-primary": "0, 0, 128" }));
    expect(theme.primary).toBe("rgb(0, 0, 128)");
  });

  it("falls back to the portal default when a token is absent", () => {
    const theme = useAtlasNotebookTheme(elWith({}));
    expect(theme.primary).toBe("#000080");
  });

  it("passes an already-complete colour through unchanged", () => {
    const theme = useAtlasNotebookTheme(elWith({ "--v-theme-primary": "#123456" }));
    expect(theme.primary).toBe("#123456");
  });

  it("returns the full set of portal defaults with no element", () => {
    const theme = useAtlasNotebookTheme(null);
    expect(theme.background).toBe("#ffffff");
    expect(theme.foreground).toBe("#1a1a2e");
    expect(theme.border).toBe("#dde3ed");
  });

  it("defines every key the React portal theme defines", () => {
    const theme = useAtlasNotebookTheme(null);
    for (const key of [
      "primary", "primaryForeground", "background", "foreground",
      "secondary", "secondaryForeground", "accent", "accentForeground",
      "ring", "border", "input", "muted", "mutedForeground", "card", "cardForeground",
    ]) {
      expect(theme[key as keyof typeof theme], `missing ${key}`).toBeTruthy();
    }
  });
});
