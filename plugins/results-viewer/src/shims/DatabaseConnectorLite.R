# DatabaseConnectorLite — pure-R replacement for DatabaseConnector (no Java/JDBC)
# Routes all database operations through DBI + DuckDB.
# Only implements the API surface used by OhdsiShinyModules and ResultModelManager.

if (!exists("DatabaseConnector", envir = .GlobalEnv)) {
  DatabaseConnector <- new.env(parent = .GlobalEnv)
}

DatabaseConnector$createConnectionDetails <- function(dbms = "duckdb",
                                                       server = ":memory:",
                                                       ...) {
  details <- list(dbms = dbms, server = server)
  details <- c(details, list(...))
  class(details) <- "ConnectionDetails"
  details$server <- (function(s) function() s)(server)
  details$dbms <- dbms
  return(details)
}

DatabaseConnector$connect <- function(connectionDetails = NULL, ...) {
  if (is.null(connectionDetails)) {
    connectionDetails <- DatabaseConnector$createConnectionDetails(...)
  }
  dbms <- connectionDetails$dbms
  server <- if (is.function(connectionDetails$server)) connectionDetails$server() else connectionDetails$server

  connection <- DBI::dbConnect(duckdb::duckdb(), dbdir = server)
  attr(connection, "dbms") <- "duckdb"
  return(connection)
}

DatabaseConnector$disconnect <- function(connection) {
  DBI::dbDisconnect(connection)
}

DatabaseConnector$dbms <- function(connection) {
  dbms <- attr(connection, "dbms")
  if (is.null(dbms)) "duckdb" else dbms
}

DatabaseConnector$querySql <- function(connection, sql,
                                        snakeCaseToCamelCase = FALSE,
                                        ...) {
  sql <- gsub(";\\s*$", "", sql)
  result <- DBI::dbGetQuery(connection, sql)
  if (snakeCaseToCamelCase && nrow(result) > 0) {
    colnames(result) <- SqlRender$snakeCaseToCamelCase(colnames(result))
  }
  return(result)
}

DatabaseConnector$executeSql <- function(connection, sql, ...) {
  statements <- SqlRender$splitSql(sql)
  for (stmt in statements) {
    DBI::dbExecute(connection, stmt)
  }
  invisible(NULL)
}

DatabaseConnector$renderTranslateExecuteSql <- function(connection, sql, ...) {
  sql <- SqlRender$render(sql, ...)
  sql <- SqlRender$translate(sql, targetDialect = DatabaseConnector$dbms(connection))
  DatabaseConnector$executeSql(connection, sql)
}

DatabaseConnector$renderTranslateQuerySql <- function(connection, sql,
                                                       snakeCaseToCamelCase = FALSE,
                                                       ...) {
  sql <- SqlRender$render(sql, ...)
  sql <- SqlRender$translate(sql, targetDialect = DatabaseConnector$dbms(connection))
  DatabaseConnector$querySql(connection, sql, snakeCaseToCamelCase = snakeCaseToCamelCase)
}

DatabaseConnector$getTableNames <- function(connection, databaseSchema = NULL) {
  tables <- DBI::dbListTables(connection)
  if (!is.null(databaseSchema) && databaseSchema != "" && databaseSchema != "main") {
    tables <- DBI::dbGetQuery(connection,
      sprintf("SELECT table_name FROM information_schema.tables WHERE table_schema = '%s'",
              databaseSchema))$table_name
  }
  return(tables)
}

DatabaseConnector$existsTable <- function(connection, tableName) {
  tableName %in% DBI::dbListTables(connection)
}

DatabaseConnector$insertTable <- function(connection, tableName, data, ...) {
  DBI::dbWriteTable(connection, tableName, data, append = TRUE, overwrite = FALSE)
}

DatabaseConnector$assertTempEmulationSchemaSet <- function(...) {
  invisible(NULL)
}

DatabaseConnector$createZipFile <- function(zipFile, files, ...) {
  zip(zipFile, files)
}

# Patch existing namespace if loaded
tryCatch({
  if ("DatabaseConnector" %in% loadedNamespaces()) {
    for (fn_name in ls(DatabaseConnector)) {
      assignInNamespace(fn_name, get(fn_name, envir = DatabaseConnector), ns = "DatabaseConnector")
    }
    message("DatabaseConnectorLite: patched existing DatabaseConnector namespace")
  }
}, error = function(e) {
  message("DatabaseConnectorLite: loaded as standalone")
})

message("DatabaseConnectorLite loaded successfully")
