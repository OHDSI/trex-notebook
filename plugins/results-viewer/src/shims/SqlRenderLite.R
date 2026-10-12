# SqlRenderLite — pure-R replacement for SqlRender (no Java/rJava)
# Implements the SqlRender API surface used by OhdsiShinyModules and
# ResultModelManager. Handles @param substitution and {if}?{then}:{else}
# conditional blocks.

# Create a namespace environment to inject into
if (!exists("SqlRender", envir = .GlobalEnv)) {
  SqlRender <- new.env(parent = .GlobalEnv)
}

# --- render() : the core template engine ---

SqlRender$render <- function(sql, warnOnMissingParameters = TRUE, ...) {
  parameters <- list(...)
  # Collapse vector parameters to comma-separated strings
  parameters <- lapply(parameters, function(x) paste(x, collapse = ","))

  # Process {DEFAULT @param = value} blocks
  sql <- .processDefaults(sql, parameters)

  # Substitute @param values
  sql <- .substituteParams(sql, parameters)

  # Process {condition}?{then}:{else} conditionals
  sql <- .processConditionals(sql)

  return(sql)
}

SqlRender$renderSql <- SqlRender$render

.processDefaults <- function(sql, params) {
  pattern <- "\\{DEFAULT\\s+@(\\w+)\\s*=\\s*([^}]*)\\}"
  while (grepl(pattern, sql, perl = TRUE)) {
    m <- regmatches(sql, regexpr(pattern, sql, perl = TRUE))
    parts <- regmatches(m, regexec(pattern, m, perl = TRUE))[[1]]
    paramName <- parts[2]
    defaultVal <- trimws(parts[3])
    # Remove surrounding quotes from default value
    defaultVal <- gsub("^['\"]|['\"]$", "", defaultVal)
    # Only set default if param not already provided
    if (is.null(params[[paramName]]) || params[[paramName]] == "") {
      params[[paramName]] <<- defaultVal
    }
    sql <- sub(pattern, "", sql, perl = TRUE)
  }
  sql
}

.substituteParams <- function(sql, params) {
  # Iterate longest name first so `@c_table_prefix` wins over `@c` when both
  # exist. Match plain `@name` with NO trailing \b — HADES SQL embeds params
  # directly before identifiers (e.g. `@c_table_prefixcohort_details`), and
  # a word-boundary assertion would block substitution in exactly that case.
  nms <- names(params)
  nms <- nms[order(-nchar(nms))]
  for (name in nms) {
    value <- as.character(params[[name]])
    sql <- gsub(paste0("@", name), value, sql, perl = TRUE)
  }
  sql
}

.processConditionals <- function(sql) {
  # Iteratively replace innermost {cond}?{then}[:{else}] blocks one at a time.
  # Base R gsub() does NOT accept a function replacement; using one throws
  # "Error in as.character(replacement): cannot coerce type 'closure' ...",
  # which breaks module loading before any SQL runs. Instead, find each match
  # with regexec() and splice the result in via substr-slicing.
  pattern <- "\\{([^{}]*)\\}\\s*\\?\\s*\\{([^{}]*)\\}(?:\\s*:\\s*\\{([^{}]*)\\})?"
  maxIter <- 1000
  for (i in seq_len(maxIter)) {
    m <- regexec(pattern, sql, perl = TRUE)[[1]]
    if (m[1] == -1) break
    starts <- as.integer(m)
    lens <- attr(m, "match.length")
    whole_start <- starts[1]
    whole_end <- starts[1] + lens[1] - 1
    condition <- if (lens[2] > 0) substr(sql, starts[2], starts[2] + lens[2] - 1) else ""
    thenBlock <- if (lens[3] > 0) substr(sql, starts[3], starts[3] + lens[3] - 1) else ""
    elseBlock <- if (length(starts) >= 4 && !is.na(starts[4]) && starts[4] > 0 && lens[4] > 0) {
      substr(sql, starts[4], starts[4] + lens[4] - 1)
    } else ""
    replacement <- if (.evalCondition(trimws(condition))) thenBlock else elseBlock
    before <- if (whole_start > 1) substr(sql, 1, whole_start - 1) else ""
    after <- if (whole_end < nchar(sql)) substr(sql, whole_end + 1, nchar(sql)) else ""
    sql <- paste0(before, replacement, after)
  }
  sql
}

