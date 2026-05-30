import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Study, StudyWithUploads, CreateStudyBody } from '@central/shared';
import { api as defaultApi } from '../api';
import type { ApiClient } from '../api/client';

async function putFileToS3(url: string, file: File): Promise<void> {
  const res = await fetch(url, { method: 'PUT', body: file });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
}

export const useStudiesStore = (apiClient: ApiClient = defaultApi) =>
  defineStore('studies', () => {
    const studies = ref<Study[]>([]);
    // seam so tests can stub the direct-to-S3 upload
    const _putFile = ref(putFileToS3);

    async function fetchAll() {
      studies.value = await apiClient.get<Study[]>('/studies');
    }

    async function createWithUploads(
      body: CreateStudyBody,
      strategusFile: File,
      renvLockFile: File,
    ): Promise<Study> {
      const res = await apiClient.post<StudyWithUploads>('/studies', body);
      await _putFile.value(res.uploads.strategus.url, strategusFile);
      await _putFile.value(res.uploads.renvLock.url, renvLockFile);
      return res.study;
    }

    async function publish(studyId: string) {
      await apiClient.post(`/studies/${studyId}/publish`);
      await fetchAll();
    }

    async function archive(studyId: string) {
      await apiClient.post(`/studies/${studyId}/archive`);
      await fetchAll();
    }

    return { studies, createWithUploads, publish, archive, fetchAll, _putFile };
  })();
