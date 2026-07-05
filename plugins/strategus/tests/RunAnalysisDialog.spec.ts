import { describe, it, expect, vi, afterEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import type { App } from 'vue';
import { createVuetify } from 'vuetify';
import RunAnalysisDialog from '../src/components/RunAnalysisDialog.vue';

// jsdom does not implement the visualViewport API; Vuetify's VOverlay
// positioning logic references the bare global unconditionally, which
// throws a ReferenceError under jsdom unless the property exists.
if (typeof window !== 'undefined' && !('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', { value: undefined, writable: true, configurable: true });
}

// Mock the hades-api client so the dialog loads a fixed env list and
// resolves execute() to a known jobId.
vi.mock('../src/api/hadesClient', () => ({
  defaultBase: () => 'http://x',
  HadesClient: class {
    listEnvs = vi.fn().mockResolvedValue([{ envName: 'study1', path: '/e/study1' }]);
    execute = vi.fn().mockResolvedValue('run42');
  },
}));

// The strategus plugin has no @vue/test-utils dependency, so we drive the
// component directly with Vue's own runtime under jsdom and capture emits.
let app: App | null = null;
let root: HTMLDivElement | null = null;
const emitted: Record<string, unknown[][]> = {};

function mountDialog(props: Record<string, unknown>): HTMLElement {
  root = document.createElement('div');
  document.body.appendChild(root);
  app = createApp({
    render() {
      return h(RunAnalysisDialog, {
        ...props,
        onClose: () => {
          (emitted.close ??= []).push([]);
        },
        onSubmitted: (jobId: string) => {
          (emitted.submitted ??= []).push([jobId]);
        },
      });
    },
  });
  app.use(createVuetify());
  app.mount(root);
  return root;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string): Promise<void> {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return nextTick();
}

afterEach(() => {
  app?.unmount();
  root?.remove();
  app = null;
  root = null;
  for (const k of Object.keys(emitted)) delete emitted[k];
});

describe('RunAnalysisDialog', () => {
  it("loads envs on open and emits 'submitted' with the jobId", async () => {
    mountDialog({ open: true, spec: { x: 1 } });
    await flush();
    // AtlasDialog (VDialog) teleports its content to document.body rather
    // than rendering it under the mount root, so assertions must query the
    // document, not the returned root element.
    expect(document.body.textContent).toContain('study1');

    await setValue(document.querySelector('[data-test=cdm]') as HTMLInputElement, 'cdm');
    await setValue(document.querySelector('[data-test=env]') as HTMLSelectElement, 'study1');
    (document.querySelector('[data-test=run]') as HTMLButtonElement).click();
    await flush();

    expect(emitted.submitted?.[0]).toEqual(['run42']);
  });

  it('does not load envs while closed', async () => {
    const el = mountDialog({ open: false, spec: {} });
    await flush();
    expect(el.querySelector('.run-dialog')).toBeNull();
  });
});
