# OHDSI Results Viewer — Shinylive
# Packages in library() below must be in the WebR repo (shinylive bundles them).
# OHDSI packages (not in WebR repo) get installed at runtime from served tarballs.

library(shiny)
library(shinydashboard)
library(DBI)
library(duckdb)
library(reactable)
library(jsonlite)
library(dplyr)
library(ggplot2)
library(plotly)
library(rlang)
library(readr)
library(R6)
library(pool)
library(dbplyr)
library(lubridate)
library(fastmap)
library(withr)
library(gridExtra)
library(shinyWidgets)
library(shinycssloaders)
library(markdown)
library(checkmate)
library(stringr)
library(tibble)
library(tidyr)
library(purrr)
library(scales)
library(RColorBrewer)
for (.pkg in c("SqlRender", "DatabaseConnector", "CirceR",
                "ResultModelManager", "OhdsiShinyAppBuilder", "OhdsiShinyModules")) {
  .ok <- suppressWarnings(suppressMessages(tryCatch({
    loadNamespace(.pkg)
    TRUE
  }, error = function(e) {
    FALSE
  })))
}

# Force-register the OhdsiShinyAppBuilder www/images path so the header logo
# resolves. system.file() should do this, but in WebR's mounted FS Shiny's
# automatic www-from-package handling sometimes misses, so register explicitly.
local({
  pkg_www <- system.file("www", package = "OhdsiShinyAppBuilder")
  if (nchar(pkg_www) > 0 && dir.exists(pkg_www)) {
    tryCatch({
      shiny::addResourcePath("www", pkg_www)
      shiny::addResourcePath("www/images", file.path(pkg_www, "images"))
    }, error = function(e) NULL)
  }
})

# OHDSI packages are pre-bundled by shinylive export at build time.
# No runtime download needed.

# -- DuckDB connection --
# Cache a single duckdb DRIVER and share it across every connection. All
# connections from the same driver see the same in-memory storage, so even
# if a HADES module disconnects after a query, the data persists for the
# next module's connect() call.
.duckdb_driver_results <- duckdb::duckdb(dbdir = ":memory:")
.results_con <- DBI::dbConnect(.duckdb_driver_results)
# Force these into globalenv so DatabaseConnector::connect() (our shim) can
# find them via get(..., envir=globalenv()). Without this they may live only
# in app.R's local env and the shim creates a fresh, empty DB instead.
assign(".duckdb_driver_results", .duckdb_driver_results, envir = globalenv())
assign(".results_con", .results_con, envir = globalenv())

# Tracks columns the OHDSI schema declares as VARCHAR/TEXT per table.
# At CSV-load time we coerce these to character so na_if(x, "") in HADES
# modules works — read.csv would otherwise infer them as integer when every
# row happens to be numeric (e.g. calendar_year).
.varchar_cols_by_table <- list()
.varchar_cols_for_table <- function(tbl) {
  v <- .varchar_cols_by_table[[tbl]]
  if (!is.null(v)) return(v)
  # CSV filenames include OHDSI table prefixes (cd_, cm_, sccs_, ...) but
  # the schema files declare table names WITHOUT them. Strip any common
  # prefix and try the bare name so cd_incidence_rate finds incidence_rate.
  prefixes <- c("cd_", "cg_", "ci_", "cm_", "c_", "dd_", "es_",
                  "plp_", "pv_", "sccs_", "i_", "tp_", "pf_")
  for (p in prefixes) {
    if (startsWith(tbl, p)) {
      stripped <- substring(tbl, nchar(p) + 1)
      v <- .varchar_cols_by_table[[stripped]]
      if (!is.null(v)) return(v)
    }
  }
  character(0)
}

