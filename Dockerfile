# Fully self-contained trex image: builds ALL plugins from source (no host
# npm/R steps, no bind-mounts) and bakes them into the trex backend.
#
#   docker compose build trex        # or: docker compose up -d --build
#
# Pipeline:
#   r-builder    — compiles the results-viewer WebR/shinylive runtime
#                  (shinylive-export/ + r-packages/) using the OHDSI R stack.
#   web-builder  — builds the SystemJS sub-plugins (strategus, network,
#                  results-viewer — the last with the R artifacts folded in)
#                  and then sibyl, whose `build:trex` copies public/ into dist/.
#   final        — trexsql base + the finished sibyl dist baked in.
#
# Base: ghcr.io/ohdsi/trexsql:latest, pinned by its multi-arch INDEX digest so
# the pin is immutable but each host pulls its native variant. As of 2026-06-01
# latest is multi-arch (linux/amd64 + linux/arm64) and bakes the hades DuckDB
# extension, so arm64 hosts (Apple Silicon) now run NATIVE — no QEMU emulation.
# Keep in sync with the trex-init / metadata-migrate pins in docker-compose.yml.
# Bump (and re-test the 2-node stack) deliberately.

# ---------------------------------------------------------------------------
# Stage 1: results-viewer R runtime (shinylive export + Java-free shim pkgs).
# rocker/r-ver pins the same R as renv.lock (4.5.2). Build native (rocker +
# node:22 are multi-arch) so the image matches the host arch trexsql now ships.
# ---------------------------------------------------------------------------
FROM rocker/r-ver:4.5.2 AS r-builder

