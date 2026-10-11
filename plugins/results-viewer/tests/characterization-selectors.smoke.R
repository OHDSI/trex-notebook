# characterization-selectors.smoke.R
#
# End-to-end smoke: a DuckDB loaded with the minimum Characterization result
# tables feeds OhdsiShinyModules' selector queries without SQL syntax errors
# AND returns at least one row for each selector. Guards the "SELECT TOP 1"
# dialect regression and the "every selector = 0 options" symptom.
#
# Run: Rscript plugins/results-viewer/tests/characterization-selectors.smoke.R

suppressMessages({
  library(DBI); library(duckdb)
})
script_dir <- dirname(normalizePath(sub("^--file=", "",
  grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])))
source(file.path(script_dir, "..", "shinylive-app", "SqlRenderLite.R"))

failures <- 0
check <- function(cond, msg) {
  if (isTRUE(cond)) cat("PASS:", msg, "\n") else { cat("FAIL:", msg, "\n"); failures <<- failures + 1 }
}

con <- dbConnect(duckdb(), ":memory:")
dbExecute(con, "CREATE SCHEMA IF NOT EXISTS main")
dbExecute(con, "CREATE TABLE main.c_covariates (
  min_characterization_mean DOUBLE)")
dbExecute(con, "INSERT INTO main.c_covariates VALUES (0.01)")

dbExecute(con, "CREATE TABLE main.c_cohort_details (
  cohort_definition_id INT, target_cohort_id INT, outcome_cohort_id INT,
  cohort_type VARCHAR)")
dbExecute(con, "INSERT INTO main.c_cohort_details VALUES
  (1, 1, NULL, 'Target'),
  (2, NULL, 2, 'Outcome'),
  (3, 1, 2, 'TnO')")

dbExecute(con, "CREATE TABLE main.c_time_to_event (
  database_id VARCHAR, target_cohort_definition_id INT, outcome_cohort_definition_id INT,
  outcome_type VARCHAR, time_to_event INT, num_events INT)")
dbExecute(con, "INSERT INTO main.c_time_to_event VALUES
  ('db1', 1, 2, 'first', 10, 5)")

# Translated-then-executed queries (verbatim-looking shapes OhdsiShinyModules emits):
q1 <- SqlRender$translate(
  "select top 1 min_characterization_mean val from main.c_covariates", "duckdb")
r1 <- dbGetQuery(con, q1)
check(nrow(r1) == 1, "min_characterization_mean selector returns 1 row")

q2 <- SqlRender$translate(
  "select distinct target_cohort_id from main.c_cohort_details where target_cohort_id is not null", "duckdb")
r2 <- dbGetQuery(con, q2)
check(nrow(r2) >= 1, "target cohort selector returns >= 1 row")

q3 <- SqlRender$translate(
  "select distinct outcome_cohort_id from main.c_cohort_details where outcome_cohort_id is not null", "duckdb")
r3 <- dbGetQuery(con, q3)
check(nrow(r3) >= 1, "outcome cohort selector returns >= 1 row")

q4 <- SqlRender$translate(
  "select top 10 * from main.c_time_to_event where target_cohort_definition_id = 1 and outcome_cohort_definition_id = 2", "duckdb")
r4 <- dbGetQuery(con, q4)
check(nrow(r4) >= 1, "time-to-event selector returns >= 1 row after translate")

dbDisconnect(con, shutdown = TRUE)
if (failures == 0) { cat("Smoke passed.\n"); quit(status = 0) }
cat(sprintf("%d failure(s).\n", failures)); quit(status = 1)
