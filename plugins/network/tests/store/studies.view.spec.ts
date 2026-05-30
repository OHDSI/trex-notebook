import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { createPinia, setActivePinia } from 'pinia';
import { createVuetify } from 'vuetify';
import StudiesToExecuteView from '../../src/views/StudiesToExecuteView.vue';
import { ApiClient } from '../../src/api/client';

beforeEach(() => setActivePinia(createPinia()));

describe('StudiesToExecuteView', () => {
  it('lists published studies', async () => {
    vi.spyOn(ApiClient.prototype, 'get').mockResolvedValue([
      { studyId: 's1', name: 'Beta', description: '', version: '1.0.0', status: 'published' },
    ]);
    render(StudiesToExecuteView, { global: { plugins: [createVuetify()] } });
    expect(await screen.findByText('Beta')).toBeTruthy();
  });
});
