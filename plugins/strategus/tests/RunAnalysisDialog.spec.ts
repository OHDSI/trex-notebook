import { describe, it, expect, vi, afterEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import type { App } from 'vue';
import RunAnalysisDialog from '../src/components/RunAnalysisDialog.vue';

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
    const el = mountDialog({ open: true, spec: { x: 1 } });
    await flush();
    expect(el.textContent).toContain('study1');

    await setValue(el.querySelector('[data-test=cdm]') as HTMLInputElement, 'cdm');
    await setValue(el.querySelector('[data-test=env]') as HTMLSelectElement, 'study1');
    (el.querySelector('[data-test=run]') as HTMLButtonElement).click();
    await flush();

    expect(emitted.submitted?.[0]).toEqual(['run42']);
  });

  it('does not load envs while closed', async () => {
    const el = mountDialog({ open: false, spec: {} });
    await flush();
    expect(el.querySelector('.run-dialog')).toBeNull();
  });
});
