import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Submission, SubmissionWithUrls } from '@central/shared';
import { api as defaultApi } from '../api';
import type { ApiClient } from '../api/client';

export const useSubmissionsStore = (apiClient: ApiClient = defaultApi) =>
  defineStore('submissions', () => {
    const items = ref<Submission[]>([]);

    async function fetchByStudy(studyId: string) {
      items.value = await apiClient.get<Submission[]>(`/studies/${studyId}/submissions`);
    }

    async function fetchBySite(siteId: string) {
      items.value = await apiClient.get<Submission[]>(`/sites/${siteId}/submissions`);
    }

    async function downloadUrls(subId: string) {
      const sub = await apiClient.get<SubmissionWithUrls>(`/submissions/${subId}`);
      return sub.urls;
    }

    return { items, fetchByStudy, fetchBySite, downloadUrls };
  })();

/** Build the path-safe submission id used by the API. */
export const submissionId = (s: Pick<Submission, 'studyId' | 'siteId' | 'version'>) =>
  `${s.studyId}__${s.siteId}__${s.version}`;
