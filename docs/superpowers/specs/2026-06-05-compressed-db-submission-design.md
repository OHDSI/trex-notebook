# Compressed-DB Result Submission — Design

**Date:** 2026-06-05
**Branch:** `p-hoffmann/compressed-db-submission`
**Status:** Approved design, pending implementation plan

## Context

The repo already implements every piece of a federated-analysis loop, but the
site-side glue is missing. Today:

- **strategus** authors a Strategus analysis spec (`strategus.json`).
- **central** (serverless API) publishes a study and hands sites the spec via
  presigned GET URLs (`GET /studies/{id}/package`), and accepts result
  **submissions** of `.db` files via presigned S3 PUT
  (`initiateSubmission` → upload → `completeSubmission`).
- **hades-api** (trex Deno edge fn) executes a spec in-process via the hades
  DuckDB extension (`hades_execute(...)`), writing into a run dir
  `HADES_OUTPUT_BASE_DIR/<runId>` (symlinked as `.../<jobId>`). It produces a
  results DuckDB database named `dbName = name ?? cdmSchema` under that dir.
- **metadata-api** (trex Deno edge fn) can `zip` a whole run dir and upload it to
  trex-local storage (`POST /results/publish`).
- **results-viewer** renders HADES results in-browser (WebR + DuckDB-WASM/Shiny).

What does not exist: a network-plugin flow that takes a published study, runs it
through hades, and submits the **results database** back to central. And the
central submission schema only accepts bare `.db` filenames.

## Goal

Wire the **full site round-trip** in the network plugin:

> fetch study package → execute via hades-api → produce a **gzip-compressed
> results DB** (`results.db.gz`) → submit it to central (initiate → upload →
> complete) → coordinator views it in results-viewer.

## Non-goals (this plan)

- Coordinator-side aggregation/meta-analysis across sites.
- Changing the `metadata-api` `POST /results/publish` (trex-local zip) path — it
  stays as-is for the in-trex publish use case.
- Auth/Cognito changes — the existing human (PKCE) + machine (client-credentials
  via network-api) model is reused unchanged.

## Compression decision

**gzip, single file: `results.db.gz`.**

The hades run produces exactly one results DuckDB database, so an archive format
(zip) buys nothing. gzip is a single streamable file, compressible/decompressible
with `CompressionStream("gzip")` in the Deno worker and `gzip`/`zlib`/
`DecompressionStream` everywhere on the consumer side. Central just stores and
serves the object; the coordinator/results-viewer gunzips before loading.

## Architecture & data flow

The results `.db` lives only on the **trex server filesystem**
(`HADES_OUTPUT_BASE_DIR/<jobId>`), reachable by edge functions, **not** the
browser. The browser also must not relay a multi-hundred-MB file. Therefore:

**Approach A — browser orchestrates, edge function transfers the bytes.**

```
network plugin (browser)                 trex edge fns            central API / S3
─────────────────────────                ─────────────           ────────────────
1. GET /studies/{id}/package  ───────────────────────────────▶  presigned GET (spec, renv.lock)
2. POST hades-api {spec,...}  ──▶ hades_execute()
   poll hades-api status      ──▶ hades_status() → COMPLETED
3. POST /studies/{id}/submissions
      files:[{filename:"results.db.gz"}] ────────────────────▶  returns presigned PUT url
4. POST metadata-api /results/export-gz
      { jobId, uploadUrl }      ──▶ read run-dir .db
                                    gzip (CompressionStream)
                                    PUT bytes ─────────────────▶  S3 (presigned PUT)
                                  ◀── { sizeBytes, etag }
5. POST /submissions/{subId}/complete ───────────────────────▶  headObject verifies → 'complete'
6. (coordinator) GET /submissions/{subId} → presigned GET → results-viewer gunzips → DuckDB-WASM
```

The large file travels **server → S3** directly; the browser only carries small
JSON control messages. All site traffic is outbound HTTPS (firewall-friendly,
consistent with the existing model).

