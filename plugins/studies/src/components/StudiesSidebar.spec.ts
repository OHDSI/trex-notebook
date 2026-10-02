import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { createVuetify } from 'vuetify';
import StudiesSidebar from './StudiesSidebar.vue';
import { CONFIG_EVENT, readHostConfig } from '../config';

function mountSidebar() {
  return mount(StudiesSidebar, {
    global: {
      plugins: [createVuetify()],
      provide: { studiesSection: ref('overview') },
    },
  });
}

afterEach(() => {
  delete window.__studiesPluginConfig;
  readHostConfig();
});

describe('StudiesSidebar network gating', () => {
  it('hides Network and Configuration by default', () => {
    readHostConfig();
    const text = mountSidebar().text();
    expect(text).toContain('Overview');
    expect(text).toContain('Results');
    expect(text).not.toContain('Network');
    expect(text).not.toContain('Configuration');
  });

  it('shows them when the host enables networkEnabled', () => {
    window.__studiesPluginConfig = { networkEnabled: true };
    readHostConfig();
    const text = mountSidebar().text();
    expect(text).toContain('Network');
    expect(text).toContain('Configuration');
  });

  it('applies a late host config via the config event', async () => {
    readHostConfig();
    const wrapper = mountSidebar();
    expect(wrapper.text()).not.toContain('Network');
    window.__studiesPluginConfig = { networkEnabled: true };
    window.dispatchEvent(new Event(CONFIG_EVENT));
    await nextTick();
    expect(wrapper.text()).toContain('Network');
  });
});
