import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  Site,
  SiteWithSecret,
  CreateSiteBody,
  UpdateSiteBody,
  CreateOperatorBody,
} from '@central/shared';
import { api as defaultApi } from '../api';
import type { ApiClient } from '../api/client';

export const useSitesStore = (apiClient: ApiClient = defaultApi) =>
  defineStore('sites', () => {
    const sites = ref<Site[]>([]);
    const loading = ref(false);

    async function fetchAll() {
      loading.value = true;
      try {
        sites.value = await apiClient.get<Site[]>('/sites');
      } finally {
        loading.value = false;
      }
    }

    async function register(body: CreateSiteBody): Promise<SiteWithSecret> {
      const created = await apiClient.post<SiteWithSecret>('/sites', body);
      await fetchAll();
      return created;
    }

    async function update(siteId: string, body: UpdateSiteBody) {
      await apiClient.patch<Site>(`/sites/${siteId}`, body);
      await fetchAll();
    }

    async function rotateSecret(siteId: string): Promise<SiteWithSecret> {
      return apiClient.post<SiteWithSecret>(`/sites/${siteId}/rotate-secret`);
    }

    async function addOperator(siteId: string, body: CreateOperatorBody) {
      await apiClient.post(`/sites/${siteId}/operators`, body);
    }

    return { sites, loading, fetchAll, register, update, rotateSecret, addOperator };
  })();
