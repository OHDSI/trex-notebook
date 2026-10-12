# DuckDB Translate Rewrite Set — MSSQL Idioms Audit

**Status:** Approved for Task 2 implementation  
**Date:** 2026-10-11  
**Scope:** OhdsiShinyModules Characterization queries + ResultModelManager SQL helpers

---

## 1. Audit Sources

### 1.1 OhdsiShinyModules (GitHub clone, depth=1)

- Repo: `https://github.com/OHDSI/OhdsiShinyModules.git`
- Audited path: `/tmp/ohdsi-shiny-modules-audit/R/`
- Key files: `characterization-database.R`, `characterization-*.R`, `cohort-diagnostics-characterization.R`, `data-diagnostic-*.R`, `components-largeTableViewer.R`

**Finding:** No SQL files under `inst/sql/`. All SQL is embedded as inline strings in R files.  
`OhdsiShinyModules` package was not installed locally; audited from GitHub source tree.

### 1.2 ResultModelManager (GitHub clone, depth=1)

- Repo: `https://github.com/OHDSI/ResultModelManager.git`
- Audited path: `/tmp/result-model-manager-audit/R/ConnectionHandler.R`

### 1.3 SqlRender Shim (worktree, bundled package)

- Bundled rules: `plugins/results-viewer/shinylive-app/shim-packages/SqlRender/inst/csv/duckdbRules.csv`
- Source shim: `plugins/results-viewer/src/shims/SqlRenderLite.R`

---

## 2. `ResultModelManager::ConnectionHandler$queryDb` — Dialect Dispatch

**Source:** `/tmp/result-model-manager-audit/R/ConnectionHandler.R`, lines 88–99 and 175–191.

The flow is:

```
queryDb(sql, ...) 
  → .limitRowCount(sql, overrideRowLimit)   # may wrap in SELECT TOP @n * FROM (...)
  → self$renderTranslateSql(sql, ...)
      → SqlRender::render(sql, ...)
      → SqlRender::translate(sql, targetDialect = self$dbms())
```

`self$dbms()` returns `private$.dbms`, which is set from `connectionDetails$dbms` at
initialization (line 61). In the shinylive/WebR context the `DatabaseConnectorLite` shim
creates connections with `dbms = "duckdb"` (DatabaseConnectorLite.R line 9, 24, 28).

**Conclusion:** `SqlRender::translate(sql, targetDialect = "duckdb", …)` is the **single
interception point**. The shim's `translate()` function in the bundled package
(`shim-packages/SqlRender/R/functions.R`) is rule-based and loads `duckdbRules.csv`.
The _source_ shim (`src/shims/SqlRenderLite.R` line 130–133) is a **no-op stub** — it
passes SQL unchanged to DuckDB. This divergence is a concern: Task 2 must ensure the
source shim has actual translation logic (or that the bundled package is always what
gets loaded at runtime).

**Additional:** `ResultModelManager::ConnectionHandler.R` line 23 wraps queries in
`SELECT TOP @limit_row_count * FROM (@query) result;` when `LIMIT_ROW_COUNT` env var is
set. This `SELECT TOP` is itself a MSSQL idiom that must be translated for DuckDB.

---

## 3. Evidence: MSSQL Idioms Found in Sources

### 3.1 `SELECT TOP n` (row-limit idiom)

**Direct evidence in OhdsiShinyModules:**
- `characterization-database.R:907` — `"select top 1  min_characterization_mean val from"`

**Evidence in ResultModelManager:**
- `ConnectionHandler.R:23` — `SqlRender::render("SELECT TOP @limit_row_count * FROM (@query) result;")`

DuckDB equivalent: `SELECT … LIMIT n` or `SELECT … LIMIT n` wrapping subquery.

### 3.2 `ISNULL(a, b)` (null-coalescing)

