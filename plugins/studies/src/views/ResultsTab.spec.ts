import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createVuetify } from 'vuetify';

vi.mock('../data/results', () => ({
  listResults: vi.fn().mockResolvedValue([]),
  addResult: vi.fn(),
  deleteResult: vi.fn(),
  saveDownloadedResult: vi.fn(),
  formatSize: (n: number) => `${n} B`,
}));

vi.mock('../api/resultsApi', () => ({
  listBackendResults: vi.fn().mockResolvedValue([
    { id: 'r1', name: 'eunomia_strategus_demo_results', fileName: 'results.zip', fileSize: 10, createdAt: '2026-10-02T06:26:52Z' },
    { id: 'r2', name: '', fileName: 'legacy-run.zip', fileSize: 20, createdAt: '2026-10-01T06:26:52Z' },
  ]),
  downloadBackendResult: vi.fn(),
}));

import ResultsTab from './ResultsTab.vue';

describe('ResultsTab', () => {
  it('labels backend results by their stored name, falling back to the file name', async () => {
    const wrapper = mount(ResultsTab, {
      global: {
        plugins: [createVuetify()],
        provide: { studiesOpenResult: ref(null) },
      },
    });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('eunomia strategus demo results');
    expect(text).toContain('legacy run');
  });
});
