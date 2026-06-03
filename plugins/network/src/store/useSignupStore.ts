import { defineStore } from 'pinia';
import { ref } from 'vue';
import { loadConfig } from '../config';
import { ApiClient } from '../api/client';

export type SignupState = 'none' | 'pending' | 'active';

function defaultClient(): ApiClient {
  return new ApiClient(loadConfig().proxyUrl, () => null);
}

export const useSignupStore = (apiClient?: ApiClient) =>
  defineStore('signup', () => {
    const api = apiClient ?? defaultClient();
    const status = ref<SignupState>('none');
    const error = ref<string | null>(null);

    async function refreshState(): Promise<void> {
      try {
        const r = await api.get<{ status: SignupState }>('/signup/state');
        status.value = r.status ?? 'none';
        error.value = null;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      }
    }

    async function signup(body: { name: string; contact: string }): Promise<void> {
      try {
        const r = await api.post<{ status: SignupState }>('/signup', body);
        status.value = r.status ?? 'pending';
        error.value = null;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        throw e;
      }
    }

    async function poll(): Promise<void> {
      try {
        const r = await api.get<{ status: SignupState }>('/signup/status');
        status.value = r.status ?? status.value;
        error.value = null;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      }
    }

    return { status, error, refreshState, signup, poll };
  })();
