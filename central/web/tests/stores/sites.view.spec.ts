import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import SitesView from '../../src/views/SitesView.vue';
import * as apiMod from '../../src/api';

beforeEach(() => {
  vi.spyOn(apiMod.api, 'get').mockResolvedValue([
    { siteId: 's1', name: 'Alpha', contact: 'a@x', status: 'active', cognitoClientId: 'c1' },
  ]);
});

describe('SitesView', () => {
  it('renders the sites returned by the API', async () => {
    render(SitesView, { global: { plugins: [createPinia(), createVuetify()] } });
    expect(await screen.findByText('Alpha')).toBeTruthy();
  });
});
