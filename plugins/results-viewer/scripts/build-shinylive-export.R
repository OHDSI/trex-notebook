#!/usr/bin/env Rscript
# Build the shinylive export and override CirceR/SqlRender/DatabaseConnector
# with our pure-R shim packages (the WebR repo has the real Java-dependent versions
# which would fail to load in WebR).

args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("--file=", "", args[grep("--file=", args)])
if (length(script_path) == 0) script_path <- "scripts/build-shinylive-export.R"
script_dir <- dirname(normalizePath(script_path))
base_dir <- normalizePath(file.path(script_dir, ".."))

shim_dir <- file.path(base_dir, "shinylive-app", "shim-packages")
export_dir <- file.path(base_dir, "shinylive-export")
pkg_lib_dir <- file.path(export_dir, "shinylive", "webr", "packages")

cat("Step 1: Run shinylive::export\n")
unlink(export_dir, recursive = TRUE)
shinylive::export(
  file.path(base_dir, "shinylive-app"),
  export_dir
)

cat("\nStep 1b: Bundle the prebuilt WebR (WASM) duckdb from the WebR repo\n")
# The app's library(duckdb) + the DatabaseConnector shim's duckdb::duckdb() run
# ONLY inside WebR. duckdb is NOT compiled on the host (the native build fails and
# isn't needed); we pull the prebuilt WASM binary straight from the WebR repo and
# drop it into the package set. The WebR R version here matches the bundled DBI
# (1.3.0 == r-wasm 4.5), so pin the 4.5 duckdb. shinylive does not fetch it on its
# own once the shim is a pure-R package, so we add it explicitly.
webr_r_ver <- "4.5"
duckdb_ver <- "1.5.2"
duckdb_dir <- file.path(pkg_lib_dir, "duckdb")
if (!dir.exists(duckdb_dir)) dir.create(duckdb_dir, recursive = TRUE)
duckdb_tgz <- file.path(duckdb_dir, paste0("duckdb_", duckdb_ver, ".tgz"))
duckdb_url <- sprintf(
  "https://repo.r-wasm.org/bin/emscripten/contrib/%s/duckdb_%s.tgz",
  webr_r_ver, duckdb_ver
)
cat("  downloading", duckdb_url, "\n")
download.file(duckdb_url, duckdb_tgz, mode = "wb", quiet = TRUE)
if (!file.exists(duckdb_tgz) || file.info(duckdb_tgz)$size == 0) {
  stop("failed to download prebuilt WebR duckdb from ", duckdb_url)
}
cat("  bundled", basename(duckdb_tgz), "(", file.info(duckdb_tgz)$size, "bytes)\n")

cat("\nStep 1c: Enable + version-tag shinylive's service worker cache\n")
# Enable shinylive's `useCaching` so the SW serves the heavy /shinylive/ assets
# (WebR runtime + R package binaries, ~150 MB) cache-first on repeat opens.
# Two guards make this safe: Chromium issues cache:"only-if-cached" requests
# whose mode is not "same-origin"; both fetch() and the Request constructor
# reject that combination ("only-if-cached can be set only with same-origin
# mode"), which killed asset loads and app_* proxying ("App URL not
# registered") when caching was first tried. Such requests are (a) skipped in
# the fetch handler so the browser resolves them natively from its HTTP cache,
# and (b) normalized in the app_* proxy Request rebuild.
# The app build id is folded into the SW cache version so each rebuild drops
# stale caches cleanly. shinylive's export contains more than one copy of
# shinylive-sw.js (the active one sits at the export root); patch every copy.
sw_files <- list.files(export_dir, pattern = "^shinylive-sw\\.js$",
                        recursive = TRUE, full.names = TRUE)