# Pre-create the full Strategus result data model from schema CSVs so OHDSI
# modules' startup queries succeed even before postMessage delivers the actual
# data. Real data overwrites these stubs as it loads.
local({
  # Shinylive mounts app files at /home/web_user/app_<random>/
  # Use getwd() to find this dir, since the random suffix changes per session.
  schema_dir <- file.path(getwd(), "schemas")
  if (!dir.exists(schema_dir)) {
    # Fallback: search for it
    candidates <- list.dirs("/home/web_user", recursive = FALSE)
    for (c in candidates) {
      if (dir.exists(file.path(c, "schemas"))) {
        schema_dir <- file.path(c, "schemas")
        break
      }
    }
  }
  message("Loading schemas from: ", schema_dir, " (exists=", dir.exists(schema_dir), ")")
  if (!dir.exists(schema_dir)) return()

  # Map CSV data types to R column initializers
  init_for <- function(dtype) {
    dtype <- tolower(trimws(dtype))
    if (grepl("int|bigint|float|double|numeric|decimal|real", dtype)) numeric()
    else if (grepl("bool|logical", dtype)) logical()
    else if (grepl("date|time", dtype)) character()  # ISO strings
    else character()
  }

  created <- character()
  for (csv_file in list.files(schema_dir, pattern = "\\.csv$", full.names = TRUE)) {
    spec <- tryCatch(utils::read.csv(csv_file, stringsAsFactors = FALSE),
                       error = function(e) NULL)
    if (is.null(spec) || !"table_name" %in% colnames(spec)) next
    for (tbl in unique(spec$table_name)) {
      if (tbl %in% created) next
      cols <- spec[spec$table_name == tbl, ]
      df_cols <- setNames(
        lapply(cols$data_type, init_for),
        cols$column_name
      )
      # Record VARCHAR / TEXT / CHAR columns for this table.
      varchar_idx <- grepl("^(varchar|text|char|string)",
                            tolower(trimws(cols$data_type)))
      .varchar_cols_by_table[[tbl]] <<- as.character(cols$column_name[varchar_idx])
      df <- do.call(data.frame, c(df_cols, list(stringsAsFactors = FALSE)))
      tryCatch({
        DBI::dbWriteTable(.results_con, tbl, df, overwrite = TRUE)
        created <- c(created, tbl)
      }, error = function(e) NULL)
    }
  }

  # Also create the simpler tables expected by our test data
  fallback_stubs <- list(
    cohort = data.frame(cohort_id = integer(), cohort_name = character(),
                          json = character(), sql_command = character(),
                          stringsAsFactors = FALSE),
    cohort_count = data.frame(cohort_id = integer(), cohort_entries = integer(),
                                cohort_subjects = integer(),
                                database_id = character(), stringsAsFactors = FALSE),
    database = data.frame(database_id = character(), database_name = character(),
                            cdm_source_name = character(),
                            cdm_source_abbreviation = character(),
                            cdm_holder = character(),
                            source_description = character(),
                            stringsAsFactors = FALSE),
    # ResultModelManager checks this for schema version
    migration = data.frame(migration_file = character(),
                             migration_order = integer(),
                             stringsAsFactors = FALSE)
  )
  for (nm in names(fallback_stubs)) {
    if (!nm %in% created) {
      tryCatch(DBI::dbWriteTable(.results_con, nm, fallback_stubs[[nm]],
                                   overwrite = TRUE), error = function(e) NULL)
    }
  }

  # Ensure critical OHDSI columns exist on the database table regardless of
  # which schema CSV created it. Different modules query different column sets.
  required_database_cols <- list(
    cdm_source_name = "VARCHAR",
    cdm_source_abbreviation = "VARCHAR",
    cdm_holder = "VARCHAR",
    source_description = "VARCHAR",
    source_documentation_reference = "VARCHAR",
    cdm_etl_reference = "VARCHAR",
    source_release_date = "VARCHAR",
    cdm_release_date = "VARCHAR",
    cdm_version = "VARCHAR",
    vocabulary_version = "VARCHAR",
    max_obs_period_end_date = "VARCHAR"
  )
  if ("database" %in% DBI::dbListTables(.results_con)) {
    existing_cols <- tolower(DBI::dbListFields(.results_con, "database"))
    for (col in names(required_database_cols)) {
      if (!tolower(col) %in% existing_cols) {
        tryCatch(
          DBI::dbExecute(.results_con,
                          sprintf("ALTER TABLE database ADD COLUMN %s %s",
                                  col, required_database_cols[[col]])),
          error = function(e) NULL
        )
      }
    }
  }
})

# -- Build the OhdsiShinyAppBuilder config --
has_ohdsi <- requireNamespace("OhdsiShinyAppBuilder", quietly = TRUE) &&
             requireNamespace("OhdsiShinyModules", quietly = TRUE)