.evalCondition <- function(cond) {
  cond <- trimws(cond)
  if (nchar(cond) == 0) return(FALSE)

  # Handle AND (&) — split and require all true
  if (grepl("\\s+&\\s+", cond)) {
    parts <- strsplit(cond, "\\s+&\\s+")[[1]]
    return(all(vapply(parts, .evalCondition, logical(1))))
  }

  # Handle OR (|) — split and require any true
  if (grepl("\\s+\\|\\s+", cond)) {
    parts <- strsplit(cond, "\\s+\\|\\s+")[[1]]
    return(any(vapply(parts, .evalCondition, logical(1))))
  }

  # Handle IN: value IN (list)
  if (grepl("\\bIN\\b\\s*\\(", cond, ignore.case = TRUE)) {
    m <- regmatches(cond, regexec("(.+?)\\s+IN\\s*\\(([^)]*)\\)", cond, ignore.case = TRUE))[[1]]
    if (length(m) >= 3) {
      val <- trimws(gsub("^['\"]|['\"]$", "", trimws(m[2])))
      items <- trimws(strsplit(m[3], ",")[[1]])
      items <- gsub("^['\"]|['\"]$", "", items)
      return(val %in% items)
    }
  }

  # Handle != comparison
  if (grepl("!=", cond)) {
    parts <- strsplit(cond, "\\s*!=\\s*")[[1]]
    lhs <- trimws(gsub("^['\"]|['\"]$", "", trimws(parts[1])))
    rhs <- trimws(gsub("^['\"]|['\"]$", "", trimws(parts[2])))
    return(lhs != rhs)
  }

  # Handle == comparison
  if (grepl("==", cond)) {
    parts <- strsplit(cond, "\\s*==\\s*")[[1]]
    lhs <- trimws(gsub("^['\"]|['\"]$", "", trimws(parts[1])))
    rhs <- trimws(gsub("^['\"]|['\"]$", "", trimws(parts[2])))
    return(lhs == rhs)
  }

  # Bare value: truthy if not empty string
  val <- trimws(gsub("^['\"]|['\"]$", "", cond))
  return(nchar(val) > 0 && val != "0" && tolower(val) != "false")
}

# --- translate() : SQL dialect translation (MSSQL -> DuckDB/SQLite) ---
# OHDSI packages ship SQL in SQL Server dialect and rely on SqlRender to
# translate it to the target DB. The real SqlRender needs Java (rJava); we
# can't ship that to WebR, so we re-implement the subset of translations the
# OhdsiShinyModules Characterization/Cohort/Estimation modules actually use.
#
# Design rules:
#   - Idempotent: translating twice yields the same string.
#   - Quote-aware: never rewrite inside '…' string literals.
#   - Dialect-gated: only rewrite for duckdb/sqlite; otherwise passthrough.
#   - Case-insensitive matching of SQL keywords; preserve the surrounding
#     whitespace of the original.