if (length(sw_files) == 0) {
  stop("build-shinylive-export: no shinylive-sw.js found under ", export_dir)
}
build_id <- Sys.getenv("RV_BUILD_ID", unset = format(Sys.time(), "%Y%m%d%H%M%S"))
patched_any <- FALSE
for (sw_path in sw_files) {
  txt <- readChar(sw_path, file.info(sw_path)$size)
  before <- txt
  txt <- sub("var useCaching = false;", "var useCaching = true;", txt, fixed = TRUE)
  txt <- sub('var version = "v10";',
             sprintf('var version = "v10-%s";', build_id), txt, fixed = TRUE)
  txt <- sub("cache: request.cache,",
             'cache: request.cache === "only-if-cached" ? void 0 : request.cache,',
             txt, fixed = TRUE)
  txt <- sub("if (useCaching) {",
             paste0('if (request.cache === "only-if-cached" && request.mode !== "same-origin") {\n',
                    "    return;\n",
                    "  }\n",
                    "  if (useCaching) {"),
             txt, fixed = TRUE)
  if (!identical(txt, before)) {
    writeLines(txt, sw_path, sep = "")
    patched_any <- TRUE
    cat("  patched", sw_path, "\n")
  }
}
if (!patched_any) {
  stop("build-shinylive-export: useCaching/version markers not found in any shinylive-sw.js")
}
cat("  version tagged", build_id, "(useCaching ON with only-if-cached guards)\n")

cat("\nStep 2: Override Java-dep packages with pure-R shims\n")
temp_lib <- tempfile("shim-libs-")
dir.create(temp_lib)
on.exit(unlink(temp_lib, recursive = TRUE))

for (pkg in c("SqlRender", "DatabaseConnector", "CirceR")) {
  cat("  Building shim:", pkg, "\n")
  # Install our shim to temp lib
  result <- system2("R", c("CMD", "INSTALL", "-l", temp_lib,
                            file.path(shim_dir, pkg)),
                    stdout = TRUE, stderr = TRUE)

  if (!dir.exists(file.path(temp_lib, pkg))) {
    cat("    FAILED to install shim:", pkg, "\n")
    cat("    Output:", paste(tail(result, 5), collapse = "\n"), "\n")
    next
  }

  # Find the existing tgz to preserve the version in filename
  # (shinylive expects pkg_<version>.tgz where version is in metadata.rds)
  target_dir <- file.path(pkg_lib_dir, pkg)
  if (!dir.exists(target_dir)) {
    # shinylive::export only creates a package dir for packages it resolved a
    # WebR binary for. A pure-shim package with no WebR binary (e.g.
    # DatabaseConnector — not in the WebR CRAN repo) has no dir, so the old
    # "skip" silently dropped its shim → WebR couldn't load it → the viewer fell
    # back to a degraded UI. Create the dir so the shim tgz is bundled (Step 4
    # then adds its metadata entry).
    cat("    Creating missing package dir for pure-shim:", pkg, "\n")
    dir.create(target_dir, recursive = TRUE)
  }

  existing_tgz <- list.files(target_dir, pattern = "\\.tgz$", full.names = TRUE)
  if (length(existing_tgz) == 0) {
    # No existing tgz — use shim version
    desc <- read.dcf(file.path(temp_lib, pkg, "DESCRIPTION"))
    version <- desc[1, "Version"]
    out_tgz <- file.path(target_dir, paste0(pkg, "_", version, ".tgz"))
  } else {
    # Reuse existing filename (e.g., CirceR_1.3.3.tgz) so metadata still matches
    out_tgz <- existing_tgz[1]
    cat("    Reusing filename:", basename(out_tgz), "\n")
    unlink(out_tgz)
  }

  # Create new tgz
  wd <- getwd()
  setwd(temp_lib)
  tryCatch({
    system2("tar", c("czf", out_tgz, pkg), stdout = NULL, stderr = NULL)
  }, finally = setwd(wd))

  cat("    Replaced with shim:", out_tgz, "\n")
}

# Note: metadata.rds intentionally NOT modified for shim packages. Even if version
# in metadata.rds says "1.3.3" but the actual tgz is "99.0.0", shinylive will load
# the tgz file in the directory. The version mismatch is harmless.