No direct occurrences found in OhdsiShinyModules characterization R files; the cohort-diagnostics
SQL uses `IS NOT NULL` (standard SQL). However, `ISNULL` is pervasive in SqlRender's MSSQL
template ecosystem and appears in `duckdbRules.csv` (line 60). It is also handled in the
`translate()` fallback path (`src/shims/SqlRenderLite.R:196`).

**DuckDB equivalent:** `COALESCE(a, b)`

### 3.3 `GETDATE()` / `SYSDATETIME()` (current timestamp)

No direct occurrences found in OhdsiShinyModules R files. `GETDATE()` is covered by
`duckdbRules.csv` line 30 (`GETDATE()` → `CURRENT_DATE`) and by the fallback shim
(`src/shims/SqlRenderLite.R:197`). `SYSDATETIME()` is not in the CSV rules; it is an
MSSQL-only higher-precision variant.

**DuckDB equivalent:** `CURRENT_TIMESTAMP` (or `CURRENT_DATE` for date-only)

### 3.4 `DATEDIFF(<unit>, a, b)` (date difference)

No direct occurrences in OhdsiShinyModules characterization files.  
Covered by `duckdbRules.csv` lines 20–28 for units: `d`, `dd`, `day`, `year`, `yyyy`, `yy`,
`month`, `mm`, `m`.

**Note:** Line 20 has an asymmetry — `DATEDIFF(d,@start, @end)` translates to
`(CONVERT(DATE, @end) - CAST(@start AS DATE))` — mixing `CONVERT` and `CAST`. `CONVERT`
itself needs the rule on line 31 (`CONVERT(DATE, @a)` → `CAST(@a AS DATE)`) to fire
first, making rule order critical.

**DuckDB equivalent (day):** `(CAST(b AS DATE) - CAST(a AS DATE))` (returns integer in DuckDB)

### 3.5 `DATEADD(<unit>, n, d)` (date arithmetic)

No direct occurrences in OhdsiShinyModules characterization files.  
Covered by `duckdbRules.csv` lines 7–18 for units: `second`, `minute`, `hour`, `d`, `dd`,
`day`, `m`, `mm`, `month`, `yy`, `yyyy`, `year`.

**DuckDB equivalent (day):** `(d + TO_DAYS(CAST(n AS INTEGER)))`

### 3.6 `LEN(x)` (string length)

No direct occurrences in characterization files. Covered by `duckdbRules.csv` line 54.

**DuckDB equivalent:** `LENGTH(x)`

### 3.7 `CONVERT(<type>, x)` and `CONVERT(VARCHAR(n), x)`

No direct occurrences in OhdsiShinyModules characterization files.  
`duckdbRules.csv` line 31: `CONVERT(DATE, @a)` → `CAST(@a AS DATE)`.  
`CONVERT(VARCHAR, @date, 112)` → `STRFTIME(@date, '%Y%m%d')` (line 29).  
General `CONVERT(type, x)` not in duckdbRules.csv — only date-specific forms covered.

**DuckDB equivalent:** `CAST(x AS <type>)`

### 3.8 `CAST(x AS DATETIME)` / `CAST(x AS DATETIME2)` (datetime cast)

No direct occurrences in OhdsiShinyModules characterization files.  
`duckdbRules.csv` lines 74–75: `DATETIME` → `TIMESTAMP`, `DATETIME2` → `TIMESTAMP` (bare
keyword replacements, not CAST-specific).

**DuckDB equivalent:** `CAST(x AS TIMESTAMP)`

### 3.9 `WITH (NOLOCK)` (table hint)

No direct occurrences in any OhdsiShinyModules R files. NOLOCK is a SQL Server optimizer
hint that has no DuckDB equivalent. It must be stripped.

**DuckDB equivalent:** Remove entirely (strip the hint clause)

### 3.10 `OPTION (…)` (query hint)

No direct occurrences in OhdsiShinyModules characterization files. SQL Server-only trailing
optimizer directive. Must be stripped for DuckDB.

**DuckDB equivalent:** Remove entirely (strip `OPTION (…)` clause)

### 3.11 `IIF(cond, a, b)` (inline if)

