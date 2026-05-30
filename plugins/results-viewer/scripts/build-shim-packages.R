#!/usr/bin/env Rscript
# Build shim package tarballs for SqlRender, DatabaseConnector, CirceR
args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("--file=", "", args[grep("--file=", args)])
if (length(script_path) == 0) script_path <- "scripts/build-shim-packages.R"
script_dir <- dirname(normalizePath(script_path))
base <- file.path(script_dir, "..", "shinylive-app", "shim-packages")
dest <- file.path(script_dir, "..", "r-packages")

for (pkg in c("SqlRender", "DatabaseConnector", "CirceR")) {
  pkg_dir <- file.path(base, pkg)
  cat("Building", pkg, "...\n")
  # Use R CMD build
  system2("R", c("CMD", "build", "--no-manual", "--no-build-vignettes", pkg_dir), stdout = TRUE, stderr = TRUE)
  # Move tarball to r-packages/
  tarballs <- list.files(".", pattern = paste0("^", pkg, "_.*\\.tar\\.gz$"))
  if (length(tarballs) > 0) {
    file.rename(tarballs[1], file.path(dest, tarballs[1]))
    cat("  ->", file.path(dest, tarballs[1]), "\n")
  }
}