SqlRender$translate <- function(sql, targetDialect = "duckdb", tempEmulationSchema = NULL) {
  if (!is.character(sql) || length(sql) == 0) return(sql)
  if (!tolower(targetDialect) %in% c("duckdb", "sqlite")) return(sql)

  # 1. Mask single-quoted string literals so rewrites don't touch their contents.
  masks <- list()
  mask_pattern <- "'(?:[^']|'')*'"
  masked <- gsub(mask_pattern, perl = TRUE, replacement = "__STRLIT_PLACEHOLDER__",
                 x = (function() {
                   # Collect matches in order for later restore.
                   m <- gregexpr(mask_pattern, sql, perl = TRUE)[[1]]
                   if (!(length(m) == 1 && m[1] == -1)) {
                     starts <- as.integer(m)
                     lens <- attr(m, "match.length")
                     for (i in seq_along(starts)) {
                       masks[[length(masks) + 1]] <<- substr(sql, starts[i], starts[i] + lens[i] - 1)
                     }
                   }
                   sql
                 })())

  # 2. SELECT TOP n  ->  append LIMIT n at end of statement.
  #    Match "SELECT [DISTINCT] TOP n" at statement start (case-insensitive);
  #    strip "TOP n" and remember n to append as LIMIT.
  top_pat <- "(?i)\\bSELECT(\\s+DISTINCT)?\\s+TOP\\s+(\\d+)\\b"
  top_match <- regmatches(masked, regexec(top_pat, masked, perl = TRUE))[[1]]
  if (length(top_match) >= 3 && nzchar(top_match[1])) {
    n_rows <- top_match[3]
    distinct <- if (nzchar(top_match[2])) " DISTINCT" else ""
    masked <- sub(top_pat, paste0("SELECT", distinct), masked, perl = TRUE)
    # Append LIMIT before trailing ';' / whitespace, unless one already exists.
    if (!grepl("(?i)\\bLIMIT\\s+\\d+\\b", masked, perl = TRUE)) {
      masked <- sub("(;\\s*)?$", paste0(" LIMIT ", n_rows, "\\1"), masked, perl = TRUE)
    }
  }

  # 3. ISNULL(a, b) -> COALESCE(a, b)
  masked <- gsub("(?i)\\bISNULL\\s*\\(", "COALESCE(", masked, perl = TRUE)

  # 4. GETDATE() / SYSDATETIME() -> CURRENT_TIMESTAMP
  masked <- gsub("(?i)\\b(GETDATE|SYSDATETIME)\\s*\\(\\s*\\)", "CURRENT_TIMESTAMP", masked, perl = TRUE)

  # 5. LEN(x) -> LENGTH(x)
  masked <- gsub("(?i)\\bLEN\\s*\\(", "LENGTH(", masked, perl = TRUE)

  # 6. IIF(cond, a, b) -> CASE WHEN cond THEN a ELSE b END
  masked <- .translateIIF(masked)

  # 6a. TRY_CAST(...) -> CAST(...) (MSSQL idiom; DuckDB uses plain CAST)
  masked <- gsub("(?i)\\bTRY_CAST\\s*\\(", "CAST(", masked, perl = TRUE)

  # 7. DATEDIFF(unit, a, b) -> date_diff('unit', a, b)
  masked <- .translateDateDiff(masked)

  # 8. DATEADD(unit, n, d) -> (d + INTERVAL (n) UNIT)
  masked <- .translateDateAdd(masked)

  # 9. CONVERT(type, x) / CONVERT(VARCHAR(n), x) -> CAST(x AS type)
  masked <- .translateConvert(masked)

  # 10. CAST(x AS DATETIME) / DATETIME2 -> CAST(x AS TIMESTAMP)
  #     Uses balanced-paren parsing so nested calls like CAST(fn(a,b) AS DATETIME) work.
  masked <- .translateCastDatetime(masked)

  # 11. Strip WITH (NOLOCK)
  masked <- gsub("(?i)\\s+WITH\\s*\\(\\s*NOLOCK\\s*\\)", "", masked, perl = TRUE)

  # 12. Strip trailing OPTION (...) hint clause.
  masked <- gsub("(?i)\\s+OPTION\\s*\\([^)]*\\)\\s*(?=;|$)", "", masked, perl = TRUE)

  # 13. [bracketed_identifier] -> "bracketed_identifier"
  masked <- gsub("\\[([A-Za-z_][A-Za-z0-9_]*)\\]", '"\\1"', masked, perl = TRUE)

  # 14. Restore masked string literals in order.
  if (length(masks) > 0) {
    out <- masked
    for (lit in masks) {
      out <- sub("__STRLIT_PLACEHOLDER__", lit, out, fixed = TRUE)
    }
    masked <- out
  }

  masked
}

SqlRender$translateSql <- SqlRender$translate

# --- helpers for translate() ---

