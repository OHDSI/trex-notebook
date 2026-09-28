// The Notebook component's `theme` prop takes concrete colour strings, not CSS
// variable references, so Atlas's tokens have to be read rather than forwarded.
//
// Vuetify writes --v-theme-* as space-separated RGB triples ("0, 0, 128"), which
// is why each value is wrapped in rgb(). Defaults are the React portal theme's
// literals, so a missing Atlas token degrades to the look the React notebook
// already ships rather than to nothing.
//
// Read once at mount: Atlas runs with enableDarkMode:false (plugins.portal.json),
// so there is no runtime theme switch to track.
import type { NotebookTheme } from '@trex/notebook'

const DEFAULTS: Required<Pick<NotebookTheme,
  | 'primary' | 'primaryForeground' | 'background' | 'foreground'
  | 'secondary' | 'secondaryForeground' | 'accent' | 'accentForeground'
  | 'ring' | 'border' | 'input' | 'muted' | 'mutedForeground'
  | 'card' | 'cardForeground'>> = {
  primary: '#000080',
  primaryForeground: '#ffffff',
  background: '#ffffff',
  foreground: '#1a1a2e',
  secondary: '#000080',
  secondaryForeground: '#ffffff',
  accent: '#edf2f7',
  accentForeground: '#000080',
  ring: '#000080',
  border: '#dde3ed',
  input: '#dde3ed',
  muted: '#6b7280',
  mutedForeground: '#555555',
  card: '#ffffff',
  cardForeground: '#1a1a2e',
}

// NotebookTheme key -> the Atlas/Vuetify token to read for it.
const TOKENS: Record<keyof typeof DEFAULTS, string> = {
  primary: '--v-theme-primary',
  primaryForeground: '--v-theme-on-primary',
  background: '--v-theme-background',
  foreground: '--v-theme-on-surface',
  secondary: '--v-theme-secondary',
  secondaryForeground: '--v-theme-on-secondary',
  accent: '--v-theme-surface-variant',
  accentForeground: '--v-theme-on-surface-variant',
  ring: '--v-theme-primary',
  border: '--v-theme-outline-variant',
  input: '--v-theme-outline-variant',
  muted: '--v-theme-on-surface-variant',
  mutedForeground: '--v-theme-on-surface-variant',
  card: '--v-theme-surface',
  cardForeground: '--v-theme-on-surface',
}

/** An RGB triple like "0, 0, 128" needs wrapping; anything else is already a colour. */
function toColor(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  return /^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(value) ? `rgb(${value})` : value
}

export function useAtlasNotebookTheme(el?: HTMLElement | null): NotebookTheme {
  const theme: NotebookTheme = { ...DEFAULTS }
  if (!el || typeof getComputedStyle !== 'function') return theme

  const styles = getComputedStyle(el)
  for (const [key, token] of Object.entries(TOKENS) as [keyof typeof DEFAULTS, string][]) {
    const color = toColor(styles.getPropertyValue(token))
    if (color) theme[key] = color
  }
  return theme
}
