// Client for the notebook-git-api trex function — the server-side git mirror.
//
// The plugin writes notebook rows through PostGraphile (see useNotebooksStore),
// so there is no server-side seam on the write path; the store calls
// mirrorNotebook() right after each successful write instead.
//
// Path shape: under d2e, trex functions are served at ${origin}/<source> — the
// same form authToken.ts uses for /trex-token. (The doubled
// /plugins/<source>/<source> form in the trex-notebook siblings' targets the
// standalone sibyl host and 404s here; verified against the running stack.)
import { authHeaders, ensureAuthToken } from "./authToken";
import type {
  MirrorResponse,
  NotebookTemplateDto,
  OverwriteFromRemoteResponse,
  RemoteDiffCheckResponse,
} from "./types";

/**
 * Git mirroring is OFF.
 *
 * Every call to this function currently returns 401 from trex's plugin-function
 * auth, even though /trex/graphql succeeds with the same session — the two take
 * different auth paths, and the trex-native token the function layer wants is
 * not reaching it. That 401 is not containable: Atlas's login-guard.js shows its
 * sign-in dialog on ANY 401 response, so a failing mirror on save (or a
 * diff-check on click) logs the user out of the page mid-edit.
 *
 * Until that is resolved the notebook saves to Postgres only, which is lossless —
 * the mirror is a copy, not the system of record. Flip this back to true to
 * re-enable pushing on save and to show the Sync-from-Remote button; nothing
 * else needs changing, and the backend routes/tests all remain in place.
 */
export const GIT_MIRROR_ENABLED = false

export const notebookGitBase = (): string =>
  `${location.origin}/notebook-git-api`;

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