No direct occurrences in OhdsiShinyModules characterization files.  
`duckdbRules.csv` line 4: `IIF(@condition, @whentrue, @whenfalse)` → `CASE WHEN @condition THEN @whentrue ELSE @whenfalse END`.

**DuckDB equivalent:** `CASE WHEN cond THEN a ELSE b END`

### 3.12 `CHOOSE(idx, v1, v2, …)` (indexed choice)

No occurrences found in any OhdsiShinyModules file. Not in duckdbRules.csv.  
MSSQL-only; no direct DuckDB equivalent.

**DuckDB equivalent:** `CASE WHEN idx=1 THEN v1 WHEN idx=2 THEN v2 … END` (manual rewrite)

### 3.13 `[bracketed_identifier]` (quoted identifier)

No direct occurrences in OhdsiShinyModules characterization R files (they use plain identifiers).
SQL Server uses `[...]` for escaping identifiers; DuckDB uses `"..."`.

**DuckDB equivalent:** `"identifier"` — strip brackets and wrap in double-quotes if needed

### 3.14 `TRY_CAST(@a)` (safe cast)

Covered by `duckdbRules.csv` line 3: `TRY_CAST(@a)` → `CAST(@a)`.  
No occurrences found in characterization files.

**DuckDB equivalent:** `CAST(@a)` (DuckDB native CAST does not soft-fail; use TRY_CAST if available in future DuckDB versions)

---

## 4. Additional Idioms Discovered

### 4.1 String concatenation operator `+` → `||`

`duckdbRules.csv` lines 36–41 handle `+` string concat → `||` for various CAST-VARCHAR
combinations. OhdsiShinyModules uses `CONCAT(…)` (standard SQL) — no raw `+` concat found.

### 4.2 `SELECT … INTO #temp` (temp table creation)

`duckdbRules.csv` lines 80–82 handle `SELECT … INTO` patterns. OhdsiShinyModules
characterization queries do not use temp tables in the result-query path.

### 4.3 `#temp` table prefix

`duckdbRules.csv` line 83: `#` → (empty) strips the MSSQL temp table `#` prefix.

### 4.4 `GETDATE()` → `CURRENT_DATE` gap

`duckdbRules.csv` maps `GETDATE()` to `CURRENT_DATE` (not `CURRENT_TIMESTAMP`). This
loses time-of-day precision. If any query compares timestamps, this may cause type
mismatches.

---

## 5. Source Shim vs. Bundled Package Divergence (Concern)

The source shim `src/shims/SqlRenderLite.R` has a **no-op `translate()`**:

```r
SqlRender$translate <- function(sql, targetDialect = "duckdb", tempEmulationSchema = NULL) {
  # DuckDB uses standard SQL — no translation needed.
  sql
}
```

The bundled package shim `shim-packages/SqlRender/R/functions.R` has a **full rule-based
`translate()`** that loads `duckdbRules.csv`.

Task 2 must align these two. The correct behaviour is for `translate()` to apply the
rewrite set. The source file is what gets built into the shim package during
`scripts/build-shim-packages.R`, so the no-op stub would be copied to the bundle,
overwriting the rule-based version. This relationship needs investigation before Task 2.

---

## 6. Rewrite Set for Task 2 Implementation

The following table is the authoritative rewrite set. Regexes are PCRE (perl=TRUE,
ignore.case=TRUE). Each rule includes one evidence citation.

