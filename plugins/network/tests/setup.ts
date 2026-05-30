// Node 21+ ships an experimental global `localStorage` that is unavailable unless
// `--localstorage-file` is passed. Because that global already exists, vitest's jsdom
// environment skips copying jsdom's own `window.localStorage` onto the global (it only
// adopts keys that don't already exist on the Node global). The result is a `localStorage`
// global that is permanently undefined under Node 21+. Install a spec-compliant in-memory
// implementation so the storage-backed code under test behaves as it would in a browser.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}
