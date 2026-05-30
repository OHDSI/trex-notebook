# app.R — OHDSI Analysis Results Viewer (Shiny + DuckDB)
# Self-contained Shiny app designed to run inside WebR/Shinylive.
# Receives CSV result data via postMessage from the parent frame,
# loads it into an in-memory DuckDB, and displays it with reactable.

# Shim packages (SqlRenderLite, DatabaseConnectorLite, CirceRLite) are loaded
# by webr-manager.ts before this file is evaluated — no source() calls needed.

library(shiny)
library(shinydashboard)
library(DBI)
library(reactable)

# .results_con is created by webr-manager.ts loadDataIntoDB() before this runs.
# It may be DuckDB (if SharedArrayBuffer available) or RSQLite (fallback).
# We don't create or library() a DB driver here.

# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
ui <- dashboardPage(
  skin = "black",
  dashboardHeader(title = "OHDSI Analysis Results"),
  dashboardSidebar(
    sidebarMenu(
      id = "tabs",
      menuItem("Data",               tabName = "data",               icon = icon("database")),
      menuItem("Cohort Counts",      tabName = "cohort_counts",      icon = icon("users")),
      menuItem("Incidence Rates",    tabName = "incidence_rates",    icon = icon("chart-line")),
      menuItem("Inclusion Rules",    tabName = "inclusion_rules",    icon = icon("filter")),
      menuItem("Cohort Definitions", tabName = "cohort_definitions", icon = icon("book")),
      menuItem("Data Sources",       tabName = "data_sources",       icon = icon("server"))
    )
  ),
  dashboardBody(
    tabItems(
      # -- Data overview --
      tabItem(
        tabName = "data",
        h2("Loaded Data"),
        uiOutput("data_status"),
        reactableOutput("data_overview")
      ),

      # -- Cohort Counts --
      tabItem(
        tabName = "cohort_counts",
        h2("Cohort Counts"),
        reactableOutput("cohort_counts_table")
      ),

      # -- Incidence Rates --
      tabItem(
        tabName = "incidence_rates",
        h2("Incidence Rates"),
        reactableOutput("incidence_rates_table")
      ),

      # -- Inclusion Rules --
      tabItem(
        tabName = "inclusion_rules",
        h2("Inclusion Rule Statistics"),
        reactableOutput("inclusion_rules_table")
      ),

      # -- Cohort Definitions --
      tabItem(
        tabName = "cohort_definitions",
        h2("Cohort Definitions"),
        reactableOutput("cohort_definitions_table")
      ),

      # -- Data Sources --
      tabItem(
        tabName = "data_sources",
        h2("Data Sources"),
        reactableOutput("data_sources_table")
      )
    ),

    # -- JavaScript bridge: listen for postMessage from parent frame --
    tags$script(HTML("
      // Notify parent that Shinylive is ready
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({type: 'SHINYLIVE_READY'}, '*');
      }

      // Listen for result file data from parent
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'RESULT_FILES') {
          Shiny.setInputValue('result_files', event.data.files, {priority: 'event'});
        }
      });
    "))
  )
)

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
server <- function(input, output, session) {

  dataLoaded <- reactiveVal(FALSE)

  # -- Receive CSV files via postMessage and load into DuckDB --
  observeEvent(input$result_files, {
    files <- input$result_files
    if (is.null(files)) return()

    for (file_name in names(files)) {
      csv_text <- files[[file_name]]
      tbl_name <- tools::file_path_sans_ext(basename(file_name))
      tbl_name <- gsub("[^a-zA-Z0-9_]", "_", tbl_name)

      tryCatch({
        df <- read.csv(textConnection(csv_text), stringsAsFactors = FALSE)
        DBI::dbWriteTable(.results_con, tbl_name, df, overwrite = TRUE)
        message(paste("Loaded table:", tbl_name, "-", nrow(df), "rows"))
      }, error = function(e) {
        message(paste("Error loading", file_name, ":", e$message))
      })
    }

    dataLoaded(TRUE)
  })

  # -- Data overview tab --
  output$data_status <- renderUI({
    if (!dataLoaded()) {
      tags$div(
        class = "alert alert-info",
        tags$strong("Waiting for data..."),
        tags$p("Result files will be loaded automatically from the parent application.")
      )
    } else {
      tags$div(
        class = "alert alert-success",
        tags$strong("Data loaded successfully.")
      )
    }
  })

  output$data_overview <- renderReactable({
    req(dataLoaded())
    tables <- DBI::dbListTables(.results_con)
    if (length(tables) == 0) return(NULL)

    overview <- data.frame(
      Table = tables,
      Rows = vapply(tables, function(tbl) {
        tryCatch(
          DBI::dbGetQuery(.results_con, paste("SELECT COUNT(*) AS n FROM", tbl))$n,
          error = function(e) NA_integer_
        )
      }, integer(1)),
      stringsAsFactors = FALSE
    )

    reactable(overview, searchable = TRUE, striped = TRUE,
              columns = list(
                Rows = colDef(format = colFormat(separators = TRUE))
              ))
  })

  # -- Helper: safe query that returns NULL on error --
  safeQuery <- function(sql) {
    tryCatch(DBI::dbGetQuery(.results_con, sql), error = function(e) NULL)
  }

  # -- Helper: check if table exists --
  tableExists <- function(tbl) {
    tbl %in% DBI::dbListTables(.results_con)
  }

  # -- Cohort Counts --
  output$cohort_counts_table <- renderReactable({
    req(dataLoaded())
    req(tableExists("cohort_count"))

    sql <- "SELECT cc.*"
    has_cohort <- tableExists("cohort")
    has_database <- tableExists("database")

    if (has_cohort) {
      sql <- paste0(sql, ", c.cohort_name")
    }
    if (has_database) {
      sql <- paste0(sql, ", d.database_name")
    }

    sql <- paste0(sql, " FROM cohort_count cc")

    if (has_cohort) {
      sql <- paste0(sql, " LEFT JOIN cohort c ON cc.cohort_id = c.cohort_id")
    }
    if (has_database) {
      sql <- paste0(sql, " LEFT JOIN database d ON cc.database_id = d.database_id")
    }

    df <- safeQuery(sql)
    if (is.null(df) || nrow(df) == 0) return(NULL)

    group_cols <- c()
    if (has_cohort && "cohort_name" %in% names(df)) group_cols <- c(group_cols, "cohort_name")

    cols <- lapply(names(df), function(nm) {
      if (nm %in% c("cohort_count", "cohort_subjects", "count", "person_count")) {
        colDef(format = colFormat(separators = TRUE))
      } else {
        colDef()
      }
    })
    names(cols) <- names(df)

    reactable(df,
              groupBy = if (length(group_cols) > 0) group_cols else NULL,
              columns = cols,
              searchable = TRUE, striped = TRUE)
  })

  # -- Incidence Rates --
  output$incidence_rates_table <- renderReactable({
    req(dataLoaded())
    req(tableExists("incidence_rate"))

    df <- safeQuery("SELECT * FROM incidence_rate")
    if (is.null(df) || nrow(df) == 0) return(NULL)

    cols <- lapply(names(df), function(nm) {
      if (grepl("count|persons|rate|proportion", nm, ignore.case = TRUE)) {
        colDef(format = colFormat(separators = TRUE))
      } else {
        colDef()
      }
    })
    names(cols) <- names(df)

    reactable(df, columns = cols, searchable = TRUE, striped = TRUE)
  })

  # -- Inclusion Rules --
  output$inclusion_rules_table <- renderReactable({
    req(dataLoaded())
    req(tableExists("inclusion_rule_stats"))

    df <- safeQuery("SELECT * FROM inclusion_rule_stats")
    if (is.null(df) || nrow(df) == 0) return(NULL)

    cols <- lapply(names(df), function(nm) {
      if (grepl("count|persons|meet", nm, ignore.case = TRUE)) {
        colDef(format = colFormat(separators = TRUE))
      } else {
        colDef()
      }
    })
    names(cols) <- names(df)

    reactable(df, columns = cols, searchable = TRUE, striped = TRUE)
  })

  # -- Cohort Definitions --
  output$cohort_definitions_table <- renderReactable({
    req(dataLoaded())
    req(tableExists("cohort"))

    df <- safeQuery("SELECT * FROM cohort")
    if (is.null(df) || nrow(df) == 0) return(NULL)

    reactable(df, searchable = TRUE, striped = TRUE)
  })

  # -- Data Sources --
  output$data_sources_table <- renderReactable({
    req(dataLoaded())
    req(tableExists("database"))

    df <- safeQuery("SELECT * FROM database")
    if (is.null(df) || nrow(df) == 0) return(NULL)

    reactable(df, searchable = TRUE, striped = TRUE)
  })
}

# ---------------------------------------------------------------------------
# Launch
# ---------------------------------------------------------------------------
.shiny_app <- shinyApp(ui, server)
