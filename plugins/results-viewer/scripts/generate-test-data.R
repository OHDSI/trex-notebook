#!/usr/bin/env Rscript
# Generate a complete synthetic test dataset for the OHDSI results viewer.
# Reads the resultsDataModelSpecification CSVs from shinylive-app/schemas/
# and produces a ZIP of CSV files (one per table) with consistent fake data.

args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("--file=", "", args[grep("--file=", args)])
if (length(script_path) == 0) script_path <- "scripts/generate-test-data.R"
script_dir <- dirname(normalizePath(script_path))
base_dir <- normalizePath(file.path(script_dir, ".."))

schemas_dir <- file.path(base_dir, "shinylive-app", "schemas")
out_dir <- file.path(tempdir(), "ohdsi-test-data")
zip_path <- file.path(base_dir, "test-data", "test-results-full.zip")

unlink(out_dir, recursive = TRUE)
dir.create(out_dir, recursive = TRUE)

# -----------------------------------------------------------------------------
# Shared dimension values used across tables to keep FKs consistent.
# -----------------------------------------------------------------------------
DATABASES <- data.frame(
  database_id           = c("eunomia_v1", "eunomia_v2"),
  database_name         = c("Eunomia Test (Synthea)", "Eunomia Test (CPRD-like)"),
  cdm_source_name       = c("Synthea-derived Eunomia v1", "CPRD-like Eunomia v2"),
  cdm_source_abbreviation = c("EUN_V1", "EUN_V2"),
  cdm_holder            = c("OHDSI", "OHDSI"),
  source_description    = c("Synthetic primary care data for testing",
                              "Synthetic UK-style primary care data"),
  source_documentation_reference = c("https://ohdsi.github.io/Eunomia/",
                                       "https://ohdsi.github.io/Eunomia/"),
  cdm_etl_reference     = c("Eunomia ETL v1.0", "Eunomia ETL v2.0"),
  source_release_date   = c("2024-01-15", "2024-06-30"),
  cdm_release_date      = c("2024-02-01", "2024-07-15"),
  cdm_version           = c("5.4", "5.4"),
  cdm_version_concept_id = c(756265L, 756265L),
  vocabulary_version    = c("v5.0 19-AUG-2023", "v5.0 19-AUG-2023"),
  max_obs_period_end_date = c("2023-12-31", "2023-12-31"),
  stringsAsFactors = FALSE
)

COHORTS <- data.frame(
  cohort_id   = c(1L, 2L, 3L, 101L, 102L),
  cohort_name = c("Type 2 Diabetes Mellitus",
                    "Essential Hypertension",
                    "Congestive Heart Failure",
                    "Metformin Users",
                    "ACE Inhibitor Users"),
  stringsAsFactors = FALSE
)

ANALYSIS_IDS <- c(1L, 2L, 3L)

# -----------------------------------------------------------------------------
# Helpers: generate one cell value given the data type and column name.
# -----------------------------------------------------------------------------
gen_value <- function(dtype, colname, idx, n_rows) {
  dtype <- tolower(trimws(dtype))
  cn <- tolower(colname)
  is_id   <- grepl("_id$|^id$", cn)
  is_name <- grepl("name", cn) && !grepl("filename|colname", cn)
  is_date <- grepl("date", cn) || grepl("date", dtype)
  is_count <- grepl("count|n_|num_|n$|persons|subjects|entries|events", cn)
  is_rate  <- grepl("rate|proportion|fraction|prob|ratio|risk|odds|hazard", cn)
  is_concept <- grepl("concept", cn)
  is_desc <- grepl("description|comment|note", cn)
  is_json <- grepl("json", cn)
  is_sql  <- grepl("sql", cn)

  # Numeric / integer
  if (grepl("int|bigint", dtype)) {
    if (is_id || is_concept) return(as.integer(1000L + idx))
    if (is_count) return(as.integer(sample(50:5000, 1)))
    return(as.integer(sample(1:100, 1)))
  }
  if (grepl("float|double|numeric|decimal|real", dtype)) {
    if (is_rate) return(round(runif(1, 0, 1), 4))
    if (is_count) return(as.numeric(sample(50:5000, 1)))
    return(round(runif(1, 0, 100), 2))
  }
  if (grepl("bool|logical", dtype)) {
    return(sample(c(TRUE, FALSE), 1))
  }
  if (is_date) {
    return(format(as.Date("2023-01-01") + sample(0:730, 1), "%Y-%m-%d"))
  }
  # Strings
  if (is_json) return('{"id":1,"name":"stub"}')
  if (is_sql) return("SELECT 1 FROM dual")
  if (is_name) return(paste0("Item ", idx))
  if (is_desc) return(paste0("Synthetic description ", idx))
  paste0("val_", idx)
}

