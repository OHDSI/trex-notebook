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
import { HadesClient, defaultHadesBase } from '../api/hadesClient';
import type { HadesJobDetail, RunRequest } from '../api/hadesTypes';

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

const metadataBase = (): string => `${location.origin}/plugins/metadata-api/metadata-api`;

async function exportGzViaMetadataApi(jobId: string, uploadUrl: string, dbFilename?: string): Promise<void> {
  const res = await fetch(`${metadataBase()}/results/export-gz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, uploadUrl, dbFilename }),
  });
  if (!res.ok) throw new Error(`export-gz failed (${res.status})`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const useNetworkStore = (apiClient?: ApiClient) =>
  defineStore('network', () => {
    const api = apiClient ?? defaultClient();
    const studies = ref<Study[]>([]);
    const submissions = ref<Submission[]>([]);
    const _putFile = ref<(url: string, file: File) => Promise<void>>(putFileToS3);
    const _hades: { value: Pick<HadesClient, 'execute' | 'getJob'> } = { value: new HadesClient(defaultHadesBase()) };
    const _exportGz: { value: (jobId: string, url: string, dbFilename?: string) => Promise<void> } = {
      value: exportGzViaMetadataApi,
    };
    const _sleep: { value: (ms: number) => Promise<void> } = { value: sleep };

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

    async function runStudy(
      studyId: string,
      opts: { cdmSchema: string; envName: string; name?: string },
    ): Promise<string> {
      const pkg = await getPackage(studyId);
      const specResp = await fetch(pkg.strategusUrl);
      if (!specResp.ok) throw new Error(`fetch spec failed (${specResp.status})`);
      const spec = await specResp.json();
      const run: RunRequest = {
        spec,
        cdmSchema: opts.cdmSchema,
        envName: opts.envName,
        name: opts.name ?? studyId,
      };
      return _hades.value.execute(run);
    }

    async function awaitJob(
      jobId: string,
      onProgress?: (job: HadesJobDetail) => void,
    ): Promise<HadesJobDetail> {
      for (;;) {
        const job = await _hades.value.getJob(jobId);
        onProgress?.(job);
        if (job.status === 'COMPLETED') return job;
        if (job.status === 'FAILED' || job.status === 'CANCELLED') {
          throw new Error(job.errorMessage ?? `job ${job.status}`);
        }
        await _sleep.value(2000);
      }
    }

    async function submitRun(studyId: string, jobId: string, dbFilename?: string): Promise<Submission> {
      const payload = { files: [{ filename: 'results.db.gz' }] };
      const parsed = initiateSubmissionSchema.safeParse(payload);
      if (!parsed.success) throw new Error('invalid submission payload');
      const initiated = await api.post<SubmissionWithUrls>(
        `/studies/${studyId}/submissions`,
        payload,
      );
      const target = initiated.urls.find((u) => u.filename === 'results.db.gz');
      if (!target) throw new Error('no upload url returned');
      await _exportGz.value(jobId, target.url, dbFilename);
      return api.post<Submission>(`/submissions/${submissionId(initiated)}/complete`);
    }

    return {
      studies, submissions, loadStudies, getPackage, submit, loadMySubmissions,
      runStudy, awaitJob, submitRun,
      _putFile, _hades, _exportGz, _sleep,
    };
  })();
