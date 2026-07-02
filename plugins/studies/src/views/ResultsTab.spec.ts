import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createVuetify } from 'vuetify';

vi.mock('../data/results', () => ({
  listSavedResults: vi.fn().mockReturnValue([
    { id: 'r1', name: 'Result One', size: 123, addedAt: 1 },
  ]),
  openResult: vi.fn(),
}));

import ResultsTab from './ResultsTab.vue';
import { openResult } from '../data/results';

describe('ResultsTab', () => {
  it('renders saved results and opens one on click', async () => {
    const wrapper = mount(ResultsTab, { global: { plugins: [createVuetify()] } });
    await nextTick();
    await nextTick();
    expect(wrapper.text()).toContain('Result One');

    await wrapper.find('[data-testid="open-result-r1"]').trigger('click');
    expect(openResult).toHaveBeenCalledWith('r1');
  });
});
