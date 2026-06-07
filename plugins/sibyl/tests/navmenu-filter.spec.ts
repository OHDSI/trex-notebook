import { describe, it, expect } from 'vitest'
import { filterTextNavItems, JOBS_PLUGIN_ID, type PluginMenuItem } from '@/plugins/navigation/PluginMenuIntegration'

describe('filterTextNavItems', () => {
  it('removes jobs-plugin items (shown as an icon instead)', () => {
    const items: PluginMenuItem[] = [
      { id: 'a', pluginId: 'other', name: 'Other', route: '/x', order: 1, visible: true },
      { id: 'b', pluginId: JOBS_PLUGIN_ID, name: 'Jobs', route: '/plugins/jobs-plugin/', order: 2, visible: true },
    ]
    const out = filterTextNavItems(items)
    expect(out.map(i => i.pluginId)).toEqual(['other'])
  })
})