ohdsi_error <- NULL
if (has_ohdsi) {
  # Monkey-patch buggy OHDSI functions that fail under the dplyr/vctrs versions
  # shipped with WebR. We can't change OHDSI source, so we override in-place.
  tryCatch({
    # cohort-generator-main.R::getCohortGeneratorCohortMeta uses
    #   case_when(COMPLETE ~ difftime(...), T ~ NA)
    # which fails vctrs's type checker because the two branches don't share
    # a common type (difftime/duration vs logical NA). Replace with an
    # equivalent ifelse-based version that returns numeric minutes throughout.
    patched <- function(connectionHandler, resultDatabaseSettings,
                         cohortDefinitionId = NULL) {
      result <- OhdsiReportGenerator::getCohortMeta(
        connectionHandler = connectionHandler,
        schema = resultDatabaseSettings$schema,
        cgTablePrefix = resultDatabaseSettings$cgTablePrefix,
        databaseTable = resultDatabaseSettings$databaseTable,
        cohortIds = cohortDefinitionId
      )
      if (!"generationStatus" %in% colnames(result)) {
        result$generationDuration <- numeric(nrow(result))
        return(result)
      }
      dur <- rep(NA_real_, nrow(result))
      ok <- which(result$generationStatus == "COMPLETE")
      if (length(ok) > 0) {
        end <- suppressWarnings(as.numeric(result$endTime[ok]))
        sta <- suppressWarnings(as.numeric(result$startTime[ok]))
        dur[ok] <- (end - sta) / 60  # seconds -> minutes
      }
      result$generationDuration <- dur
      result
    }
    assignInNamespace("getCohortGeneratorCohortMeta", patched,
                       ns = "OhdsiShinyModules")
    message("Patched OhdsiShinyModules::getCohortGeneratorCohortMeta")
  }, error = function(e) {
    message("Failed to patch getCohortGeneratorCohortMeta: ", e$message)
  })

  tryCatch({
    message("Building OhdsiShinyAppBuilder config...")
    config <- list(shinyModules = list(
      OhdsiShinyAppBuilder::createDefaultAboutConfig(),
      OhdsiShinyAppBuilder::createDefaultCohortGeneratorConfig(),
      OhdsiShinyAppBuilder::createDefaultCohortDiagnosticsConfig(),
      OhdsiShinyAppBuilder::createDefaultCharacterizationConfig(),
      OhdsiShinyAppBuilder::createDefaultEstimationConfig(),
      OhdsiShinyAppBuilder::createDefaultPredictionConfig(),
      OhdsiShinyAppBuilder::createDefaultDatasourcesConfig()
    ))
    message("Config built with ", length(config$shinyModules), " modules")

    # Match the prefixes used by Strategus's results.sqlite (and the real
    # OhdsiReportGenerator example data). OHDSI modules check for table
    # existence as paste0(<x>TablePrefix, 'result') so wrong/missing prefixes
    # mean the module assumes its tables aren't there and renders nothing.
    resultDatabaseSettings <- list(
      schema = "main",
      tablePrefix = "",
      databaseTable = "database_meta_data",
      databaseTablePrefix = "",
      vocabularyDatabaseSchema = "main",
      cgTable = "cg_cohort_definition",
      cgTablePrefix = "cg_",
      cdTablePrefix = "cd_",
      ciTablePrefix = "ci_",
      cmTablePrefix = "cm_",
      cTablePrefix = "c_",
      ddTablePrefix = "dd_",
      esTablePrefix = "es_",
      plpTablePrefix = "plp_",
      pvTablePrefix = "pv_",
      sccsTablePrefix = "sccs_",
      incidenceTablePrefix = "i_"
    )

    # Build connectionDetails with a function-server that returns OUR shared
    # in-memory DuckDB. Then DatabaseConnector::connect(connectionDetails)
    # called by modules' diagnostic-type checks returns the populated DB.
    .shared_con <- .results_con
    cd <- DatabaseConnector::createConnectionDetails(dbms = "duckdb", server = ":memory:")
    cd$server <- function() ":memory:"
    cd$.sharedCon <- .shared_con
    connectionHandler <- ResultModelManager::ConnectionHandler$new(connectionDetails = cd)
    connectionHandler$con <- .results_con
    connectionHandler$isActive <- TRUE

    message("Building UI...")
    ui <- OhdsiShinyAppBuilder:::ui(config, title = "OHDSI Analysis Results")
    message("UI built")

    message("Building server...")
    ohdsi_server <- OhdsiShinyAppBuilder:::server(config, connectionHandler, resultDatabaseSettings)
    # Wrap server to inject data-loading from postMessage
    server_fn <- function(input, output, session) {
      # Track which payload hash we last loaded so duplicate postMessages
      # don't re-run the 95-table load on every retry.
      .last_payload_hash <- ""
      .ohdsi_started <- FALSE
      observeEvent(input$result_files, {
        files <- input$result_files
        if (is.null(files)) return()
        # Cheap "hash": filename list + total size. Avoids deep equality of
        # CSV strings, which would be expensive.
        h <- paste(names(files), sapply(files, nchar), collapse = "|")
        if (identical(h, .last_payload_hash)) {
          message("Duplicate file payload, skipping reload but acking.")
          # Still ack so the Vue host's loading overlay hides on subsequent
          # re-mounts (e.g. user goes Back to library and re-opens the same
          # result). Otherwise overlay stays forever — data is already there.
          session$sendCustomMessage("APP_READY",
                                     list(tables = length(files)))
          return()
        }
        .last_payload_hash <<- h
        for (nm in names(files)) {
          tbl <- gsub("\\.(csv|parquet)$", "", basename(nm))
          tbl <- gsub("[^a-zA-Z0-9_]", "_", tbl)
          tryCatch({
            df <- read.csv(textConnection(files[[nm]]), stringsAsFactors = FALSE)
            # Coerce columns the OHDSI schema declares as VARCHAR back to
            # character — read.csv infers these as integer when all rows are
            # numeric, which breaks na_if(x, "") + as.integer() patterns in
            # the HADES modules (e.g. calendar_year in cohort-diagnostics).
            for (vc in .varchar_cols_for_table(tbl)) {
              if (vc %in% colnames(df)) df[[vc]] <- as.character(df[[vc]])
            }
            # Duplicate the cohort-id-style primary key under common aliases so
            # OHDSI modules that query a different name find data either way.
            aliases <- list(
              cohort_definition_id = "cohort_id",
              cohort_id = "cohort_definition_id"
            )
            for (src in names(aliases)) {
              dst <- aliases[[src]]
              if (src %in% colnames(df) && !dst %in% colnames(df)) {
                df[[dst]] <- df[[src]]
              }
            }
            # If a stub table exists, MERGE: keep all stub columns, fill from
            # CSV where present, NA otherwise. Add any new CSV columns too.
            if (DBI::dbExistsTable(.results_con, tbl)) {
              stub_cols <- DBI::dbListFields(.results_con, tbl)
              union_cols <- union(stub_cols, colnames(df))
              merged <- as.data.frame(matrix(NA, nrow = nrow(df), ncol = length(union_cols)),
                                        stringsAsFactors = FALSE)
              colnames(merged) <- union_cols
              for (c in colnames(df)) merged[[c]] <- df[[c]]
              DBI::dbWriteTable(.results_con, tbl, merged, overwrite = TRUE)
              message("Merged table: ", tbl, " (", nrow(df), " rows, ",
                      length(union_cols), " cols)")
            } else {
              DBI::dbWriteTable(.results_con, tbl, df, overwrite = TRUE)
              message("Loaded table: ", tbl, " (", nrow(df), " rows)")
            }
          }, error = function(e) message("Failed to load ", nm, ": ", e$message))
        }
        # Start OHDSI module servers ONLY now that all tables are loaded.
        # Several modules (e.g. cohort-diagnostics-databaseInformation) eagerly
        # pre-query the DB during module init. If the user clicks a tab before
        # the data is in DuckDB, the module crashes and OhdsiShinyAppBuilder
        # never re-invokes it (runServer == 1 guard). The loading overlay in
        # ShinyFrame.vue blocks tab clicks until APP_READY fires, so we can
        # safely defer ohdsi_server here.
        if (!.ohdsi_started) {
          .ohdsi_started <<- TRUE
          message("Starting OHDSI server (data now loaded)")
          ohdsi_server(input, output, session)
        }
        # Signal to the parent Vue host that all tables are now in DuckDB and
        # the viewer is ready to use. ShinyFrame.vue listens for this to hide
        # its loading overlay.
        session$sendCustomMessage("APP_READY", list(tables = length(files)))
      })
      # Binary DuckDB submission path: a base64-encoded .db file arrives via
      # input$result_db. Decode it to disk, ATTACH it read-only, and expose its
      # tables as views on .results_con so the OHDSI modules (which query
      # unqualified table names) see the submitted data.
      observeEvent(input$result_db, {
        b64 <- input$result_db
        if (is.null(b64) || !nzchar(b64)) return()
        tryCatch({
          raw <- jsonlite::base64_dec(b64)
          dbpath <- file.path(tempdir(), "submitted_results.duckdb")
          # DETACH any prior attach BEFORE overwriting the file on disk.
          try(DBI::dbExecute(.results_con, "DETACH submitted"), silent = TRUE)
          writeBin(raw, dbpath)
          DBI::dbExecute(.results_con,
            sprintf("ATTACH '%s' AS submitted (READ_ONLY)", dbpath))
          tbls <- DBI::dbGetQuery(.results_con,
            "SELECT table_name FROM information_schema.tables WHERE table_catalog = 'submitted'")$table_name
          # Copy each submitted table into .results_con as a REAL table.
          # CREATE OR REPLACE TABLE replaces a pre-created stub table OR a prior
          # view regardless of type (CREATE OR REPLACE VIEW throws against an
          # existing table, which the OHDSI stubs are).
          for (t in tbls) {
            DBI::dbExecute(.results_con,
              sprintf('CREATE OR REPLACE TABLE "%s" AS SELECT * FROM submitted."%s"', t, t))
          }
          # Data is materialized now; the attached file is no longer needed.
          try(DBI::dbExecute(.results_con, "DETACH submitted"), silent = TRUE)
          message("Loaded submitted DuckDB: ", length(tbls), " tables")
          session$sendCustomMessage("APP_READY", list(tables = length(tbls)))
        }, error = function(e) message("Failed to load submitted DB: ", e$message))
      }, ignoreInit = TRUE)
    }
    message("OhdsiShinyAppBuilder fully loaded!")
  }, error = function(e) {
    message("OHDSI ERROR: ", e$message)
    ohdsi_error <<- e$message
    has_ohdsi <<- FALSE
  })
}

