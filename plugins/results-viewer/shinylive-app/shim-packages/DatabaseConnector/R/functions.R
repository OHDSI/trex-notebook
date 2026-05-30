# DatabaseConnectorLite — pure-R replacement for DatabaseConnector (no Java/JDBC)
# Routes all database operations through DBI + DuckDB.

# ----------------------------------------------------------------------------
# Connection details + shared connection
# ----------------------------------------------------------------------------

createConnectionDetails <- function(dbms = "duckdb",
                                    user = NULL,
                                    password = NULL,
                                    server = ":memory:",
                                    port = NULL,
                                    extraSettings = NULL,
                                    oracleDriver = "thin",
                                    connectionString = NULL,
                                    pathToDriver = "",
                                    ...) {
  details <- list(
    dbms = dbms,
    extraSettings = extraSettings,
    oracleDriver = oracleDriver,
    pathToDriver = pathToDriver,
    user = (function(v) function() v)(user),
    password = (function(v) function() v)(password),
    server = (function(v) function() v)(server),
    port = (function(v) function() v)(port),
    connectionString = (function(v) function() v)(connectionString)
  )
  class(details) <- "ConnectionDetails"
  details
}

connect <- function(connectionDetails = NULL, ...) {
  # IMPORTANT: WebR's DuckDB build does NOT share in-memory tables across
  # connections to the same driver (unlike native DuckDB). So we ALWAYS
  # return the same shared `.results_con` connection — the only one that
  # actually holds the loaded data. disconnect() below is a no-op for it.
  shared <- tryCatch(get(".results_con", envir = globalenv()),
                      error = function(e) NULL)
  if (!is.null(shared) && tryCatch(DBI::dbIsValid(shared),
                                       error = function(e) FALSE)) {
    attr(shared, "dbms") <- "duckdb"
    return(shared)
  }
  # No shared connection yet (or it died) — create one from scratch and
  # cache it so subsequent connect() calls reuse it.
  drv <- tryCatch(get(".duckdb_driver_results", envir = globalenv()),
                   error = function(e) NULL)
  if (is.null(drv) || !tryCatch(DBI::dbIsValid(drv),
                                  error = function(e) FALSE)) {
    drv <- duckdb::duckdb(dbdir = ":memory:")
    assign(".duckdb_driver_results", drv, envir = globalenv())
  }
  connection <- DBI::dbConnect(drv)
  attr(connection, "dbms") <- "duckdb"
  assign(".results_con", connection, envir = globalenv())
  connection
}

disconnect <- function(connection) {
  # We always hand out the same shared connection from connect(). Closing it
  # would lose all the in-memory tables, since WebR's DuckDB does not share
  # data across connections. So disconnect() is essentially a no-op.
  invisible(NULL)
}

dbms <- function(connection) {
  if (is.null(connection)) return("duckdb")
  d <- attr(connection, "dbms")
  if (is.null(d)) "duckdb" else d
}

dbIsValid <- function(dbObj, ...) {
  tryCatch(DBI::dbIsValid(dbObj), error = function(e) FALSE)
}

DatabaseConnectorDriver <- function() {
  duckdb::duckdb()
}

# ----------------------------------------------------------------------------
# Table introspection
# ----------------------------------------------------------------------------

getTableNames <- function(connection, databaseSchema = NULL, cast = "lower") {
  if (is.null(connection) || !DBI::dbIsValid(connection)) {
    return(character(0))
  }
  tables <- tryCatch({
    if (is.null(databaseSchema) || databaseSchema == "" ||
        tolower(databaseSchema) == "main") {
      DBI::dbListTables(connection)
    } else {
      DBI::dbGetQuery(connection,
        sprintf("SELECT table_name FROM information_schema.tables WHERE lower(table_schema) = lower('%s')",
                databaseSchema))[["table_name"]]
    }
  }, error = function(e) DBI::dbListTables(connection))

  if (is.null(tables)) tables <- character(0)
  if (length(tables) == 0) return(character(0))

  switch(cast,
    "lower" = tolower(tables),
    "upper" = toupper(tables),
    tables
  )
}

existsTable <- function(connection, tableName, databaseSchema = NULL) {
  tableName <- tolower(tableName)
  tolower(tableName) %in% tolower(getTableNames(connection, databaseSchema, cast = "lower"))
}

# ----------------------------------------------------------------------------
# Query / execute
# ----------------------------------------------------------------------------

