# SqlRenderLite — pure-R replacement for SqlRender (no Java/rJava)
# Implements the SqlRender API surface used by OhdsiShinyModules and
# ResultModelManager. Handles @param substitution and {if}?{then}:{else}
# conditional blocks.

# --- render() : the core template engine ---

render <- function(sql, warnOnMissingParameters = TRUE, ...) {
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

renderSql <- function(sql, warnOnMissingParameters = TRUE, ...) {
  render(sql, warnOnMissingParameters = warnOnMissingParameters, ...)
}

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
  # Sort param names by length descending so longer names match first.
  # Real SqlRender doesn't use word boundaries — it does direct text replacement.
  # This matters for cases like @cd_table_prefix in @cd_table_prefixcohort:
  # substituting "" for @cd_table_prefix yields "cohort".
  names_sorted <- names(params)[order(nchar(names(params)), decreasing = TRUE)]
  for (name in names_sorted) {
    value <- as.character(params[[name]])
    sql <- gsub(paste0("@", name), value, sql, fixed = TRUE)
  }
  sql
}

.processConditionals <- function(sql) {
  # Iteratively process conditionals from innermost to outermost.
  # R's gsub does NOT accept a function as replacement, so we find each
  # match, compute its replacement, and substitute it manually.
  maxIter <- 100
  pattern <- "\\{([^{}]*)\\}\\s*\\?\\s*\\{([^{}]*)\\}(?:\\s*:\\s*\\{([^{}]*)\\})?"
  for (i in seq_len(maxIter)) {
    m <- regexec(pattern, sql, perl = TRUE)
    parts <- regmatches(sql, m)[[1]]
    if (length(parts) < 3) break

    condition <- trimws(parts[2])
    thenBlock <- parts[3]
    elseBlock <- if (length(parts) >= 4 && !is.na(parts[4]) && nchar(parts[4]) > 0) parts[4] else ""
    new_text <- if (.evalCondition(condition)) thenBlock else elseBlock

    # Replace only the first occurrence (the matched one)
    match_text <- parts[1]
    sql <- sub(match_text, new_text, sql, fixed = TRUE)
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

# Load the replacement patterns CSV once and cache it.
.replacement_patterns_cache <- new.env(parent = emptyenv())

.loadReplacementPatterns <- function(dialect = "duckdb") {
  cache_key <- paste0("p_", dialect)
  if (!is.null(.replacement_patterns_cache[[cache_key]])) {
    return(.replacement_patterns_cache[[cache_key]])
  }
  # Prefer dialect-specific CSV (extracted from full file to avoid parse issues)
  csv_path <- system.file("csv", paste0(dialect, "Rules.csv"), package = "SqlRender")
  if (csv_path == "" || !file.exists(csv_path)) return(NULL)
  patterns <- utils::read.csv(csv_path, stringsAsFactors = FALSE)
  patterns$To <- dialect
  .replacement_patterns_cache[[cache_key]] <- patterns
  patterns
}

# Convert SqlRender's @param pattern syntax to a Java-like regex.
# @a, @b, @c... are wildcards matching balanced parenthesized expressions or
# simple tokens. SqlRender uses a parser, but for common cases a regex approach
# with non-greedy matching works for most rules used by OhdsiShinyModules.
.patternToRegex <- function(pat) {
  # Escape regex special chars EXCEPT @ and pattern-relevant ones
  out <- pat
  # Escape regex special chars: . | * + ? ^ $ ( ) [ ] { } \\
  out <- gsub("([.|*+?^$()\\[\\]{}\\\\])", "\\\\\\1", out, perl = TRUE)
  # Now convert @<identifier> placeholders (the dot-class survived escaping
  # but @<word> is what we need): @a, @b, @table, etc.
  # Match @ followed by identifier - capture as named-ish group
  # Use lazy match for the placeholder value
  out <- gsub("@([a-zA-Z][a-zA-Z0-9_]*)", "(.+?)", out, perl = TRUE)
  # Whitespace in pattern matches any whitespace
  out <- gsub("\\\\\\s+", "\\\\s+", out, perl = TRUE)
  out <- gsub("\\s+", "\\\\s*", out, perl = TRUE)
  out
}

# Convert replacement string: @a, @b -> \1, \2 in order of appearance in pattern
.replacementToBackref <- function(pat, repl) {
  # Find placeholders in pattern in order
  matches <- regmatches(pat, gregexpr("@([a-zA-Z][a-zA-Z0-9_]*)", pat))[[1]]
  if (length(matches) == 0) return(repl)
  out <- repl
  # First pass: replace each @name with a placeholder token (avoids
  # interference if a replacement contains @ chars).
  for (i in seq_along(matches)) {
    name <- matches[i]
    out <- gsub(name, paste0("REF", i, ""), out, fixed = TRUE)
  }
  # Second pass: convert placeholder to backref. The replacement string is
  # then used in gsub(perl=TRUE), where \1 is a proper backreference.
  for (i in seq_along(matches)) {
    out <- gsub(paste0("REF", i, ""), paste0("\\", i), out, fixed = TRUE)
  }
  out
}

translate <- function(sql, targetDialect = "duckdb", tempEmulationSchema = NULL) {
  if (is.null(sql) || nchar(sql) == 0) return(sql)
  rules <- .loadReplacementPatterns(targetDialect)
  if (is.null(rules)) {
    # Fallback minimal translation if CSV not available
    sql <- gsub("\\bISNULL\\s*\\(", "COALESCE(", sql, perl = TRUE, ignore.case = TRUE)
    sql <- gsub("\\bGETDATE\\s*\\(\\s*\\)", "CURRENT_TIMESTAMP", sql, perl = TRUE, ignore.case = TRUE)
    return(sql)
  }

  for (i in seq_len(nrow(rules))) {
    pat <- rules$Pattern[i]
    repl <- rules$Replacement[i]
    tryCatch({
      regex <- .patternToRegex(pat)
      replacement <- .replacementToBackref(pat, repl)
      sql <- gsub(regex, replacement, sql, perl = TRUE, ignore.case = TRUE)
    }, error = function(e) NULL)  # Skip rules that fail to compile
  }
  sql
}

translateSql <- function(sql, targetDialect = "duckdb", tempEmulationSchema = NULL) {
  translate(sql, targetDialect = targetDialect, tempEmulationSchema = tempEmulationSchema)
}

# --- splitSql() : split SQL on semicolons ---

splitSql <- function(sql) {
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

snakeCaseToCamelCase <- function(string) {
  string <- tolower(string)
  for (letter in letters) {
    string <- gsub(paste("_", letter, sep = ""), toupper(letter), string)
  }
  string <- gsub("_([0-9])", "\\1", string)
  return(string)
}

camelCaseToSnakeCase <- function(string) {
  string <- gsub("([A-Z])", "_\\1", string)
  string <- tolower(string)
  string <- gsub("([a-z])([0-9])", "\\1_\\2", string)
  return(string)
}

camelCaseToTitleCase <- function(string) {
  string <- gsub("([A-Z])", " \\1", string)
  string <- gsub("([a-z])([0-9])", "\\1 \\2", string)
  substr(string, 1, 1) <- toupper(substr(string, 1, 1))
  return(string)
}

snakeCaseToCamelCaseNames <- function(object) {
  names(object) <- snakeCaseToCamelCase(names(object))
  return(object)
}

readSql <- function(sourceFile) {
  return(readChar(sourceFile, file.info(sourceFile)$size))
}

writeSql <- function(sql, targetFile) {
  sink(targetFile)
  cat(sql)
  sink()
}

loadRenderTranslateSql <- function(sqlFilename, packageName = NULL, dbms = "duckdb", ...) {
  if (!is.null(packageName)) {
    sqlFilePath <- system.file("sql", "sql_server", sqlFilename, package = packageName)
    if (sqlFilePath == "") {
      sqlFilePath <- system.file("sql", sqlFilename, package = packageName)
    }
  } else {
    sqlFilePath <- sqlFilename
  }
  sql <- readSql(sqlFilePath)
  sql <- render(sql, ...)
  sql <- translate(sql, targetDialect = dbms)
  return(sql)
}

getTempTablePrefix <- function() {
  return("")
}