if (!has_ohdsi) {
  # Fallback: minimal UI if OHDSI packages failed to install
  message("OHDSI packages not available — using fallback UI")
  ui <- dashboardPage(
    skin = "black",
    dashboardHeader(title = "OHDSI Analysis Results"),
    dashboardSidebar(
      sidebarMenu(id = "tabs",
        menuItem("Data", tabName = "data", icon = icon("database")),
        menuItem("Cohort Counts", tabName = "counts", icon = icon("users")),
        menuItem("Data Sources", tabName = "sources", icon = icon("server"))
      )
    ),
    dashboardBody(
      tabItems(
        tabItem("data", h2("Loaded Data"), uiOutput("data_status"), reactableOutput("data_overview")),
        tabItem("counts", h2("Cohort Counts"), reactableOutput("counts_table")),
        tabItem("sources", h2("Data Sources"), reactableOutput("sources_table"))
      )
    )
  )
  server_fn <- function(input, output, session) {
    dataLoaded <- reactiveVal(FALSE)
    observeEvent(input$result_files, {
      files <- input$result_files
      if (is.null(files)) return()
      for (nm in names(files)) {
        tbl <- gsub("\\.(csv|parquet)$", "", basename(nm))
        tryCatch({
          df <- read.csv(textConnection(files[[nm]]), stringsAsFactors = FALSE)
          DBI::dbWriteTable(.results_con, tbl, df, overwrite = TRUE)
        }, error = function(e) NULL)
      }
      dataLoaded(TRUE)
    })
    # Binary DuckDB submission path (fallback UI): decode base64 .db, ATTACH it
    # read-only, and expose its tables as views on .results_con.
    observeEvent(input$result_db, {
      b64 <- input$result_db
      if (is.null(b64) || !nzchar(b64)) return()
      tryCatch({
        raw <- jsonlite::base64_dec(b64)
        dbpath <- file.path(tempdir(), "submitted_results.duckdb")
        # DETACH any prior attach BEFORE overwriting the file on disk.
        try(DBI::dbExecute(.results_con, "DETACH submitted"), silent = TRUE)
        writeBin(raw, dbpath)
        DBI::dbExecute(.results_con,
          sprintf("ATTACH '%s' AS submitted (READ_ONLY)", dbpath))
        tbls <- DBI::dbGetQuery(.results_con,
          "SELECT table_name FROM information_schema.tables WHERE table_catalog = 'submitted'")$table_name
        # Copy each submitted table into .results_con as a REAL table.
        # CREATE OR REPLACE TABLE replaces a pre-created stub table OR a prior
        # view regardless of type (CREATE OR REPLACE VIEW throws against an
        # existing table, which the OHDSI stubs are).
        for (t in tbls) {
          DBI::dbExecute(.results_con,
            sprintf('CREATE OR REPLACE TABLE "%s" AS SELECT * FROM submitted."%s"', t, t))
        }
        # Data is materialized now; the attached file is no longer needed.
        try(DBI::dbExecute(.results_con, "DETACH submitted"), silent = TRUE)
        message("Loaded submitted DuckDB: ", length(tbls), " tables")
        dataLoaded(TRUE)
        session$sendCustomMessage("APP_READY", list(tables = length(tbls)))
      }, error = function(e) message("Failed to load submitted DB: ", e$message))
    }, ignoreInit = TRUE)
    output$data_status <- renderUI({
      if (!dataLoaded()) div(class="alert alert-info", strong("Waiting for data..."))
      else div(class="alert alert-success", strong("Data loaded."))
    })
    output$data_overview <- renderReactable({
      req(dataLoaded())
      tbls <- DBI::dbListTables(.results_con)
      df <- data.frame(Table=tbls, Rows=vapply(tbls, function(t) tryCatch(as.integer(DBI::dbGetQuery(.results_con, paste("SELECT COUNT(*) AS n FROM",t))$n), error=function(e) NA_integer_), integer(1)))
      reactable(df, striped=TRUE)
    })
    output$counts_table <- renderReactable({
      req(dataLoaded(), "cohort_count" %in% DBI::dbListTables(.results_con))
      df <- DBI::dbGetQuery(.results_con, "SELECT * FROM cohort_count")
      reactable(df, searchable=TRUE, striped=TRUE)
    })
    output$sources_table <- renderReactable({
      req(dataLoaded(), "database" %in% DBI::dbListTables(.results_con))
      df <- DBI::dbGetQuery(.results_con, "SELECT * FROM database")
      reactable(df, striped=TRUE)
    })
  }
}