.extractSelectedColumns <- function(sql) {
  if (length(sql) == 0 || is.na(sql) || nchar(sql) == 0) return(character(0))
  m <- regmatches(sql, regexec("(?is)SELECT\\s+(.*?)\\s+FROM\\s", sql, perl = TRUE))[[1]]
  if (length(m) < 2) return(character(0))
  cols_raw <- m[2]
  if (is.na(cols_raw) || nchar(cols_raw) == 0) return(character(0))

  depth <- 0
  parts <- character(0)
  buf <- ""
  chars <- strsplit(cols_raw, "")[[1]]
  for (ch in chars) {
    if (ch == "(") depth <- depth + 1
    else if (ch == ")") depth <- depth - 1
    if (ch == "," && depth == 0) {
      parts <- c(parts, buf); buf <- ""
    } else {
      buf <- paste0(buf, ch)
    }
  }
  parts <- c(parts, buf)

  out <- character(0)
  for (p in parts) {
    p <- trimws(p)
    if (nchar(p) == 0) next
    name <- tryCatch({
      if (grepl("(?i)\\s+as\\s+", p, perl = TRUE)) {
        bits <- strsplit(p, "(?i)\\s+as\\s+", perl = TRUE)[[1]]
        cand <- if (length(bits) > 0) tail(bits, 1) else ""
        gsub("[^a-zA-Z0-9_]", "", cand)
      } else {
        # Split on literal "." to strip table alias prefix (e.g. cg.foo -> foo).
        # Note fixed=TRUE means the FIRST arg is taken literally — so we pass
        # a plain "." here, not "\\.".
        tokens <- strsplit(p, ".", fixed = TRUE)[[1]]
        cand <- if (length(tokens) > 0) tail(tokens, 1) else ""
        gsub("[^a-zA-Z0-9_]", "", cand)
      }
    }, error = function(e) "")
    if (length(name) == 1 && !is.na(name) && nchar(name) > 0) {
      out <- c(out, name)
    }
  }
  out
}

querySql <- function(connection, sql,
                     snakeCaseToCamelCase = FALSE,
                     ...) {
  sql <- gsub(";\\s*$", "", sql)
  result <- tryCatch(
    DBI::dbGetQuery(connection, sql),
    error = function(e) {
      msg <- conditionMessage(e)
      if (grepl("does not exist|no such table|Table with name|Catalog Error|Binder Error",
                msg, ignore.case = TRUE)) {
        cols <- tryCatch(.extractSelectedColumns(sql),
                          error = function(e2) character())
        cols <- cols[nzchar(cols)]
        if (length(cols) > 0) {
          df <- as.data.frame(matrix(character(), nrow = 0, ncol = length(cols)),
                                stringsAsFactors = FALSE)
          colnames(df) <- cols
          return(df)
        }
        return(data.frame())
      }
      stop(e)
    }
  )
  if (snakeCaseToCamelCase && ncol(result) > 0) {
    colnames(result) <- SqlRender::snakeCaseToCamelCase(colnames(result))
  }
  result
}

executeSql <- function(connection, sql, ...) {
  statements <- tryCatch(SqlRender::splitSql(sql), error = function(e) sql)
  for (stmt in statements) {
    tryCatch(DBI::dbExecute(connection, stmt), error = function(e) NULL)
  }
  invisible(NULL)
}

dbExecute <- function(conn, statement, ...) {
  tryCatch(DBI::dbExecute(conn, statement), error = function(e) 0L)
}

renderTranslateExecuteSql <- function(connection, sql, ...) {
  sql <- SqlRender::render(sql, ...)
  sql <- SqlRender::translate(sql, targetDialect = dbms(connection))
  executeSql(connection, sql)
}

renderTranslateQuerySql <- function(connection, sql,
                                    snakeCaseToCamelCase = FALSE,
                                    ...) {
  sql <- SqlRender::render(sql, ...)
  sql <- SqlRender::translate(sql, targetDialect = dbms(connection))
  querySql(connection, sql, snakeCaseToCamelCase = snakeCaseToCamelCase)
}

renderTranslateQueryApplyBatched <- function(connection, sql, fun,
                                              args = list(),
                                              snakeCaseToCamelCase = FALSE,
                                              batchSize = 1000L,
                                              ...) {
  # Just run the whole query at once and apply fun once.
  data <- renderTranslateQuerySql(connection, sql,
                                    snakeCaseToCamelCase = snakeCaseToCamelCase, ...)
  if (nrow(data) == 0) return(list())
  list(do.call(fun, c(list(data), args)))
}

# ----------------------------------------------------------------------------
# Misc helpers used by HADES
# ----------------------------------------------------------------------------

insertTable <- function(connection, tableName, data,
                         databaseSchema = NULL,
                         dropTableIfExists = TRUE,
                         createTable = TRUE,
                         tempTable = FALSE,
                         ...) {
  if (dropTableIfExists && tableName %in% DBI::dbListTables(connection)) {
    tryCatch(DBI::dbRemoveTable(connection, tableName), error = function(e) NULL)
  }
  DBI::dbWriteTable(connection, tableName, data,
                     append = !createTable, overwrite = createTable)
  invisible(NULL)
}

assertTempEmulationSchemaSet <- function(...) invisible(NULL)

createZipFile <- function(zipFile, files, ...) {
  tryCatch(utils::zip(zipFile, files), error = function(e) NULL)
}

downloadJdbcDrivers <- function(...) invisible(NULL)

# Some HADES code calls DatabaseConnector::dbms(conn) AND conn@dbms - support both
setOldClass("DatabaseConnectorConnection")
