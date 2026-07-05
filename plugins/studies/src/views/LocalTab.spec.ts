import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createVuetify } from 'vuetify';

vi.mock('../data/local', () => ({
  listLocalItems: vi.fn().mockResolvedValue([
    { id: 'n1', name: 'NB one', type: 'Notebook', updatedAt: '2026-01-01', route: '/plugins/notebook-plugin/?open=n1' },
    { id: 's1', name: 'Study one', type: 'Strategus', updatedAt: '2026-01-02', route: '/plugins/strategus-plugin/?study=s1' },
  ]),
}));

import LocalTab from './LocalTab.vue';

function mountLocalTab() {
  const send = vi.fn();
  const hostCtx = {
    mountParcel: vi.fn(),
    authContext: { user: null, token: null, isAuthenticated: false, hasPermission: () => false },
    messageBus: { send, request: vi.fn(), subscribe: vi.fn() },
    uiFilesUrl: '',
  };
  const wrapper = mount(LocalTab, {
    global: {
      plugins: [createVuetify()],
      provide: { studiesHostCtx: hostCtx },
    },
  });
  return { wrapper, send };
}

describe('LocalTab', () => {
  it('renders both notebook and strategus items', async () => {
    const { wrapper } = mountLocalTab();
    await nextTick();
    await nextTick();
    const text = wrapper.text();
    expect(text).toContain('NB one');
    expect(text).toContain('Study one');
    expect(text).toContain('Notebook');
    expect(text).toContain('Strategus');
  });

  it('navigates via the message bus on row click, not window.location', async () => {
    const { wrapper, send } = mountLocalTab();
    await nextTick();
    await nextTick();

    const links = wrapper.findAll('a');
    const notebookLink = links.find((l) => l.text() === 'NB one');
    expect(notebookLink).toBeTruthy();
    await notebookLink!.trigger('click');
    expect(send).toHaveBeenCalledWith('navigation:request', { path: '/plugins/notebook-plugin/?open=n1' });

    const studyLink = links.find((l) => l.text() === 'Study one');
    expect(studyLink).toBeTruthy();
    await studyLink!.trigger('click');
    expect(send).toHaveBeenCalledWith('navigation:request', { path: '/plugins/strategus-plugin/?study=s1' });
  });

  it('navigates to new-notebook and new-study deep links from header actions', async () => {
    const { wrapper, send } = mountLocalTab();
    await nextTick();
    await nextTick();

    const buttons = wrapper.findAll('button');
    const newNotebookBtn = buttons.find((b) => b.text().includes('New Notebook'));
    const newStudyBtn = buttons.find((b) => b.text().includes('New Study'));
    expect(newNotebookBtn).toBeTruthy();
    expect(newStudyBtn).toBeTruthy();

    await newNotebookBtn!.trigger('click');
    expect(send).toHaveBeenCalledWith('navigation:request', { path: '/plugins/notebook-plugin/?new=1' });

    await newStudyBtn!.trigger('click');
    expect(send).toHaveBeenCalledWith('navigation:request', { path: '/plugins/strategus-plugin/?new=1' });
  });
});