.translateIIF <- function(sql) {
  # IIF(cond, a, b)  ->  CASE WHEN cond THEN a ELSE b END
  pattern <- "(?i)\\bIIF\\s*\\("
  while (grepl(pattern, sql, perl = TRUE)) {
    start <- regexpr(pattern, sql, perl = TRUE)
    if (start[1] == -1) break
    open <- start[1] + attr(start, "match.length") - 1  # position of '('
    args <- .splitBalancedArgs(sql, open)
    if (is.null(args) || length(args$parts) != 3) break
    repl <- sprintf("CASE WHEN %s THEN %s ELSE %s END",
                    trimws(args$parts[1]), trimws(args$parts[2]), trimws(args$parts[3]))
    sql <- paste0(substr(sql, 1, start[1] - 1), repl, substr(sql, args$closeAt + 1, nchar(sql)))
  }
  sql
}

.translateDateDiff <- function(sql) {
  # DATEDIFF(unit, a, b)  ->  date_diff('unit', a, b)
  unit_map <- c(day = "day", dd = "day", d = "day",
                month = "month", mm = "month", m = "month",
                year = "year", yy = "year", yyyy = "year",
                second = "second", ss = "second", s = "second",
                hour = "hour", hh = "hour",
                minute = "minute", mi = "minute", n = "minute",
                week = "week", wk = "week", ww = "week")
  pattern <- "(?i)\\bDATEDIFF\\s*\\("
  while (grepl(pattern, sql, perl = TRUE)) {
    start <- regexpr(pattern, sql, perl = TRUE)
    if (start[1] == -1) break
    open <- start[1] + attr(start, "match.length") - 1
    args <- .splitBalancedArgs(sql, open)
    if (is.null(args) || length(args$parts) != 3) break
    unit <- tolower(trimws(args$parts[1]))
    canon <- unit_map[[unit]]
    if (is.null(canon)) canon <- unit
    repl <- sprintf("date_diff('%s', %s, %s)", canon,
                    trimws(args$parts[2]), trimws(args$parts[3]))
    sql <- paste0(substr(sql, 1, start[1] - 1), repl, substr(sql, args$closeAt + 1, nchar(sql)))
  }
  sql
}

.translateDateAdd <- function(sql) {
  # DATEADD(unit, n, d)  ->  (d + INTERVAL (n) UNIT)
  unit_map <- c(day = "DAY", dd = "DAY", d = "DAY",
                month = "MONTH", mm = "MONTH", m = "MONTH",
                year = "YEAR", yy = "YEAR", yyyy = "YEAR",
                second = "SECOND", ss = "SECOND", s = "SECOND",
                hour = "HOUR", hh = "HOUR",
                minute = "MINUTE", mi = "MINUTE", n = "MINUTE",
                week = "WEEK", wk = "WEEK", ww = "WEEK")
  pattern <- "(?i)\\bDATEADD\\s*\\("
  while (grepl(pattern, sql, perl = TRUE)) {
    start <- regexpr(pattern, sql, perl = TRUE)
    if (start[1] == -1) break
    open <- start[1] + attr(start, "match.length") - 1
    args <- .splitBalancedArgs(sql, open)
    if (is.null(args) || length(args$parts) != 3) break
    unit <- tolower(trimws(args$parts[1]))
    canon <- unit_map[[unit]]
    if (is.null(canon)) canon <- toupper(unit)
    repl <- sprintf("(%s + INTERVAL (%s) %s)",
                    trimws(args$parts[3]), trimws(args$parts[2]), canon)
    sql <- paste0(substr(sql, 1, start[1] - 1), repl, substr(sql, args$closeAt + 1, nchar(sql)))
  }
  sql
}

