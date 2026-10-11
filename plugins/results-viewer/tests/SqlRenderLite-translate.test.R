# SqlRenderLite-translate.test.R
#
# Verifies SqlRender$translate rewrites the MSSQL idioms OhdsiShinyModules
# emits (SELECT TOP n, ISNULL, GETDATE, DATEDIFF, DATEADD, LEN, IIF, CONVERT,
# DATETIME, WITH (NOLOCK), OPTION (...), [bracketed]) into DuckDB-compatible
# SQL. The regression this guards: Characterization queries that reach DuckDB
# untranslated fail with "syntax error at or near \"1\"" on SELECT TOP 1.
#
# Run: Rscript plugins/results-viewer/tests/SqlRenderLite-translate.test.R

get_script_path <- function() {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("^--file=", args, value = TRUE)
  if (length(file_arg) > 0) return(normalizePath(sub("^--file=", "", file_arg[1])))
  normalizePath(sys.frame(1)$ofile)
}
script_dir <- dirname(get_script_path())
source(file.path(script_dir, "..", "shinylive-app", "SqlRenderLite.R"))

failures <- 0
check <- function(condition, message) {
  if (isTRUE(condition)) cat("PASS:", message, "\n")
  else { cat("FAIL:", message, "\n"); failures <<- failures + 1 }
}
eq <- function(a, b) identical(gsub("\\s+", " ", trimws(a)), gsub("\\s+", " ", trimws(b)))

# --- SELECT TOP n ---
check(eq(SqlRender$translate("SELECT TOP 1 x FROM t", "duckdb"), "SELECT x FROM t LIMIT 1"),
      "SELECT TOP 1 x FROM t  ->  SELECT x FROM t LIMIT 1")
check(eq(SqlRender$translate("select top 5 a, b from c where d = 1;", "duckdb"),
         "SELECT a, b from c where d = 1 LIMIT 5;"),
      "lowercase select upcased; TOP stripped; LIMIT appended before semicolon")
check(eq(SqlRender$translate("SELECT DISTINCT TOP 3 x FROM t", "duckdb"),
         "SELECT DISTINCT x FROM t LIMIT 3"),
      "SELECT DISTINCT TOP preserved")
check(eq(SqlRender$translate(
          "select top 1 min_characterization_mean val from main.c_covariates", "duckdb"),
         "SELECT min_characterization_mean val from main.c_covariates LIMIT 1"),
      "actual Characterization regression query translated")

# --- ISNULL ---
check(eq(SqlRender$translate("SELECT ISNULL(x, 0) FROM t", "duckdb"),
         "SELECT COALESCE(x, 0) FROM t"),
      "ISNULL -> COALESCE")

# --- GETDATE / SYSDATETIME ---
check(eq(SqlRender$translate("SELECT GETDATE()", "duckdb"), "SELECT CURRENT_TIMESTAMP"),
      "GETDATE() -> CURRENT_TIMESTAMP")
check(eq(SqlRender$translate("SELECT SYSDATETIME()", "duckdb"), "SELECT CURRENT_TIMESTAMP"),
      "SYSDATETIME() -> CURRENT_TIMESTAMP")

# --- LEN ---
check(eq(SqlRender$translate("SELECT LEN(name) FROM t", "duckdb"),
         "SELECT LENGTH(name) FROM t"),
      "LEN -> LENGTH")

# --- IIF ---
check(eq(SqlRender$translate("SELECT IIF(x > 0, 'y', 'n') FROM t", "duckdb"),
         "SELECT CASE WHEN x > 0 THEN 'y' ELSE 'n' END FROM t"),
      "IIF(cond, a, b) -> CASE WHEN cond THEN a ELSE b END")

# --- DATEDIFF ---
check(eq(SqlRender$translate("SELECT DATEDIFF(dd, a, b) FROM t", "duckdb"),
         "SELECT date_diff('day', a, b) FROM t"),
      "DATEDIFF(dd, a, b) -> date_diff('day', a, b)")
check(eq(SqlRender$translate("SELECT DATEDIFF(month, a, b) FROM t", "duckdb"),
         "SELECT date_diff('month', a, b) FROM t"),
      "DATEDIFF(month, a, b) -> date_diff('month', a, b)")

# --- DATEADD ---
check(eq(SqlRender$translate("SELECT DATEADD(day, 7, d) FROM t", "duckdb"),
         "SELECT (d + INTERVAL (7) DAY) FROM t"),
      "DATEADD(day, 7, d) -> (d + INTERVAL (7) DAY)")

# --- CONVERT ---
check(eq(SqlRender$translate("SELECT CONVERT(VARCHAR(10), x) FROM t", "duckdb"),
         "SELECT CAST(x AS VARCHAR) FROM t"),
      "CONVERT(VARCHAR(n), x) -> CAST(x AS VARCHAR)")
