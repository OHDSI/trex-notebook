# ConnectionHandler$queryDb — Translate Path Evidence

**Status:** Verified — no overlay required  
**Date:** 2026-10-11  
**Source:** ResultModelManager GitHub clone (`/tmp/result-model-manager-audit/R/ConnectionHandler.R`)  
**Relates to:** `docs/design/duckdb-translate-rewrite-set.md` §2

---

## 1. Call Chain

Every call to `ConnectionHandler$queryDb` passes through `renderTranslateSql`, which calls
`SqlRender::translate` with the dialect sourced from `connectionDetails$dbms`:

```
ConnectionHandler$queryDb(sql, ...)       # line 175
  → .limitRowCount(sql, overrideRowLimit)  # line 176  (may wrap in SELECT TOP @n * FROM …)
  → self$renderTranslateSql(sql, ...)      # line 177
      → SqlRender::render(sql, ...)        # line 94
      → SqlRender::translate(sql, targetDialect = self$dbms())   # line 97
```

`executeSql` follows the identical path (`line 199: sql <- self$renderTranslateSql(sql, ...)`).

---

## 2. Source Quotation

**`ConnectionHandler.R` lines 88–99 — `renderTranslateSql`:**

```r
renderTranslateSql = function(sql, ...) {
  mustTranslate <- TRUE
  if (isTRUE(attr(sql, "sqlDialect", TRUE) == gsub(" ", "_", self$dbms()))) {
    mustTranslate <- FALSE
  }

  sql <- SqlRender::render(sql = sql, ...)
  # Only translate if translate is needed.
  if (mustTranslate) {
    sql <- SqlRender::translate(sql, targetDialect = self$dbms())
  }
  return(sql)
}
```

**`ConnectionHandler.R` lines 175–192 — `queryDb`:**

```r
queryDb = function(sql, snakeCaseToCamelCase = self$snakeCaseToCamelCase, overrideRowLimit = FALSE, ...) {
  sql <- .limitRowCount(sql, overrideRowLimit)
  sql <- self$renderTranslateSql(sql, ...)

  tryCatch(
    {
      data <- self$queryFunction(sql, snakeCaseToCamelCase = snakeCaseToCamelCase)
    },
    error = function(error) {
      if (self$dbms() %in% c("postgresql", "redshift")) {
        DatabaseConnector::dbExecute(self$getConnection(), "ABORT;")
      }
      stop(paste0(sql, "\n\n", error))
    }
  )

  return(data)
}
```

---

## 3. Dialect Wiring

`private$.dbms` is set from `connectionDetails$dbms` in `initialize` (line 61):

```r
private$.dbms <- connectionDetails$dbms
```

In the shinylive/WebR context, `DatabaseConnectorLite` creates the connection with
`dbms = "duckdb"`, so `self$dbms()` returns `"duckdb"` for every query issued by
OhdsiShinyModules inside the notebook app.

Therefore `SqlRender::translate(sql, targetDialect = "duckdb", …)` fires for every
`queryDb` and `executeSql` call, applying the full rewrite set shipped in Task 2.

---

## 4. Decision: No Overlay Required

Because `queryDb` already routes through `SqlRender::translate` with `targetDialect =
"duckdb"`, adding a handler-level overlay in `app.R` would be redundant. The single
interception point identified in `docs/design/duckdb-translate-rewrite-set.md` §2 is
sufficient: the bundled `SqlRender` shim package's `translate()` function, which applies
`duckdbRules.csv`, is called unconditionally by every database query.

**No changes to `plugins/results-viewer/shinylive-app/app.R` are needed for this task.**

---

## 5. Verify

```bash
grep -q "SqlRender::translate\|SqlRender\$translate" docs/design/connection-handler-translate-path.md
echo $?   # expected: 0
```
