import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSignupStore } from '../../src/store/useSignupStore';
import type { ApiClient } from '../../src/api/client';

beforeEach(() => setActivePinia(createPinia()));

const fakeApi = (o: Partial<ApiClient>) => o as unknown as ApiClient;

describe('useSignupStore', () => {
  it('signup() posts name+contact and goes pending', async () => {
    const post = vi.fn().mockResolvedValue({ siteId: 's1', status: 'pending' });
    const s = useSignupStore(fakeApi({ post }));
    await s.signup({ name: 'Site A', contact: 'a@x.org' });
    expect(post).toHaveBeenCalledWith('/signup', { name: 'Site A', contact: 'a@x.org' });
    expect(s.status).toBe('pending');
  });

  it('refreshState() reads /signup/state', async () => {
    const get = vi.fn().mockResolvedValue({ registered: true, status: 'active' });
    const s = useSignupStore(fakeApi({ get }));
    await s.refreshState();
    expect(get).toHaveBeenCalledWith('/signup/state');
    expect(s.status).toBe('active');
  });

  it('poll() flips to active when status returns active', async () => {
    const get = vi.fn().mockResolvedValue({ status: 'active' });
    const s = useSignupStore(fakeApi({ get }));
    await s.poll();
    expect(get).toHaveBeenCalledWith('/signup/status');
    expect(s.status).toBe('active');
  });
});
