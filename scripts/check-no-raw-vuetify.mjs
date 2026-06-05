#!/usr/bin/env node
// Fails if banned raw Vuetify components appear in an ENFORCED plugin's templates.
// Rolled out per-plugin: add a plugin id to ENFORCED once it is fully migrated.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ENFORCED = ['sibyl','network','results-viewer','jobs','notebook-plugin','strategus'] // e.g. 'sibyl','network','results-viewer','jobs','notebook-plugin','strategus'

const BANNED = [
  'v-text-field','v-btn','v-checkbox','v-select','v-icon','v-card','v-col','v-divider',
  'v-alert','v-table','v-chip','v-row','v-tooltip','v-spacer','v-tab','v-tabs','v-switch',
  'v-snackbar','v-progress-circular','v-list','v-list-item','v-data-table','v-textarea',
]
// Allowed: structural / no Atlas equivalent, plus card/list sub-slots.
const ALLOWED = new Set([
  'v-app','v-application','v-main','v-form','v-window','v-window-item','v-expand-transition',
  'v-file-input','v-card-title','v-card-text','v-card-subtitle','v-card-actions',
  'v-list-item-title','v-list-item-subtitle',
])
const TAG = /<\/?(v-[a-z0-9-]+)/g

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist') continue
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (p.endsWith('.vue')) out.push(p)
  }
  return out
}

let violations = 0
for (const plugin of ENFORCED) {
  const root = `plugins/${plugin}/src`
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8')
    const seen = new Set()
    for (const m of text.matchAll(TAG)) {
      const tag = m[1]
      if (BANNED.includes(tag) && !ALLOWED.has(tag) && !seen.has(tag)) {
        seen.add(tag)
        console.error(`${file}: banned <${tag}> — use the Atlas equivalent`)
        violations++
      }
    }
  }
}
if (violations) { console.error(`\n${violations} banned Vuetify usage(s) found.`); process.exit(1) }
console.log(`No banned Vuetify components in enforced plugins: [${ENFORCED.join(', ') || 'none yet'}]`)