| # | Pattern (PCRE) | DuckDB Replacement | Evidence |
|---|---|---|---|
| 1 | `\bSELECT\s+TOP\s+(\d+)\s+` | `SELECT ` + append `LIMIT \1` | `characterization-database.R:907`; `ConnectionHandler.R:23`; `duckdbRules.csv:84` |
| 2 | `\bISNULL\s*\(` | `COALESCE(` | `duckdbRules.csv:60`; shim fallback `SqlRenderLite.R:196` |
| 3 | `\bGETDATE\s*\(\s*\)` | `CURRENT_DATE` | `duckdbRules.csv:30`; shim fallback `SqlRenderLite.R:197` |
| 4 | `\bSYSDATETIME\s*\(\s*\)` | `CURRENT_TIMESTAMP` | MSSQL-only; not in duckdbRules.csv — gap identified in audit |
| 5 | `\bDATEDIFF\s*\(\s*(day\|dd\|d)\s*,([^,]+),([^)]+)\)` | `(CAST(\3 AS DATE) - CAST(\2 AS DATE))` | `duckdbRules.csv:20-22` |
| 6 | `\bDATEDIFF\s*\(\s*(year\|yyyy\|yy)\s*,([^,]+),([^)]+)\)` | `(EXTRACT(YEAR FROM CAST(\3 AS DATE)) - EXTRACT(YEAR FROM CAST(\2 AS DATE)))` | `duckdbRules.csv:23-25` |
| 7 | `\bDATEDIFF\s*\(\s*(month\|mm\|m)\s*,([^,]+),([^)]+)\)` | `(extract(year from age(CAST(\3 AS DATE),CAST(\2 AS DATE)))*12+extract(month from age(CAST(\3 AS DATE),CAST(\2 AS DATE))))` | `duckdbRules.csv:26-28` |
| 8 | `\bDATEADD\s*\(\s*(day\|dd\|d)\s*,([^,]+),([^)]+)\)` | `(\3 + TO_DAYS(CAST(\2 AS INTEGER)))` | `duckdbRules.csv:10-12` |
| 9 | `\bDATEADD\s*\(\s*(month\|mm\|m)\s*,([^,]+),([^)]+)\)` | `(\3 + TO_MONTHS(CAST(\2 AS INTEGER)))` | `duckdbRules.csv:13-15` |
| 10 | `\bDATEADD\s*\(\s*(year\|yy\|yyyy)\s*,([^,]+),([^)]+)\)` | `(\3 + TO_YEARS(CAST(\2 AS INTEGER)))` | `duckdbRules.csv:16-18` |
| 11 | `\bLEN\s*\(` | `LENGTH(` | `duckdbRules.csv:54` |
| 12 | `\bCONVERT\s*\(\s*DATE\s*,([^)]+)\)` | `CAST(\1 AS DATE)` | `duckdbRules.csv:31` |
| 13 | `\bCONVERT\s*\(\s*VARCHAR[^,]*\s*,([^)]+)\)` | `CAST(\1 AS VARCHAR)` | `duckdbRules.csv:29`; general CONVERT gap |
| 14 | `\bCAST\s*\(([^A]+)\s+AS\s+DATETIME2?\s*\)` | `CAST(\1 AS TIMESTAMP)` | `duckdbRules.csv:74-75` |
| 15 | `\s+WITH\s*\(\s*NOLOCK\s*\)` | `` (empty string) | Not in duckdbRules.csv; MSSQL-only hint — audit gap |
| 16 | `\s+OPTION\s*\([^)]*\)\s*;?` | `;` (or empty) | Not in duckdbRules.csv; MSSQL-only hint — audit gap |
| 17 | `\bIIF\s*\(([^,]+),([^,]+),([^)]+)\)` | `CASE WHEN \1 THEN \2 ELSE \3 END` | `duckdbRules.csv:4` |
| 18 | `\bCHOOSE\s*\(` | `/* CHOOSE — needs manual rewrite */` | Not in duckdbRules.csv; no DuckDB equivalent |
| 19 | `\[([^\]]+)\]` | `"\1"` (replace bracketed with double-quoted) | Not in duckdbRules.csv; MSSQL identifier quoting |
| 20 | `\bTRY_CAST\s*\(` | `CAST(` | `duckdbRules.csv:3` |
| 21 | `\bDATE_FORMAT\b` | `STRFTIME` | Consistency with `duckdbRules.csv:29` STRFTIME usage |
| 22 | `\bCOUNT_BIG\s*\(` | `COUNT(` | `duckdbRules.csv:62` |
| 23 | `\bNEWID\s*\(\s*\)` | `uuid()` | `duckdbRules.csv:64` |

