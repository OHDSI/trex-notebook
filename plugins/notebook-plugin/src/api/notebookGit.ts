// Client for the notebook-git-api trex function — the server-side git mirror.
//
// The plugin writes notebook rows through PostGraphile (see useNotebooksStore),
// so there is no server-side seam on the write path; the store calls
// mirrorNotebook() right after each successful write instead.
//
// Path shape: this function ships in the @ohdsi/notebook-git plugin, and trex
// mounts TRUSTED scopes (@trex/, @ohdsi/) under PLUGINS_BASE_PATH/<scope>/ —
// hence /plugins/ohdsi/<source> rather than the bare ${origin}/<source> that
// legacy @data2evidence plugins (e.g. /trex-token) keep.
//
// The scope is load-bearing, not cosmetic. Trusted plugins are guarded by
// trex's own auth (authContext + pluginAuthz), which validates the trex-native
// token authToken.ts already obtains from /trex-token. Untrusted plugins go
// through d2eAuthn, which verifies against a Logto JWKS that does not exist
// when D2E_IDP_MODE=trex (no Logto container runs) — that was the cause of the
// blanket 401s on this API's previous home under @data2evidence/sibyl.
import { authHeaders, ensureAuthToken } from "./authToken";
import type {
  MirrorResponse,
  NotebookTemplateDto,
  OverwriteFromRemoteResponse,
  RemoteDiffCheckResponse,
} from "./types";

/**
 * Pushing notebooks OUT to a git remote is OFF, because the mirror repo is
 * configured on the git-integration setup page and nothing configures it yet.
 * With no repo, a push on every save would fail on every save.
 *
 * This is a product state, not a bug: the Sync-from-Remote button stays VISIBLE
 * but disabled so the feature is discoverable and reads as "not configured
 * yet". Notebooks save to Postgres regardless, which is lossless — the mirror
 * is a copy, not the system of record.
 *
 * Flip to true once the setup page can supply a repo; the backend routes and
 * their tests are all in place. Note this does NOT gate templates: those only
 * read a public, server-configured repo (see getTemplates).
 */
export const GIT_MIRROR_ENABLED = false

export const notebookGitBase = (): string =>
  `${location.origin}/plugins/ohdsi/notebook-git-api`;

async function call<T>(path: string, method: "GET" | "POST"): Promise<T> {
  await ensureAuthToken();
  const resp = await fetch(`${notebookGitBase()}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body?.detail || body?.error || "";
    } catch {
      // Non-JSON or empty error body — fall back to the status line.
    }
    throw new Error(detail || `notebook-git ${resp.status}`);
  }
  return (await resp.json()) as T;
}

/** Push a notebook's current row state to the configured repo. */
export const mirrorNotebook = (id: string): Promise<MirrorResponse> =>
  call<MirrorResponse>(`/${id}/mirror`, "POST");

/** Does the repo hold different content than the row? */
export const checkRemoteDiff = (id: string): Promise<RemoteDiffCheckResponse> =>
  call<RemoteDiffCheckResponse>(`/${id}/remote-diff-check`, "GET");

/** Overwrite the row from the repo's version. */
export const overwriteFromRemote = (id: string): Promise<OverwriteFromRemoteResponse> =>
  call<OverwriteFromRemoteResponse>(`/${id}/overwrite-from-remote`, "POST");

/** List notebook templates from the configured template repo (may be []). */
export const getTemplates = (): Promise<NotebookTemplateDto[]> =>
  call<NotebookTemplateDto[]>("/templates", "GET");