.translateConvert <- function(sql) {
  # CONVERT(type, x)  ->  CAST(x AS type)
  # CONVERT(VARCHAR(n), x)  ->  CAST(x AS VARCHAR)   (DuckDB VARCHAR is unsized)
  pattern <- "(?i)\\bCONVERT\\s*\\("
  while (grepl(pattern, sql, perl = TRUE)) {
    start <- regexpr(pattern, sql, perl = TRUE)
    if (start[1] == -1) break
    open <- start[1] + attr(start, "match.length") - 1
    args <- .splitBalancedArgs(sql, open)
    if (is.null(args) || length(args$parts) < 2) break
    raw_type <- trimws(args$parts[1])
    type <- sub("(?i)^(VARCHAR|NVARCHAR|CHAR|NCHAR)\\s*\\(\\s*\\d+\\s*\\)$", "\\1",
                raw_type, perl = TRUE)
    type <- sub("(?i)^DATETIME2?(\\s*\\(\\s*\\d+\\s*\\))?$", "TIMESTAMP", type, perl = TRUE)
    expr <- trimws(args$parts[2])
    repl <- sprintf("CAST(%s AS %s)", expr, type)
    sql <- paste0(substr(sql, 1, start[1] - 1), repl, substr(sql, args$closeAt + 1, nchar(sql)))
  }
  sql
}

.translateCastDatetime <- function(sql) {
  # CAST(<expr> AS DATETIME) / CAST(<expr> AS DATETIME2[(p)])
  #   ->  CAST(<expr> AS TIMESTAMP)
  # Uses balanced-paren parsing so nested calls like CAST(fn(a,b) AS DATETIME) work.
  pattern <- "(?i)\\bCAST\\s*\\("
  while (grepl(pattern, sql, perl = TRUE)) {
    start <- regexpr(pattern, sql, perl = TRUE)
    if (start[1] == -1) break
    open <- start[1] + attr(start, "match.length") - 1
    args <- .splitBalancedArgs(sql, open)
    if (is.null(args) || length(args$parts) != 1) break
    inner <- args$parts[1]
    # Check if the single arg matches "<expr> AS DATETIME2?[(p)]"
    dt_pat <- "^(.+)\\s+AS\\s+DATETIME2?(\\s*\\(\\s*\\d+\\s*\\))?$"
    m <- regmatches(inner, regexec(dt_pat, inner, ignore.case = TRUE))[[1]]
    if (length(m) == 0) {
      # Not a DATETIME cast — skip past this CAST to avoid infinite loop
      # We advance by replacing the found occurrence with a sentinel that won't match again.
      # Strategy: rebuild with a placeholder, continue from after closeAt.
      prefix <- substr(sql, 1, start[1] - 1)
      suffix <- substr(sql, args$closeAt + 1, nchar(sql))
      # Reconstruct verbatim — inner stays unchanged; we tag the open paren.
      sql <- paste0(prefix, "__CAST_SKIP__(", inner, ")", suffix)
      next
    }
    expr <- trimws(m[2])
    repl <- sprintf("CAST(%s AS TIMESTAMP)", expr)
    sql <- paste0(substr(sql, 1, start[1] - 1), repl, substr(sql, args$closeAt + 1, nchar(sql)))
  }
  # Restore any skip sentinels
  sql <- gsub("__CAST_SKIP__", "CAST", sql, fixed = TRUE)
  sql
}

.splitBalancedArgs <- function(sql, openIdx) {
  # Starting at openIdx (position of '('), return list(parts = c(arg1, arg2, ...),
  # closeAt = index of matching ')'). NULL if unbalanced.
  depth <- 0
  parts <- character(0)
  current <- ""
  n <- nchar(sql)
  i <- openIdx
  inSingle <- FALSE
  while (i <= n) {
    ch <- substr(sql, i, i)
    if (ch == "'" ) {
      inSingle <- !inSingle
      if (depth >= 1) current <- paste0(current, ch)
    } else if (!inSingle && ch == "(") {
      depth <- depth + 1
      if (depth > 1) current <- paste0(current, ch)
    } else if (!inSingle && ch == ")") {
      depth <- depth - 1
      if (depth == 0) {
        parts <- c(parts, current)
        return(list(parts = parts, closeAt = i))
      }
      current <- paste0(current, ch)
    } else if (!inSingle && ch == "," && depth == 1) {
      parts <- c(parts, current)
      current <- ""
    } else {
      current <- paste0(current, ch)
    }
    i <- i + 1
  }
  NULL
}

