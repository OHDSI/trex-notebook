// Global test setup. ResizeObserver is referenced by Vuetify components in jsdom.
import { vi } from 'vitest'

// localStorage shim. Node >=22 ships an experimental global `localStorage` that
// is `undefined` unless the process is started with `--localstorage-file`, and
// that global shadows the one jsdom would otherwise provide — so specs that call
// `localStorage.clear()` throw "Cannot read properties of undefined". Install a
// real in-memory Storage when the ambient one is missing or unusable.
function installStorage(key: 'localStorage' | 'sessionStorage') {
  let usable = false
  try {
    const s = (globalThis as Record<string, unknown>)[key] as Storage | undefined
    if (s) { s.setItem('__probe__', '1'); s.removeItem('__probe__'); usable = true }
  } catch { usable = false }
  if (usable) return

  const store = new Map<string, string>()
  const mock: Storage = {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => { store.delete(k) },
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
  }
  Object.defineProperty(globalThis, key, { value: mock, configurable: true, writable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, key, { value: mock, configurable: true, writable: true })
  }
}
installStorage('localStorage')
installStorage('sessionStorage')

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// Silence visual-only matchMedia lookups in jsdom
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
