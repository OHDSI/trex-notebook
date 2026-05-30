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
  for (name in names(params)) {
    value <- as.character(params[[name]])
    sql <- gsub(paste0("@", name, "\\b"), value, sql, perl = TRUE)
  }
  sql
}

.processConditionals <- function(sql) {
  # Iteratively process conditionals from innermost to outermost
  maxIter <- 100
  for (i in seq_len(maxIter)) {
    # Match innermost conditional: {condition}?{then} or {condition}?{then}:{else}
    # The condition and blocks must not contain unmatched braces (innermost first)
    pattern <- "\\{([^{}]*)\\}\\s*\\?\\s*\\{([^{}]*)\\}(?:\\s*:\\s*\\{([^{}]*)\\})?"
    if (!grepl(pattern, sql, perl = TRUE)) break

    sql <- gsub(pattern, function(match) {
      parts <- regmatches(match, regexec(pattern, match, perl = TRUE))[[1]]
      condition <- trimws(parts[2])
      thenBlock <- parts[3]
      elseBlock <- if (length(parts) >= 4 && nchar(parts[4]) > 0) parts[4] else ""

      if (.evalCondition(condition)) thenBlock else elseBlock
    }, sql, perl = TRUE)
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

# --- translate() : SQL dialect translation ---
# For DuckDB, most SQL is standard. We handle a few common patterns.

SqlRender$translate <- function(sql, targetDialect = "duckdb", tempEmulationSchema = NULL) {
  # DuckDB uses standard SQL — no translation needed.
  sql
}

SqlRender$translateSql <- SqlRender$translate

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
