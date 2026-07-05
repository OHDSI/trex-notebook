// Thin client for the site's `network-api` trex function plugin, reused as-is
// from the network plugin (D3: no new proxy). It proxies to the central
// coordinator API; central's contract (`central/shared/src/schemas.ts` /
// `central/web/src/stores/studies.ts`) is duplicated here rather than imported
// because each trex plugin builds independently.
import { authHeaders } from './authToken';

export const defaultBase = (): string => `${location.origin}/plugins/network-api/network-api`;

interface SignupStateResponse {
  status?: string;
}

/** True only when the network is configured AND this site is an active member. */
export async function isNetworkActive(base: string = defaultBase()): Promise<boolean> {
  try {
    const res = await fetch(`${base}/signup/state`, { headers: { ...authHeaders() } });
    if (res.status !== 200) return false;
    const body = (await res.json()) as SignupStateResponse;
    return body.status === 'active';
  } catch {
    return false;
  }
}

interface CoordinatorStateResponse {
  configured?: boolean;
}

/**
 * True only when network-api has a coordinator credential path central will
 * actually accept as role=coordinator on POST /studies and POST
 * /studies/{id}/publish. As of this writing central never grants that role
 * to a machine token (see network-api/index.ts), so this reports false in
 * every real deployment until that changes on the central side.
 */
export async function isCoordinatorConfigured(base: string = defaultBase()): Promise<boolean> {
  try {
    const res = await fetch(`${base}/coordinator/state`, { headers: { ...authHeaders() } });
    if (res.status !== 200) return false;
    const body = (await res.json()) as CoordinatorStateResponse;
    return body.configured === true;
  } catch {
    return false;
  }
}

export interface PublishStudyArgs {
  name: string;
  description: string;
  version: string;
  specJson: string;
  renvLock: string;
}

interface PresignedUpload {
  filename: string;
  url: string;
  s3Key: string;
}

interface StudyWithUploads {
  study: { studyId: string };
  uploads: { strategus: PresignedUpload; renvLock: PresignedUpload };
}

/**
 * Mirrors central's createWithUploads + publish flow: create the draft study,
 * PUT the two artifacts to their presigned URLs (unauthenticated — the URLs
 * are pre-signed), then publish it.
 */
export async function publishStudy(args: PublishStudyArgs, base: string = defaultBase()): Promise<void> {
  const createRes = await fetch(`${base}/studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name: args.name, description: args.description, version: args.version }),
  });
  if (!createRes.ok) {
    throw new Error(`create study failed: ${createRes.status}`);
  }
  const data = (await createRes.json()) as StudyWithUploads;

  const putStrategus = await fetch(data.uploads.strategus.url, { method: 'PUT', body: args.specJson });
  if (!putStrategus.ok) {
    throw new Error(`strategus.json upload failed: ${putStrategus.status}`);
  }

  const putRenvLock = await fetch(data.uploads.renvLock.url, { method: 'PUT', body: args.renvLock });
  if (!putRenvLock.ok) {
    throw new Error(`renv.lock upload failed: ${putRenvLock.status}`);
  }

  const publishRes = await fetch(`${base}/studies/${encodeURIComponent(data.study.studyId)}/publish`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });
  if (!publishRes.ok) {
    throw new Error(`publish failed: ${publishRes.status}`);
  }
}