## Components & changes

### 1. `central/shared/src/schemas.ts` — accept compressed db
`dbFile.filename` regex `/\.db$/` → also accept `/\.db\.gz$/`. Keep the
`^[A-Za-z0-9._-]+$` safe-charset guard. Update `central/shared/tests/schemas.spec.ts`:
accept `results.db.gz`, still reject `foo.zip` / path-traversal names.
`completeSubmission` already verifies object existence via `headObject` — no
change. S3 key derivation in `initiateSubmission` is filename-agnostic — no change.

### 2. `plugins/metadata-api/functions/index.ts` — new `POST /results/export-gz`
Body `{ jobId, uploadUrl, dbFilename? }`. Steps:
1. Resolve run dir `OUTPUT_BASE/<jobId>` and locate the results DB file
   (see Open Items — exact name/extension to be pinned first).
2. Stream the file through `new CompressionStream("gzip")`.
3. `PUT` the gzipped bytes to `uploadUrl` (the central presigned S3 URL),
   `content-type: application/gzip`.
4. Return `{ sizeBytes, etag }` (etag from the S3 PUT response, for the caller's
   bookkeeping).
Add `gzipFile()` and `putToUrl()` helpers alongside the existing
`zipDir`/`walkFiles`. Reject (hard error, no upload) on missing or zero-byte DB.

### 3. `plugins/network/src/` — orchestration + UI
- A service (e.g. `src/services/runStudy.ts`) implementing the 6-step flow above,
  composing the existing `ApiClient` (central, via network-api proxy) + the
  hades-api client + the new metadata-api call.
- A small UI surface: a "Run study → Submit results" action with progress states
  (`fetching → executing (module x/n) → compressing → uploading → submitted`) and
  per-step error display.
- Reuse `hadesClient` patterns from `plugins/strategus`/`plugins/jobs`.

### 4. `plugins/results-viewer/src/` — accept `results.db.gz`
Add a `.db.gz` input path: gunzip (`DecompressionStream("gzip")`) → load the
`.db` directly into DuckDB-WASM (instead of, or in addition to, the current CSV
ingest). **Verify** the viewer can consume a DuckDB file as part of the plan; if
the current pipeline is CSV-only, add the DB-attach path.

## Error handling

- hades `FAILED` → surface `errorMessage`, abort before any submission.
- Missing/zero-byte results DB in run dir → hard error; never submit an empty file.
- Presigned URL expiry mid-flow → re-initiate the submission (fresh URL).
- `completeSubmission` → `UPLOAD_INCOMPLETE` (headObject missing) → retry the
  upload step, then complete again.
- metadata-api edge fn has no inbound-from-internet exposure; it only makes the
  outbound PUT — a failed PUT returns a typed error to the browser, which decides
  whether to retry or abort.

## Testing

- **central/shared:** unit tests for the filename regex (accept `results.db.gz`;
  reject `x.db.gz.exe`, `x.zip`, `../x.db.gz`).
- **metadata-api:** unit test for `/results/export-gz` — temp dir with a small
  fake `.db`, mocked `fetch` for the PUT, assert gzip magic bytes + that the PUT
  target is `uploadUrl`; assert hard error on missing/empty DB.
- **network plugin:** flow test mocking the three central calls + hades-api +
  metadata-api, asserting call order and that a hades `FAILED` aborts before
  submit. Plus the existing playwright mount smoke.
- **results-viewer:** a test that a gzipped `.db` round-trips into a queryable
  DuckDB-WASM instance.

## Open items

