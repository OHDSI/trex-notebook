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
# Base tag: sha-544e400 = OHDSI/trex "fix trex init (#38)" — equals
# ghcr.io/ohdsi/trexsql:latest (digest sha256:f613923…, 2026-05-31) and bakes the
# hades DuckDB extension. Keep in sync with the trex-init pin in
# docker-compose.yml. Bump (and re-test serving) deliberately.

# ---------------------------------------------------------------------------
# Stage 1: results-viewer R runtime (shinylive export + Java-free shim pkgs).
# rocker/r-ver pins the same R as renv.lock (4.5.2). amd64 to match trexsql.
# ---------------------------------------------------------------------------
FROM --platform=linux/amd64 rocker/r-ver:4.5.2 AS r-builder

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
      "DBI", "duckdb", "RSQLite", "reactable", "jsonlite", "dplyr", "ggplot2", "plotly", \
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
FROM --platform=linux/amd64 node:22 AS web-builder
WORKDIR /src
# Bring the whole plugins tree (sub-plugins write into ../sibyl/public/plugins).
COPY plugins ./plugins

# results-viewer needs the R artifacts present BEFORE its `npm run build`, so
# vite's copy-public-assets step folds shinylive-export/ + r-packages/ into the
# output served under the plugin.
COPY --from=r-builder /rv/shinylive-export ./plugins/results-viewer/shinylive-export
COPY --from=r-builder /rv/r-packages       ./plugins/results-viewer/r-packages

# Each sub-plugin builds its SystemJS bundle into ../sibyl/public/plugins/<id>/.
RUN cd plugins/strategus     && npm ci && npm run build
RUN cd plugins/network       && npm ci && npm run build
RUN cd plugins/results-viewer && npm ci && npm run build
RUN cd plugins/jobs && npm ci && npm run build
# sibyl last — build:trex sets the /plugins/sibyl/ base and copies public/
# (now containing all three sub-plugins + config/plugins.json) into dist/.
RUN cd plugins/sibyl && npm ci && npm run build:trex

# ---------------------------------------------------------------------------
# Stage 3: bake the finished sibyl dist into the trex backend.
# ---------------------------------------------------------------------------
FROM ghcr.io/ohdsi/trexsql:sha-544e4004bfe2f4658daf6a573cfebba3ab776140

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