# System libraries the OHDSI/shiny package stack links against. default-jdk +
# javareconf are required because OhdsiShinyModules imports the real
# CirceR/SqlRender/DatabaseConnector, which depend on rJava (it fails to load
# without a JDK). The build scripts later swap in pure-R shims for the WASM
# bundle, but the packages must install first.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libcurl4-openssl-dev libssl-dev libxml2-dev libgit2-dev \
      libfontconfig1-dev libharfbuzz-dev libfribidi-dev \
      libfreetype6-dev libpng-dev libtiff5-dev libjpeg-dev \
      zlib1g-dev pandoc default-jdk \
      libuv1-dev libarchive-dev libsodium-dev libicu-dev \
      libbz2-dev liblzma-dev libzstd-dev libnode-dev && \
    rm -rf /var/lib/apt/lists/* && \
    R CMD javareconf

# Install from the OHDSI R-universe (has OhdsiShinyAppBuilder/ReportGenerator/
# ResultModelManager) with CRAN as fallback. Linux binaries from these repos
# avoid most source compilation. NOTE: OhdsiShinyModules is NOT in r-universe or
# CRAN — it's installed from GitHub below.
# Install the OHDSI stack from CRAN (Posit Package Manager Linux binaries).
# IMPORTANT: install from CRAN/PPM, NOT the OHDSI r-universe — the r-universe
# rebuild of ResultModelManager lists pkgdown/pkgload (→ devtools → remotes) as
# hard *Imports*, which drags in a ~70-package devtools tail. shinylive::export
# then scans that tail and crashes (e.g. `desc$Repository` atomic on `remotes`).
# The CRAN metadata keeps those in Suggests, yielding the clean ~132-package set
# the app's renv.lock pins. (ResultModelManager/OhdsiShinyAppBuilder/
# OhdsiReportGenerator are all on CRAN; only OhdsiShinyModules is GitHub-only,
# installed below.) openxlsx + tippy are OhdsiShinyModules deps.
RUN Rscript -e 'options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest")); \
    install.packages(c( \
      "shinylive", \
      "ResultModelManager", "OhdsiShinyAppBuilder", "OhdsiReportGenerator", \
      "shiny", "shinydashboard", "shinyWidgets", "shinycssloaders", \
      "DBI", "RSQLite", "reactable", "jsonlite", "dplyr", "ggplot2", "plotly", \
      "rlang", "readr", "R6", "pool", "dbplyr", "lubridate", "fastmap", "withr", \
      "gridExtra", "markdown", "checkmate", "stringr", "tibble", "tidyr", \
      "purrr", "scales", "RColorBrewer", \
      "openxlsx", "tippy" \
    ), Ncpus = parallel::detectCores()); \
    if (!all(c("shinylive","ResultModelManager","OhdsiShinyAppBuilder","OhdsiReportGenerator") %in% rownames(installed.packages()))) quit(status = 1)'

# OhdsiShinyModules is GitHub-only (not on r-universe/CRAN). Install it from the
# source tarball via `R CMD INSTALL` — NOT remotes::install_github, which writes
# Remote* metadata that makes shinylive::export call get_github_wasm_assets() and
# hard-error (the GitHub release has no WASM assets). A plain R CMD INSTALL
# records no Remote* fields; its runtime deps are already installed above. The
# OHDSI packages have no WASM binaries anyway — build-shinylive-export.R bundles
# them from this host library afterward.
RUN Rscript -e 'td <- tempfile(fileext = ".tar.gz"); \
    download.file("https://github.com/OHDSI/OhdsiShinyModules/archive/refs/tags/v3.5.1.tar.gz", td, quiet = TRUE); \
    ex <- tempfile(); dir.create(ex); untar(td, exdir = ex); \
    src <- list.files(ex, full.names = TRUE)[1]; \
    if (system2("R", c("CMD", "INSTALL", "--no-test-load", src)) != 0) quit(status = 1); \
    if (!"OhdsiShinyModules" %in% rownames(installed.packages())) quit(status = 1)'

# Drop `devtools` from OhdsiShinyAppBuilder's Imports. OSAB is a runtime viewer
# package but (oddly) hard-Imports devtools; shinylive::export resolves the app's
# dependency graph via renv and would pull in the whole devtools tail (remotes,
# roxygen2, pkgdown, …). It then crashes scanning that tail for WASM assets
# (`desc$Repository` is atomic for `remotes`). The viewer never calls devtools at
# runtime, and the app's own renv.lock omits it — so removing it from Imports
# (DESCRIPTION text + the cached Meta/package.rds that packageDescription reads)
# yields the clean ~128-package graph that exports successfully.
RUN Rscript -e 'p <- file.path(.libPaths()[1], "OhdsiShinyAppBuilder"); \
    d <- file.path(p, "DESCRIPTION"); dcf <- read.dcf(d); \
    dcf[1, "Imports"] <- gsub("devtools[^,]*,?\\s*", "", dcf[1, "Imports"]); \
    write.dcf(dcf, d); \
    mp <- file.path(p, "Meta", "package.rds"); m <- readRDS(mp); \
    m$DESCRIPTION[["Imports"]] <- dcf[1, "Imports"]; saveRDS(m, mp); \
    if (grepl("devtools", utils::packageDescription("OhdsiShinyAppBuilder")$Imports)) quit(status = 1)'

WORKDIR /rv
# Only the inputs the R scripts read — keeps this layer cached across app edits
# that do not touch the shiny app or shim sources.
COPY plugins/results-viewer/scripts       ./scripts
COPY plugins/results-viewer/shinylive-app  ./shinylive-app

# build-shim-packages.R → r-packages/*.tar.gz (Java-free CirceR/SqlRender/
# DatabaseConnector). build-shinylive-export.R → shinylive-export/ (WebR + the
# Shiny app, OHDSI packages bundled from this stage's library).
RUN mkdir -p r-packages && \
    Rscript scripts/build-shim-packages.R && \
    Rscript scripts/build-shinylive-export.R

# ---------------------------------------------------------------------------
# Stage 2: build the JS sub-plugins and the sibyl shell.
# ---------------------------------------------------------------------------
FROM node:22 AS web-builder
WORKDIR /src
# Bring the whole plugins tree (sub-plugins write into ../sibyl/public/plugins).
COPY plugins ./plugins

# results-viewer needs the R artifacts present BEFORE its `npm run build`, so
# vite's copy-public-assets step folds shinylive-export/ + r-packages/ into the
# output served under the plugin.
COPY --from=r-builder /rv/shinylive-export ./plugins/results-viewer/shinylive-export
COPY --from=r-builder /rv/r-packages       ./plugins/results-viewer/r-packages

# Each sub-plugin builds its SystemJS bundle into ../sibyl/public/plugins/<id>/.
# Plugins that consume @ohdsi/atlas-ui (GitHub Packages) need auth: the project
# .npmrc scopes @ohdsi to npm.pkg.github.com; the token is injected as a BuildKit
# secret (NODE_AUTH_TOKEN) and written to a throwaway /root/.npmrc inside each
# RUN, so it is never baked into an image layer.
RUN --mount=type=secret,id=ghtoken,env=NODE_AUTH_TOKEN \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > /root/.npmrc \
 && cd plugins/strategus && npm ci && npm run build && rm -f /root/.npmrc
RUN --mount=type=secret,id=ghtoken,env=NODE_AUTH_TOKEN \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > /root/.npmrc \
 && cd plugins/network && npm ci && npm run build && rm -f /root/.npmrc
RUN --mount=type=secret,id=ghtoken,env=NODE_AUTH_TOKEN \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > /root/.npmrc \
 && cd plugins/results-viewer && npm ci && npm run build && rm -f /root/.npmrc
RUN --mount=type=secret,id=ghtoken,env=NODE_AUTH_TOKEN \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > /root/.npmrc \
 && cd plugins/jobs && npm ci && npm run build && rm -f /root/.npmrc
# notebook-plugin embeds the @trex/notebook lib (file:../notebook) and bundles it
# from source, so the lib's own deps must be installed first.
RUN cd plugins/notebook && npm ci
RUN --mount=type=secret,id=ghtoken,env=NODE_AUTH_TOKEN \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > /root/.npmrc \
 && cd plugins/notebook-plugin && npm ci && npm run build && rm -f /root/.npmrc
# sibyl last — build:trex sets the /plugins/sibyl/ base and copies public/
# (now containing all sub-plugins + config/plugins.json) into dist/.
RUN --mount=type=secret,id=ghtoken,env=NODE_AUTH_TOKEN \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > /root/.npmrc \
 && cd plugins/sibyl && npm ci && npm run build:trex && rm -f /root/.npmrc

# ---------------------------------------------------------------------------
# Stage 3: bake the finished sibyl dist into the trex backend.
# ---------------------------------------------------------------------------
FROM ghcr.io/ohdsi/trexsql:latest@sha256:6c3ec02c884766fd52b27c34b3dcd1a12cd385efa74edbfba03d620018794733

# --- R runtime for hades / Strategus ---------------------------------------
# The trexsql base ships the hades DuckDB extension but NOT R, so hades_execute
# fails with "Rscript not found. Install R or set R_HOME." Install R (Debian
# trixie ships R 4.5.x, matching the HADES package library renv provisions into
# the hades env) + the shared libs the OHDSI R stack links against at runtime.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      r-base-core \
      default-jre-headless \
      r-cran-rjava \
      curl \
      libcurl4 libssl3 libxml2 libsodium23 libpng16-16 \
 && R CMD javareconf \
 # rJava's .so needs libjvm.so on the dynamic-linker path; register the JRE's
 # server lib dir so DatabaseConnector (JDBC) can load at runtime.
 && echo "$(dirname "$(find /usr/lib/jvm -name libjvm.so | head -1)")" > /etc/ld.so.conf.d/rjava-jvm.conf \
 && ldconfig \
 && rm -rf /var/lib/apt/lists/*

# DatabaseConnector (JDBC) needs a driver jar; it reads DATABASECONNECTOR_JAR_FOLDER
# as the default pathToDriver. Provide the PostgreSQL driver (hades connects to
# trex's pgwire, which speaks the postgres protocol).
ENV DATABASECONNECTOR_JAR_FOLDER=/usr/local/jdbc
RUN mkdir -p /usr/local/jdbc \
 && curl -fsSL -o /usr/local/jdbc/postgresql-42.7.4.jar \
      https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.4/postgresql-42.7.4.jar

# --- trex core-server patches (overlay the pinned base) --------------------
# Raise the request-body limit (default ~100kb caps plugin POSTs such as the
# hades-api /jobs Strategus-spec submission → 413) and stop forwarding the
# client's stale content-length after the body is re-serialized (→ "user body
# write aborted: early end"). Upstream fix belongs in OHDSI/trex core/server;
# patch the baked copy here so a rebuilt image keeps it.
RUN sed -i 's/router.use(express.json());/router.use(express.json({ limit: "50mb" }));/' /usr/src/core/server/routes/cli-login.ts \
 && sed -i 's/if (lower === "accept-encoding") continue;/if (lower === "accept-encoding" || lower === "content-length" || lower === "transfer-encoding") continue;/' /usr/src/core/server/plugin/function.ts
USER node

# package.json carries the trex.ui.routes entry (path /sibyl, dir dist); trex
# serves the dist under /plugins/sibyl. The dist also contains
# plugins/<strategus|network|results-viewer>/ + config/plugins.json, which the
# sibyl host loads at runtime via SystemJS.
COPY plugins/sibyl/package.json            /usr/src/plugins/sibyl/package.json
COPY --from=web-builder /src/plugins/sibyl/dist /usr/src/plugins/sibyl/dist

# network-api: function-only plugin (no build — Deno runs the .ts directly).
# Holds the per-site Cognito confidential client and reverse-proxies the network
# plugin's calls to the central API with a machine token. trex's plugin scanner
# mounts its trex.functions.api route on boot.
COPY plugins/network-api/package.json /usr/src/plugins/network-api/package.json
COPY plugins/network-api/functions    /usr/src/plugins/network-api/functions
# Signup credential store (network schema) — applied by the trex migration runner.
COPY plugins/network-api/migrations    /usr/src/plugins/network-api/migrations

# hades-api: function-only plugin (no build — Deno runs the .ts directly).
# REST over the hades_* Strategus execution SQL; trex mounts its
# trex.functions.api route on boot.
COPY plugins/hades-api/package.json /usr/src/plugins/hades-api/package.json
COPY plugins/hades-api/functions    /usr/src/plugins/hades-api/functions

# metadata-api: function plugin + migrations (notebook schema). Functions handle
# the encrypted CDM password and result publishing; GraphQL serves the rest.
COPY plugins/metadata-api/package.json /usr/src/plugins/metadata-api/package.json
COPY plugins/metadata-api/functions    /usr/src/plugins/metadata-api/functions
COPY plugins/metadata-api/migrations    /usr/src/plugins/metadata-api/migrations

# Regenerates dist/config/network-config.js from NETWORK_* env vars at startup
# (invoked from the trex service entrypoint in docker-compose.yml) so the
# network sub-plugin's Cognito/API config is set at runtime, no rebuild needed.
# --chmod sets the exec bit at copy time (the final stage runs as USER node,
# which can't chmod a root-owned file via a separate RUN).
COPY --chmod=755 docker/write-network-config.sh /usr/local/bin/write-network-config.sh