# --- splitSql() : split SQL on semicolons ---

SqlRender$splitSql <- function(sql) {
  # Simple split respecting quoted strings
  statements <- character(0)
  current <- ""
  inSingle <- FALSE
  inDouble <- FALSE
  chars <- strsplit(sql, "")[[1]]

  for (ch in chars) {
    if (ch == "'" && !inDouble) {
      inSingle <- !inSingle
    } else if (ch == '"' && !inSingle) {
      inDouble <- !inDouble
    } else if (ch == ";" && !inSingle && !inDouble) {
      stmt <- trimws(current)
      if (nchar(stmt) > 0) statements <- c(statements, stmt)
      current <- ""
      next
    }
    current <- paste0(current, ch)
  }
  stmt <- trimws(current)
  if (nchar(stmt) > 0) statements <- c(statements, stmt)

  statements
}

# --- Pure-R helper functions (copied from SqlRender) ---

SqlRender$snakeCaseToCamelCase <- function(string) {
  string <- tolower(string)
  for (letter in letters) {
    string <- gsub(paste("_", letter, sep = ""), toupper(letter), string)
  }
  string <- gsub("_([0-9])", "\\1", string)
  return(string)
}

SqlRender$camelCaseToSnakeCase <- function(string) {
  string <- gsub("([A-Z])", "_\\1", string)
  string <- tolower(string)
  string <- gsub("([a-z])([0-9])", "\\1_\\2", string)
  return(string)
}

SqlRender$camelCaseToTitleCase <- function(string) {
  string <- gsub("([A-Z])", " \\1", string)
  string <- gsub("([a-z])([0-9])", "\\1 \\2", string)
  substr(string, 1, 1) <- toupper(substr(string, 1, 1))
  return(string)
}

SqlRender$snakeCaseToCamelCaseNames <- function(object) {
  names(object) <- SqlRender$snakeCaseToCamelCase(names(object))
  return(object)
}

SqlRender$readSql <- function(sourceFile) {
  return(readChar(sourceFile, file.info(sourceFile)$size))
}

SqlRender$writeSql <- function(sql, targetFile) {
  sink(targetFile)
  cat(sql)
  sink()
}

SqlRender$loadRenderTranslateSql <- function(sqlFilename, packageName = NULL, dbms = "duckdb", ...) {
  if (!is.null(packageName)) {
    sqlFilePath <- system.file("sql", "sql_server", sqlFilename, package = packageName)
    if (sqlFilePath == "") {
      sqlFilePath <- system.file("sql", sqlFilename, package = packageName)
    }
  } else {
    sqlFilePath <- sqlFilename
  }
  sql <- SqlRender$readSql(sqlFilePath)
  sql <- SqlRender$render(sql, ...)
  sql <- SqlRender$translate(sql, targetDialect = dbms)
  return(sql)
}

SqlRender$getTempTablePrefix <- function() {
  return("")
}

# Register as a proper namespace-like environment
environment(SqlRender$render) <- SqlRender
environment(SqlRender$translate) <- SqlRender
environment(SqlRender$splitSql) <- SqlRender
environment(SqlRender$snakeCaseToCamelCase) <- SqlRender
environment(SqlRender$camelCaseToSnakeCase) <- SqlRender
environment(SqlRender$camelCaseToTitleCase) <- SqlRender

# Make functions accessible via SqlRender:: syntax
# In WebR, we use assignInNamespace if the package is loaded,
# otherwise we create a package-like environment
tryCatch({
  if ("SqlRender" %in% loadedNamespaces()) {
    for (fn_name in ls(SqlRender)) {
      assignInNamespace(fn_name, get(fn_name, envir = SqlRender), ns = "SqlRender")
    }
    message("SqlRenderLite: patched existing SqlRender namespace")
  }
}, error = function(e) {
  message("SqlRenderLite: loaded as standalone (SqlRender package not present)")
})

message("SqlRenderLite loaded successfully")
