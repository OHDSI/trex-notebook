import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createVuetify } from 'vuetify';

vi.mock('../data/network', () => ({
  listStudies: vi.fn().mockResolvedValue([
    { studyId: 's1', name: 'Study One', version: '1.0', status: 'published', description: '' },
  ]),
  signupState: vi.fn().mockResolvedValue('none'),
  networkBase: () => 'http://x/plugins/network-api/network-api',
}));

import NetworkTab from './NetworkTab.vue';

describe('NetworkTab', () => {
  it('renders the studies returned by listStudies', async () => {
    const wrapper = mount(NetworkTab, { global: { plugins: [createVuetify()] } });
    await nextTick();
    await nextTick();
    expect(wrapper.text()).toContain('Study One');
  });
});
