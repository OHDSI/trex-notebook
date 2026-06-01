// @ts-nocheck - Deno edge function, runs in trex's EdgeRuntime (not tsc-compiled)
//
// REST over the hades_* Strategus execution SQL. Mounted by trex like network-api
// at <PLUGINS_BASE_PATH>/<scope>/hades-api/* (see trex.functions.api in package.json).
// SQL transport is isolated in sql.ts (the only Phase-0-dependent module).

import { route } from "./router.ts";
import { query } from "./sql.ts";
import {
  buildJobsSql, buildStatusSql, buildCancelSql, buildEnvsSql,
  buildSetupEnvSql, buildExecuteSql, normalizeJob, normalizeEnv,
} from "./hades.ts";

const ENVS_BASE = Deno.env.get("HADES_ENVS_BASE_DIR") ?? "";
const OUTPUT_BASE = Deno.env.get("HADES_OUTPUT_BASE_DIR") ?? "";
const WORK_SCHEMA = Deno.env.get("HADES_WORK_SCHEMA") ?? "work";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Auth gate — trex injects x-user-id for authenticated callers.
  const userId = req.headers.get("x-user-id");
  if (!userId) return json({ error: "UNAUTHORIZED" }, 401);
  if (!ENVS_BASE || !OUTPUT_BASE) return json({ error: "NOT_CONFIGURED" }, 503);

  // Mirror network-api's mount handling: strip up to and including the LAST
  // "/hades-api" segment, so both a doubled "/plugins/hades-api/hades-api/jobs"
  // and a bare "/hades-api/jobs" yield "/jobs".
  const url = new URL(req.url);
  const PREFIX = "/hades-api";
  const idx = url.pathname.lastIndexOf(PREFIX);
  if (idx === -1) return json({ error: "NOT_FOUND" }, 404);
  let path = url.pathname.slice(idx + PREFIX.length) || "/";
  if (!path.startsWith("/")) path = "/" + path;

  const r = route(req.method, path);
  try {
    switch (r.kind) {
      case "listJobs": {
        const { rows } = await query(buildJobsSql());
        return json({ jobs: rows.map(normalizeJob) });
      }
      case "jobStatus": {
        const { rows } = await query(buildStatusSql(r.id));
        if (rows.length === 0) return json({ error: "NOT_FOUND" }, 404);
        const job = normalizeJob(rows[0]);
        const logTail = String(rows[0].log_tail ?? "").split("\n").filter(Boolean);
        return json({ ...job, logTail });
      }
      case "cancelJob": {
        await query(buildCancelSql(r.id));
        return json({ status: "cancelled", jobId: r.id });
      }
      case "listEnvs": {
        const { rows } = await query(buildEnvsSql(ENVS_BASE));
        return json({ envs: rows.map(normalizeEnv) });
      }
      case "setupEnv": {
        const b = await req.json();
        if (!b.envName || !b.lockfilePath) return json({ error: "BAD_REQUEST" }, 400);
        const { rows } = await query(buildSetupEnvSql(b.lockfilePath, b.envName, ENVS_BASE));
        // hades_setup_env returns snake_case keys in its JSON cell; map to the
        // camelCase the REST contract / UI client expect.
        const o = JSON.parse(String(rows[0]?.result ?? "{}"));
        return json({ status: o.status, envName: o.env_name, packages: o.packages, rVersion: o.r_version });
      }
      case "execute": {
        const b = await req.json();
        if (!b.spec || !b.cdmSchema || !b.envName) return json({ error: "BAD_REQUEST" }, 400);
        const runId = crypto.randomUUID();
        const runDir = `${OUTPUT_BASE}/${runId}`;
        await Deno.mkdir(runDir, { recursive: true });
        const specPath = `${runDir}/spec.json`;
        await Deno.writeTextFile(specPath, JSON.stringify(b.spec));
        const dbName = (b.name ?? b.cdmSchema) as string;
        const { rows } = await query(buildExecuteSql({
          specPath, cdmSchema: b.cdmSchema, workSchema: WORK_SCHEMA,
          outputPath: runDir, dbName, envName: b.envName, envBaseDir: ENVS_BASE,
        }));
        const result = JSON.parse(String(rows[0]?.result ?? "{}"));
        const jobId = result.job_id ?? runId;
        // hades mints its OWN job_id (execute.rs create_job), distinct from our
        // runId-named output dir. The Rscript is still writing to runDir by path,
        // so we must NOT rename it; instead symlink jobId -> runDir so the
        // metadata-api publish step (which only knows jobId) can find the output.
        if (result.job_id && result.job_id !== runId) {
          await Deno.symlink(runDir, `${OUTPUT_BASE}/${jobId}`).catch(() => {});
        }
        return json({ jobId });
      }
      default:
        return json({ error: "NOT_FOUND" }, 404);
    }
  } catch (e) {
    return json({ error: "HADES_ERROR", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