check(eq(SqlRender$translate("SELECT CONVERT(INT, x) FROM t", "duckdb"),
         "SELECT CAST(x AS INT) FROM t"),
      "CONVERT(INT, x) -> CAST(x AS INT)")

# --- CAST ... AS DATETIME ---
check(eq(SqlRender$translate("SELECT CAST(x AS DATETIME) FROM t", "duckdb"),
         "SELECT CAST(x AS TIMESTAMP) FROM t"),
      "CAST(x AS DATETIME) -> CAST(x AS TIMESTAMP)")
check(eq(SqlRender$translate("SELECT CAST(x AS DATETIME2(3)) FROM t", "duckdb"),
         "SELECT CAST(x AS TIMESTAMP) FROM t"),
      "CAST(x AS DATETIME2(3)) -> CAST(x AS TIMESTAMP)")

# --- CAST with nested function call (C-1 nested-paren fix) ---
check(eq(SqlRender$translate("SELECT CAST(DATE_TRUNC('day', x) AS DATETIME) FROM t", "duckdb"),
         "SELECT CAST(DATE_TRUNC('day', x) AS TIMESTAMP) FROM t"),
      "CAST(DATE_TRUNC('day', x) AS DATETIME) -> CAST(DATE_TRUNC('day', x) AS TIMESTAMP)")
check(eq(SqlRender$translate("SELECT CAST(fn(a, b) AS DATETIME2) FROM t", "duckdb"),
         "SELECT CAST(fn(a, b) AS TIMESTAMP) FROM t"),
      "CAST(fn(a, b) AS DATETIME2) -> CAST(fn(a, b) AS TIMESTAMP)")

# --- TRY_CAST -> CAST (C-2) ---
check(eq(SqlRender$translate("SELECT TRY_CAST(x AS INT) FROM t", "duckdb"),
         "SELECT CAST(x AS INT) FROM t"),
      "TRY_CAST(x AS INT) -> CAST(x AS INT)")

# --- WITH (NOLOCK) ---
check(eq(SqlRender$translate("SELECT x FROM t WITH (NOLOCK)", "duckdb"),
         "SELECT x FROM t"),
      "WITH (NOLOCK) stripped")

# --- OPTION (...) ---
check(eq(SqlRender$translate("SELECT x FROM t OPTION (MAXDOP 1)", "duckdb"),
         "SELECT x FROM t"),
      "trailing OPTION(...) stripped")

# --- [bracketed] identifiers ---
check(eq(SqlRender$translate("SELECT [col] FROM [tbl]", "duckdb"),
         'SELECT "col" FROM "tbl"'),
      "[ident] -> \"ident\"")

# --- quote-safety: string literals must not be rewritten ---
check(eq(SqlRender$translate("SELECT 'SELECT TOP 1 x' FROM t", "duckdb"),
         "SELECT 'SELECT TOP 1 x' FROM t"),
      "SELECT TOP inside a string literal left alone")
check(eq(SqlRender$translate("SELECT 'ISNULL(a, b)' FROM t", "duckdb"),
         "SELECT 'ISNULL(a, b)' FROM t"),
      "ISNULL(...) inside a string literal left alone")

# --- idempotence ---
once <- SqlRender$translate("SELECT TOP 1 x FROM t WITH (NOLOCK)", "duckdb")
twice <- SqlRender$translate(once, "duckdb")
check(identical(once, twice), "translate() is idempotent on an already-translated statement")

# --- passthrough for unknown dialect ---
check(identical(SqlRender$translate("SELECT TOP 1 x FROM t", "oracle"),
                "SELECT TOP 1 x FROM t"),
      "non-duckdb/sqlite dialect: passthrough")

# --- integration smoke on DuckDB: translate -> execute -> get one row ---
if (requireNamespace("duckdb", quietly = TRUE) && requireNamespace("DBI", quietly = TRUE)) {
  con <- DBI::dbConnect(duckdb::duckdb(), ":memory:")
  DBI::dbExecute(con, "CREATE TABLE c_covariates (min_characterization_mean DOUBLE)")
  DBI::dbExecute(con, "INSERT INTO c_covariates VALUES (0.01), (0.02)")
  translated <- SqlRender$translate(
    "select top 1 min_characterization_mean val from main.c_covariates", "duckdb")
  row <- DBI::dbGetQuery(con, translated)
  check(nrow(row) == 1 && !is.na(row$val[1]),
        "translated regression query executes on DuckDB and returns one row")
  DBI::dbDisconnect(con, shutdown = TRUE)
} else {
  cat("SKIP: duckdb package not available for integration smoke test\n")
}

cat("\n")
if (failures == 0) { cat("All checks passed.\n"); quit(status = 0) }
cat(sprintf("%d failure(s).\n", failures)); quit(status = 1)