1. **Exact results-DB filename/extension** inside `OUTPUT_BASE/<jobId>`
   (`dbName` + which suffix hades writes — `.duckdb`? `.db`? a `sqlite`?).
   **Resolved by design:** `findResultsDb` in `metadata-api/functions/export.ts`
   auto-detects the largest non-`spec.json` file, so correctness no longer keys
   off the exact name; `dbFilename?` in the `/results/export-gz` body is an
   explicit override. **Still worth a one-time empirical confirmation** when the
   stack is up: run a study, then
   `docker compose exec <trex-service> sh -c 'ls -la "$HADES_OUTPUT_BASE_DIR"/*/'`
   and verify auto-detect selected the right file (and that no larger non-DB
   artifact sits in the run dir — if one does, pass `dbFilename` explicitly from
   `StudiesToExecuteView.runAndSubmit` → `store.submitRun`).
2. **results-viewer DB ingest** — RESOLVED: the viewer was CSV-only; binary
   DuckDB ingest was added via the base64 ATTACH path (see "Viewer binary
   `.db.gz` ingest" above). Manual verification of that path is pending a live
   stack run.

## Out of scope / future

- Per-site differential privacy / disclosure filters on the results DB.
- Resumable/multipart upload for very large DBs (current presigned single PUT is
  fine for the expected sizes; revisit if DBs exceed S3 single-PUT limits).

## Viewer binary `.db.gz` ingest — manual verification

The results-viewer was found to ingest **CSV-only** through a Shinylive iframe
(`ResultsLibrary.vue` → `ShinyFrame.vue` postMessage → `shinylive-app/app.R`);
the `webr-manager.ts` module the plan originally targeted is dead code. The
viewer now also accepts a submitted binary DuckDB file (`results.db.gz`, or raw
`results.db`), transported into the iframe as base64 chunks and ATTACHed
read-only into the in-memory `.results_con`, with each table re-exposed as a
view so the existing OHDSI modules see the data unmodified.

**Runtime path:**
- `ResultsLibrary.vue` `openMeta()` branches on `meta.name`: `*.db.gz` →
  `gunzipBuffer` → emit `Map(['results.db', raw])`; `*.db` → emit as-is; else the
  existing JSZip CSV path. File picker now accepts `.zip,.db,.db.gz`.
- `ShinyFrame.vue` `trySendData()`: if a `.db` entry is present, send ONLY it as
  base64 via `RESULT_DB_BEGIN/CHUNK/END` (512 KB per chunk); otherwise the
  existing `RESULT_FILES_*` CSV path runs. The `DATA_RECEIVED` ack is shared.
- `app.R` JS bridge accumulates `__resultDb` and on `RESULT_DB_END` calls
  `Shiny.setInputValue('result_db', ...)` then acks. The R side
  `observeEvent(input$result_db)` (added to both `server_fn` variants)
  base64-decodes to a temp file, `ATTACH ... AS submitted (READ_ONLY)`, then
  `CREATE OR REPLACE VIEW` per submitted table and fires `APP_READY`.

**How to test (manual — cannot be automated here):**
1. Bring up the full stack (hades runtime + sibyl host + Shinylive export).
2. Run a study so a `results.db.gz` is produced/submitted.
3. In the results-viewer library, Import the `results.db.gz`.
4. After the WebR cold boot (1–3 min), confirm the overlay clears and the OHDSI
   dashboard renders data; the Shinylive console should log
   `Attached submitted DuckDB: N tables`.

**KNOWN RISK — DuckDB storage-format compatibility:** the `.db` is written by
hades' DuckDB version; webR's `duckdb` must be able to `ATTACH` that on-disk
storage version. DuckDB storage is not guaranteed compatible across major
versions — a version mismatch makes `ATTACH` fail (caught and logged as
`Failed to attach submitted DB: ...`, viewer stays empty). Fix: align the DuckDB
versions, or switch to a portable transport (`EXPORT DATABASE` / table copy).
This is the most likely thing to surface in manual testing.

**NOTE — base64 memory:** the whole DB is held as a base64 string on both sides
(~1.33× binary size in JS, plus the decoded copy). Fine for moderate DBs; very
large DBs may need a streamed/FS (OPFS or WebR FS) transport instead.