cat("\nStep 3: Bundle OHDSI packages from host install\n")
# shinylive may leave empty dirs for packages it found in library() but couldn't
# install from the WebR repo. Use our host-installed copies.
host_lib <- .libPaths()[1]
for (pkg in c("ResultModelManager", "OhdsiShinyAppBuilder", "OhdsiShinyModules", "OhdsiReportGenerator")) {
  host_pkg <- file.path(host_lib, pkg)
  if (!dir.exists(host_pkg)) {
    cat("  ", pkg, "not installed on host, skipping\n")
    next
  }
  target_dir <- file.path(pkg_lib_dir, pkg)
  if (!dir.exists(target_dir)) {
    dir.create(target_dir, recursive = TRUE)
  }
  # Check if tgz is already there
  existing_tgz <- list.files(target_dir, pattern = "\\.tgz$", full.names = TRUE)
  desc <- read.dcf(file.path(host_pkg, "DESCRIPTION"))
  version <- desc[1, "Version"]
  if (length(existing_tgz) == 0) {
    out_tgz <- file.path(target_dir, paste0(pkg, "_", version, ".tgz"))
    cat("  Bundling", pkg, "v", version, "\n")
  } else {
    out_tgz <- existing_tgz[1]
    cat("  Replacing", basename(out_tgz), "\n")
    unlink(out_tgz)
  }
  wd <- getwd()
  setwd(host_lib)
  tryCatch({
    system2("tar", c("czf", out_tgz, pkg), stdout = NULL, stderr = NULL)
  }, finally = setwd(wd))
}

cat("\nStep 4: Fix metadata entries for all bundled packages\n")
metadata_path <- file.path(pkg_lib_dir, "metadata.rds")
if (file.exists(metadata_path)) {
  metadata <- readRDS(metadata_path)

  # Find a template entry that has assets populated (e.g., dplyr)
  template <- metadata[["dplyr"]]

  for (pkg in c("SqlRender", "DatabaseConnector", "CirceR", "ResultModelManager",
                 "OhdsiShinyModules", "OhdsiShinyAppBuilder", "OhdsiReportGenerator",
                 "duckdb")) {
    target_dir <- file.path(pkg_lib_dir, pkg)
    tgz_files <- list.files(target_dir, pattern = "\\.tgz$")
    if (length(tgz_files) == 0) {
      cat("  No tgz for", pkg, "- skipping\n")
      next
    }
    tgz_name <- tgz_files[1]
    version <- sub(".*_([^_]+)\\.tgz$", "\\1", tgz_name)

    # Build entry from template
    entry <- template
    entry$name <- setNames(pkg, pkg)
    entry$version <- version
    entry$ref <- structure(paste0(pkg, "@", version), class = "glue")
    entry$cached <- TRUE
    entry$assets <- list(list(
      filename = structure(tgz_name, class = "glue"),
      url = structure(paste0("packages/", pkg, "/", tgz_name), class = "glue")
    ))
    entry$type <- "package"
    entry$path <- structure(paste0("packages/", pkg, "/", tgz_name), class = "glue")
    metadata[[pkg]] <- entry
    cat("  Fixed metadata for", pkg, "v", version, "->", tgz_name, "\n")
  }

  # Step 5: Drop entries with no usable asset (e.g. rJava, pak — transitive deps
  # of the *real* OHDSI packages that have no WebR binary and aren't loaded once
  # the pure-R shims replace them). webR chokes on a cached entry with no
  # path/assets, so leaving them breaks package mounting.
  drop <- Filter(function(nm) {
    e <- metadata[[nm]]
    is.null(e$path) || is.null(e$assets) || length(e$assets) == 0
  }, names(metadata))
  for (nm in drop) metadata[[nm]] <- NULL
  if (length(drop)) cat("  Dropped unusable entries:", paste(drop, collapse = ", "), "\n")

  saveRDS(metadata, metadata_path)
}

cat("\nDone! Export ready at:", export_dir, "\n")
