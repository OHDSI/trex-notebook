import { defineStore } from 'pinia';
import { ref } from 'vue';
import { loadConfig } from '../config';
import { ApiClient } from '../api/client';
import { initiateSubmissionSchema } from '../api/schemas';
import {
  type Study,
  type StudyPackage,
  type Submission,
  type SubmissionWithUrls,
  submissionId,
} from '../api/types';

function defaultClient(): ApiClient {
  // All calls go through the network-api trex function plugin (proxyUrl): it
  // holds the site's machine secret server-side and attaches the machine token.
  // The browser sends no bearer — access is gated by the trex session. The
  // human/Cognito browser-login path has been removed entirely.
  const cfg = loadConfig();
  return new ApiClient(cfg.proxyUrl, () => null);
}

async function putFileToS3(url: string, file: File): Promise<void> {
  const res = await fetch(url, { method: 'PUT', body: file });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
}

export const useNetworkStore = (apiClient?: ApiClient) =>
  defineStore('network', () => {
    const api = apiClient ?? defaultClient();
    const studies = ref<Study[]>([]);
    const submissions = ref<Submission[]>([]);
    const _putFile = ref<(url: string, file: File) => Promise<void>>(putFileToS3);

    async function loadStudies() {
      studies.value = await api.get<Study[]>('/studies');
    }

    async function getPackage(studyId: string): Promise<StudyPackage> {
      return api.get<StudyPackage>(`/studies/${studyId}/package`);
    }

    async function submit(studyId: string, files: File[]): Promise<Submission> {
      const payload = { files: files.map((f) => ({ filename: f.name })) };
      const parsed = initiateSubmissionSchema.safeParse(payload);
      if (!parsed.success) throw new Error('only .db files with safe names are allowed');

      const initiated = await api.post<SubmissionWithUrls>(
        `/studies/${studyId}/submissions`,
        payload,
      );
      const byName = new Map(files.map((f) => [f.name, f]));
      for (const u of initiated.urls) {
        const file = byName.get(u.filename);
        if (file) await _putFile.value(u.url, file);
      }
      const completed = await api.post<Submission>(
        `/submissions/${submissionId(initiated)}/complete`,
      );
      return completed;
    }

    async function loadMySubmissions(siteId: string) {
      submissions.value = await api.get<Submission[]>(`/sites/${siteId}/submissions`);
    }

    return { studies, submissions, loadStudies, getPackage, submit, loadMySubmissions, _putFile };
  })();
