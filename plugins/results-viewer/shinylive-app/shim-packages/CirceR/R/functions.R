# CirceRLite — pure-R replacement for CirceR (no Java/rJava)
# Provides stubs for the CirceR functions used by OhdsiShinyModules.
# For MVP, cohort print-friendly output is simplified.

cohortExpressionFromJson <- function(expressionJson) {
  if (is.character(expressionJson)) {
    expr <- jsonlite::fromJSON(expressionJson, simplifyVector = FALSE)
  } else {
    expr <- expressionJson
  }
  class(expr) <- "cohortExpression"
  return(expr)
}

buildCohortQuery <- function(expression, options = NULL) {
  if (is.character(expression)) {
    return(paste("-- Cohort SQL (generated from JSON definition)\n", expression))
  }
  if (!is.null(expression$sql)) {
    return(expression$sql)
  }
  return("-- SQL generation requires CirceR with Java. Load pre-generated SQL from results.")
}

createGenerateOptions <- function(generateStats = FALSE, cohortId = NULL) {
  opts <- list(generateStats = generateStats)
  if (!is.null(cohortId)) opts$cohortId <- cohortId
  return(opts)
}

cohortPrintFriendly <- function(expression) {
  if (is.character(expression)) {
    tryCatch({
      expr <- jsonlite::fromJSON(expression, simplifyVector = FALSE)
    }, error = function(e) {
      return("*Cohort definition (human-readable rendering requires CirceR with Java)*")
    })
  } else {
    expr <- expression
  }

  lines <- character()
  lines <- c(lines, "## Cohort Definition\n")

  if (!is.null(expr$PrimaryCriteria)) {
    pc <- expr$PrimaryCriteria
    lines <- c(lines, "### Primary Events")
    if (!is.null(pc$CriteriaList) && length(pc$CriteriaList) > 0) {
      for (i in seq_along(pc$CriteriaList)) {
        crit <- pc$CriteriaList[[i]]
        type <- names(crit)[1]
        lines <- c(lines, sprintf("- %s criterion", type))
      }
    }
    lines <- c(lines, "")
  }

  if (!is.null(expr$InclusionRules) && length(expr$InclusionRules) > 0) {
    lines <- c(lines, "### Inclusion Rules")
    for (rule in expr$InclusionRules) {
      name <- if (!is.null(rule$name)) rule$name else "Unnamed rule"
      lines <- c(lines, sprintf("- %s", name))
    }
    lines <- c(lines, "")
  }

  if (!is.null(expr$EndStrategy)) {
    lines <- c(lines, "### End Strategy")
    lines <- c(lines, sprintf("- %s", class(expr$EndStrategy)[1]))
    lines <- c(lines, "")
  }

  if (length(lines) <= 2) {
    lines <- c(lines, "*Full human-readable rendering requires CirceR with Java.*")
    lines <- c(lines, "*View the JSON definition for complete details.*")
  }

  return(paste(lines, collapse = "\n"))
}

conceptSetListPrintFriendly <- function(conceptSets) {
  if (is.null(conceptSets) || length(conceptSets) == 0) {
    return("*No concept sets defined*")
  }

  lines <- "## Concept Sets\n"
  for (cs in conceptSets) {
    name <- if (!is.null(cs$name)) cs$name else "Unnamed"
    nItems <- if (!is.null(cs$expression) && !is.null(cs$expression$items))
      length(cs$expression$items) else 0
    lines <- c(lines, sprintf("- **%s** (%d concepts)", name, nItems))
  }
  return(paste(lines, collapse = "\n"))
}
