import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createVuetify } from 'vuetify';

vi.mock('../data/local', () => ({
  listLocalItems: vi.fn().mockResolvedValue([
    { id: 'n1', name: 'NB one', type: 'Notebook', updatedAt: '2026-01-01', route: '/plugins/notebook-plugin/' },
    { id: 's1', name: 'Study one', type: 'Strategus', updatedAt: '2026-01-02', route: '/plugins/strategus-plugin/' },
  ]),
}));

import LocalTab from './LocalTab.vue';

describe('LocalTab', () => {
  it('renders both notebook and strategus items', async () => {
    const wrapper = mount(LocalTab, { global: { plugins: [createVuetify()] } });
    await nextTick();
    await nextTick();
    const text = wrapper.text();
    expect(text).toContain('NB one');
    expect(text).toContain('Study one');
    expect(text).toContain('Notebook');
    expect(text).toContain('Strategus');
  });
});
