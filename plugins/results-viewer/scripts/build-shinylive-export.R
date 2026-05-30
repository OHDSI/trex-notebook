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
    cat("    WARNING: target dir doesn't exist, skipping:", target_dir, "\n")
    next
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
                 "OhdsiShinyModules", "OhdsiShinyAppBuilder", "OhdsiReportGenerator")) {
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