# -- Inject Atlas-style CSS + data bridge JS + launch --
ui <- tagList(
  ui,
  tags$head(tags$style(HTML("
    /* === Atlas3 visual theme overrides on shinydashboard === */
    /* Brand palette */
    :root {
      --atlas-bg: #f5f7fa;
      --atlas-surface: #ffffff;
      --atlas-border: #e5e7eb;
      --atlas-text: #1f2937;
      --atlas-muted: #6b7280;
      --atlas-primary: #1f425a;        /* navy brand primary */
      --atlas-primary-dim: #5b7c93;
      --atlas-active: #0f3a5f;
    }

    /* Hide the shinydashboard header bar entirely */
    .main-header { display: none !important; }
    .content-wrapper, .right-side { margin-top: 0 !important; }
    html, body { height: 100%; }
    body {
      background: var(--atlas-bg);
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: var(--atlas-text);
      padding: 16px;
      box-sizing: border-box;
    }
    /* Wrap the entire shinydashboard app in a single Atlas-style card */
    .wrapper {
      background: var(--atlas-surface);
      border: 1px solid var(--atlas-border);
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
      overflow: hidden;
      min-height: calc(100vh - 32px);
      position: relative;
    }
    /* Sidebar must scroll inside the card, not jump out via position:fixed */
    .main-sidebar {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      bottom: 0 !important;
      height: auto !important;
    }
    .content-wrapper {
      min-height: calc(100vh - 32px) !important;
    }

    /* Sidebar: light surface, ATLAS active row */
    .main-sidebar {
      background: var(--atlas-surface) !important;
      border-right: 1px solid var(--atlas-border) !important;
      padding-top: 60px !important;  /* room for the floating back button */
      box-shadow: none !important;
      border-radius: 12px 0 0 12px !important;
    }
    .sidebar { background: transparent !important; padding-top: 0 !important; }
    .sidebar-menu > li > a {
      color: var(--atlas-text) !important;
      border-left: 3px solid transparent !important;
      padding: 14px 20px !important;
      font-weight: 500 !important;
      font-size: 1.08rem !important;
      line-height: 1.35 !important;
    }
    .sidebar-menu > li > a > .fa,
    .sidebar-menu > li > a > .fas,
    .sidebar-menu > li > a > .far {
      color: var(--atlas-muted) !important;
      margin-right: 14px !important;
      font-size: 1.15rem !important;
    }
    .sidebar-menu > li:hover > a {
      background: rgba(31, 66, 90, 0.06) !important;
      color: var(--atlas-text) !important;
    }
    .sidebar-menu > li.active > a {
      background: rgba(31, 66, 90, 0.10) !important;
      color: var(--atlas-active) !important;
      border-left-color: var(--atlas-primary) !important;
    }
    .sidebar-menu > li.active > a > .fa,
    .sidebar-menu > li.active > a > .fas { color: var(--atlas-primary) !important; }
    .sidebar-menu .pull-right { display: none !important; } /* info-icons clutter */

    /* Body */
    .content-wrapper, .right-side { background: var(--atlas-bg) !important; }
    .content { padding: 20px 24px !important; }

    /* Outer card framing all module content */
    .content > .row { background: transparent; }

    /* Box: Atlas card look */
    .box {
      border-radius: 10px !important;
      border: 1px solid var(--atlas-border) !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06) !important;
      background: var(--atlas-surface) !important;
      margin-bottom: 20px !important;
    }
    .box.box-primary, .box.box-info, .box.box-warning,
    .box.box-success, .box.box-danger { border-top: 1px solid var(--atlas-border) !important; }
    .box-header {
      background: var(--atlas-surface) !important;
      border-radius: 10px 10px 0 0 !important;
      border-bottom: 1px solid var(--atlas-border) !important;
      color: var(--atlas-text) !important;
      padding: 14px 18px !important;
    }
    .box-header .box-title {
      color: var(--atlas-text) !important;
      font-size: 1.0rem !important;
      font-weight: 600 !important;
    }
    .box-header .fa, .box-header .fas { color: var(--atlas-primary) !important; }
    .box-body { padding: 16px 18px !important; }

    /* shinydashboard's solidHeader=TRUE blue strip → flat Atlas header */
    .box.box-solid > .box-header,
    .box.box-solid.box-primary > .box-header,
    .box.box-solid.box-info > .box-header {
      background: var(--atlas-surface) !important;
      color: var(--atlas-text) !important;
    }
    .box.box-solid.box-primary { border: 1px solid var(--atlas-border) !important; }

    /* Tabs (tabsetPanel, tab pills) */
    .nav-tabs-custom > .nav-tabs { border-bottom: 1px solid var(--atlas-border); padding: 0 8px; }
    .nav-tabs-custom > .nav-tabs > li.active > a {
      border-top-color: var(--atlas-primary) !important;
      color: var(--atlas-active) !important;
      font-weight: 600;
    }
    .nav-pills > li.active > a,
    .nav-pills > li.active > a:hover { background: var(--atlas-primary) !important; }

    /* Buttons */
    .btn-default {
      background: var(--atlas-surface) !important;
      color: var(--atlas-text) !important;
      border: 1px solid var(--atlas-border) !important;
      border-radius: 6px !important;
    }
    .btn-primary {
      background: var(--atlas-primary) !important;
      border-color: var(--atlas-primary) !important;
      border-radius: 6px !important;
    }
    .btn-primary:hover { background: #163349 !important; border-color: #163349 !important; }
    .action-button.btn-default:hover {
      background: rgba(31, 66, 90, 0.08) !important;
      border-color: var(--atlas-primary-dim) !important;
    }

    /* Form controls */
    .form-control, .selectize-input {
      border-radius: 6px !important;
      border: 1px solid var(--atlas-border) !important;
      box-shadow: none !important;
    }
    .bootstrap-select > .dropdown-toggle {
      border-radius: 6px !important;
      border: 1px solid var(--atlas-border) !important;
      background: var(--atlas-surface) !important;
      color: var(--atlas-text) !important;
    }

    /* Tables (reactable) — Atlas-y */
    .rt-table { border: none !important; }
    .rt-th {
      background: #fafbfc !important;
      color: var(--atlas-text) !important;
      font-weight: 600 !important;
      border-bottom: 1px solid var(--atlas-border) !important;
    }
    .rt-td { border-bottom: 1px solid var(--atlas-border) !important; }
    .rt-tr-striped { background: #fafbfc !important; }

    /* Misc */
    h1, h2, h3, h4 { color: var(--atlas-text); }
    a { color: var(--atlas-primary); }
    a:hover { color: #163349; }

    /* Smaller, denser sidebar collapse on narrow screens */
    @media (max-width: 768px) {
      .main-sidebar { width: 100%; }
    }
  "))),
  tags$script(HTML("
    // This inline script runs at HTML parse time, BEFORE Shiny's JS API exists.
    // So we must NOT touch Shiny.* here: at parse time `typeof Shiny` is
    // undefined, which previously meant (a) Shiny.setInputValue threw and
    // (b) the APP_READY handler was never registered, so the host overlay never
    // cleared. Instead we buffer incoming data and defer all Shiny work until
    // shiny:connected (with a poll fallback), then flush + signal readiness.
    var __resultFiles = {};
    var __resultDb = '';
    var __pending = null;
    function __rvFlush() {
      if (typeof Shiny === 'undefined' || typeof Shiny.setInputValue !== 'function' || !__pending) return;
      if (__pending.k === 'db') Shiny.setInputValue('result_db', __pending.v, {priority: 'event'});
      else Shiny.setInputValue('result_files', __pending.v, {priority: 'event'});
      __pending = null;
    }
    function __rvAck() { if (window.top !== window) window.top.postMessage({type: 'DATA_RECEIVED'}, '*'); }
    window.addEventListener('message', function(event) {
      var d = event.data;
      if (!d) return;
      if (d.type === 'RESULT_DB_BEGIN') { __resultDb = ''; return; }
      if (d.type === 'RESULT_DB_CHUNK') { __resultDb += d.content; return; }
      if (d.type === 'RESULT_DB_END') { __pending = {k: 'db', v: __resultDb}; __rvFlush(); __rvAck(); return; }
      if (d.type === 'RESULT_FILES') { __pending = {k: 'files', v: d.files}; __rvFlush(); __rvAck(); return; }
      if (d.type === 'RESULT_FILES_BEGIN') { __resultFiles = {}; return; }
      if (d.type === 'RESULT_FILES_CHUNK') { __resultFiles[d.name] = d.content; return; }
      if (d.type === 'RESULT_FILES_END') { __pending = {k: 'files', v: __resultFiles}; __rvFlush(); __rvAck(); return; }
    });
    function __rvReady() {
      if (window.__rvReadyDone) return; window.__rvReadyDone = true;
      try {
        Shiny.addCustomMessageHandler('APP_READY', function(payload) {
          if (window.top && window.top !== window) {
            window.top.postMessage({type: 'APP_READY', tables: payload && payload.tables}, '*');
          }
        });
      } catch (e) {}
      __rvFlush();
      if (window.top && window.top !== window) window.top.postMessage({type: 'SHINYLIVE_READY'}, '*');
    }
    document.addEventListener('shiny:connected', __rvReady);
    var __rvTries = 0;
    var __rvPoll = setInterval(function() {
      if (typeof Shiny !== 'undefined' && typeof Shiny.setInputValue === 'function') { clearInterval(__rvPoll); __rvReady(); }
      else if (++__rvTries > 1200) { clearInterval(__rvPoll); }
    }, 500);
  "))
)

shinyApp(ui, server_fn)