# -----------------------------------------------------------------------------
# Build a data.frame for a given table spec, choosing sensible row counts
# and overriding shared dimensions.
# -----------------------------------------------------------------------------
build_table <- function(tbl_name, cols_spec) {
  # Default row counts per table family
  n_rows <- 4
  if (grepl("^(cohort_count|cohort)$", tbl_name)) n_rows <- nrow(COHORTS) * nrow(DATABASES)
  if (tbl_name == "database" || grepl("database_meta", tbl_name)) n_rows <- nrow(DATABASES)
  if (grepl("^cg_cohort_definition$|^cohort_definition$", tbl_name)) n_rows <- nrow(COHORTS)
  if (grepl("incidence_rate|inclusion_rule", tbl_name)) n_rows <- 8

  df <- data.frame(matrix(nrow = n_rows, ncol = 0))

  for (i in seq_len(nrow(cols_spec))) {
    colname <- cols_spec$column_name[i]
    dtype   <- cols_spec$data_type[i]

    values <- vapply(seq_len(n_rows), function(r) {
      as.character(gen_value(dtype, colname, r, n_rows))
    }, character(1))

    # Override with shared dimension values where the column matches
    if (colname == "database_id") {
      values <- rep(DATABASES$database_id, length.out = n_rows)
    } else if (colname %in% colnames(DATABASES) && tbl_name %in% c("database", "database_meta_data", "cg_cohort_generation")) {
      vals <- DATABASES[[colname]]
      values <- rep(as.character(vals), length.out = n_rows)
    } else if (colname %in% c("cohort_id", "cohort_definition_id", "target_cohort_id", "outcome_cohort_id", "subject_cohort_id")) {
      values <- as.character(rep(COHORTS$cohort_id, length.out = n_rows))
    } else if (colname == "cohort_name") {
      values <- rep(COHORTS$cohort_name, length.out = n_rows)
    } else if (colname == "analysis_id") {
      values <- as.character(rep(ANALYSIS_IDS, length.out = n_rows))
    }

    df[[colname]] <- values
  }
  df
}

# -----------------------------------------------------------------------------
# Main loop: read all schema CSVs and emit one CSV per table.
# -----------------------------------------------------------------------------
set.seed(42)
created <- character()

for (csv_file in list.files(schemas_dir, pattern = "\\.csv$", full.names = TRUE)) {
  cat("Reading schema:", basename(csv_file), "\n")
  spec <- utils::read.csv(csv_file, stringsAsFactors = FALSE)
  if (!"table_name" %in% colnames(spec)) next

  for (tbl in unique(spec$table_name)) {
    if (tbl %in% created) next
    cols <- spec[spec$table_name == tbl, , drop = FALSE]
    df <- tryCatch(build_table(tbl, cols), error = function(e) {
      cat("  Skipped", tbl, ":", conditionMessage(e), "\n"); NULL
    })
    if (is.null(df)) next

    out_path <- file.path(out_dir, paste0(tbl, ".csv"))
    utils::write.csv(df, out_path, row.names = FALSE, quote = TRUE, na = "")
    created <- c(created, tbl)
    cat("  Wrote", tbl, "(", nrow(df), "rows ,", ncol(df), "cols)\n")
  }
}

# Also write the legacy-format tables our existing test data has
# so the simple modules still work.
cat("\nWriting legacy-format tables\n")
LEGACY <- list(
  cohort = data.frame(
    cohort_id   = COHORTS$cohort_id,
    cohort_name = COHORTS$cohort_name,
    json        = '{"id":1}',
    sql_command = "SELECT 1",
    stringsAsFactors = FALSE
  ),
  cohort_count = expand.grid(cohort_id = COHORTS$cohort_id,
                              database_id = DATABASES$database_id,
                              stringsAsFactors = FALSE) |>
    transform(
      cohort_entries = sample(100:5000, length(COHORTS$cohort_id) * length(DATABASES$database_id), replace = TRUE),
      cohort_subjects = sample(80:4500, length(COHORTS$cohort_id) * length(DATABASES$database_id), replace = TRUE)
    ),
  database = DATABASES,
  incidence_rate = data.frame(
    cohort_id     = rep(COHORTS$cohort_id, each = 2),
    database_id   = rep(DATABASES$database_id, times = nrow(COHORTS)),
    person_years  = round(runif(nrow(COHORTS) * 2, 1000, 50000), 1),
    incident_events = sample(20:500, nrow(COHORTS) * 2, replace = TRUE),
    rate          = round(runif(nrow(COHORTS) * 2, 0.5, 15), 2),
    stringsAsFactors = FALSE
  ),
  inclusion_rule_stats = data.frame(
    cohort_id     = c(1L, 1L, 2L, 2L, 3L, 3L),
    rule_sequence = c(1L, 2L, 1L, 2L, 1L, 2L),
    rule_name     = c("Age >= 18", "Has diagnosis",
                        "Age >= 18", "Continuous observation",
                        "Has diagnosis", "Drug exposure"),
    meet_count    = sample(800:5000, 6),
    gain_count    = sample(50:500, 6),
    total_count   = sample(900:6000, 6),
    database_id   = rep(DATABASES$database_id[1], 6),
    stringsAsFactors = FALSE
  )
)
for (nm in names(LEGACY)) {
  out_path <- file.path(out_dir, paste0(nm, ".csv"))
  utils::write.csv(LEGACY[[nm]], out_path, row.names = FALSE, quote = TRUE, na = "")
  cat("  Wrote (legacy)", nm, "\n")
}

# -----------------------------------------------------------------------------
# ZIP it up
# -----------------------------------------------------------------------------
dir.create(dirname(zip_path), showWarnings = FALSE, recursive = TRUE)
unlink(zip_path)
wd <- getwd()
setwd(out_dir)
tryCatch({
  files <- list.files(".", pattern = "\\.csv$")
  utils::zip(zip_path, files, flags = "-q")
}, finally = setwd(wd))

cat("\nDone!\n")
cat("Created", length(list.files(out_dir, pattern = "\\.csv$")), "CSV files\n")
cat("ZIP:", zip_path, "(", file.size(zip_path), "bytes)\n")