---

## 7. Summary

- OhdsiShinyModules Characterization module contains **one direct MSSQL idiom** in its R source: `SELECT TOP 1` (`characterization-database.R:907`).
- ResultModelManager's `ConnectionHandler` introduces a second `SELECT TOP @n` when `LIMIT_ROW_COUNT` env var is set (`ConnectionHandler.R:23`).
- All other listed idioms (`ISNULL`, `DATEDIFF`, `DATEADD`, `LEN`, `CONVERT`, `DATETIME`, `IIF`, etc.) are present in SqlRender's standard MSSQL-targeted SQL templates used by OHDSI packages and are translated via the bundled `duckdbRules.csv`.
- **Two gaps** in the existing `duckdbRules.csv` that Task 2 must add: `WITH (NOLOCK)` stripping and `OPTION (…)` stripping.
- **One gap** in the existing source shim: `SYSDATETIME()` → `CURRENT_TIMESTAMP`.
- **Critical concern**: The source shim (`src/shims/SqlRenderLite.R`) has a no-op `translate()` while the bundled package shim has rule-based translation. Task 2 must resolve this by either populating the source shim's `translate()` or verifying the build pipeline copies the bundled version's logic.

---

## Rewrite Rules (bullet list for verification)

- `SELECT TOP n … ;` → `SELECT … LIMIT n;` (row-limit rewrite, handles both bare and subquery form)
- `ISNULL(a, b)` → `COALESCE(a, b)` (null-coalescing)
- `GETDATE()` → `CURRENT_DATE` (current date, no time component)
- `SYSDATETIME()` → `CURRENT_TIMESTAMP` (current timestamp with time — gap in existing rules)
- `DATEDIFF(day|dd|d, a, b)` → `(CAST(b AS DATE) - CAST(a AS DATE))` (integer day difference)
- `DATEDIFF(year|yy|yyyy, a, b)` → `(EXTRACT(YEAR FROM CAST(b AS DATE)) - EXTRACT(YEAR FROM CAST(a AS DATE)))` (year difference)
- `DATEDIFF(month|mm|m, a, b)` → `(extract(year from age(…))*12+extract(month from age(…)))` (month difference via age())
- `DATEADD(day|dd|d, n, d)` → `(d + TO_DAYS(CAST(n AS INTEGER)))` (day addition)
- `DATEADD(month|mm|m, n, d)` → `(d + TO_MONTHS(CAST(n AS INTEGER)))` (month addition)
- `DATEADD(year|yy|yyyy, n, d)` → `(d + TO_YEARS(CAST(n AS INTEGER)))` (year addition)
- `LEN(x)` → `LENGTH(x)` (string length)
- `CONVERT(DATE, x)` → `CAST(x AS DATE)` (date conversion)
- `CONVERT(VARCHAR…, x)` → `CAST(x AS VARCHAR)` (string conversion)
- `CAST(x AS DATETIME)` / `CAST(x AS DATETIME2)` → `CAST(x AS TIMESTAMP)` (datetime type mapping)
- `WITH (NOLOCK)` → `` (strip MSSQL table hint — gap; not in existing duckdbRules.csv)
- `OPTION (…)` → `` (strip MSSQL query hint — gap; not in existing duckdbRules.csv)
- `IIF(cond, a, b)` → `CASE WHEN cond THEN a ELSE b END` (inline conditional)
- `CHOOSE(idx, v1, v2, …)` → manual CASE WHEN rewrite (no DuckDB equivalent)
- `[bracketed_identifier]` → `"bracketed_identifier"` (identifier quoting style)
- `TRY_CAST(x)` → `CAST(x)` (safe cast fallback)
- `COUNT_BIG(x)` → `COUNT(x)` (BigInt count synonym)
- `NEWID()` → `uuid()` (GUID generation)
