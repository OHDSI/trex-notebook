#!/usr/bin/env Rscript
# Regression test: CohortMethod spec objects carry the S3 class names Strategus
# expects (generic "args" for argument objects; lowercase cmAnalysis/outcome/
# targetComparatorOutcomes), and list-of-analyses / list-of-outcomes fields are
# UNNAMED so they serialize to JSON arrays (not objects).
#
# Evidence: pystrategus execution-side reference
# (.../pystrategus/cohort_definition_set/testdata/analysisSpecification.json):
#   *Args -> "args"; cmAnalysisList[i] -> "cmAnalysis"; outcomes[i] -> "outcome";
#   targetComparatorOutcomesList[i] -> "targetComparatorOutcomes".
# Unchanged (already correct): prior "cyclopsPrior", control "cyclopsControl",
# covariateSettings "covariateSettings", cmDiagnosticThresholds "CmDiagnosticThresholds".
#
# WebR cannot run under the JS/vitest harness (browser + workers), so this runs
# in a real R runtime.  Run: Rscript tests/StrategusSpecBuilder-cohortmethod-classes.test.R

args <- commandArgs(FALSE)
this_file <- sub("^--file=", "", grep("^--file=", args, value = TRUE))
test_dir <- dirname(normalizePath(this_file))
source(file.path(test_dir, "..", "src", "kernels", "webr", "StrategusSpecBuilder.R"))

failures <- 0L
check <- function(desc, cond) {
  if (isTRUE(cond)) cat("PASS: ", desc, "\n", sep = "")
  else { cat("FAIL: ", desc, "\n", sep = ""); failures <<- failures + 1L }
}

# --- argument objects -> "args" ---
gda  <- createGetDbCohortMethodDataArgs()
spa  <- createCreateStudyPopulationArgs()
psa  <- createCreatePsArgs()
mopa <- createMatchOnPsArgs()
foma <- createFitOutcomeModelArgs()
check("getDbCohortMethodDataArgs class == 'args'", identical(class(gda), "args"))
check("createStudyPopArgs class == 'args'",        identical(class(spa), "args"))
check("createPsArgs class == 'args'",              identical(class(psa), "args"))
check("matchOnPsArgs class == 'args'",             identical(class(mopa), "args"))
check("fitOutcomeModelArgs class == 'args'",       identical(class(foma), "args"))

# --- unchanged nested classes ---
check("covariateSettings class unchanged", identical(class(gda$covariateSettings), "covariateSettings"))
check("prior class unchanged",   identical(class(foma$prior), "cyclopsPrior"))
check("control class unchanged", identical(class(foma$control), "cyclopsControl"))

# --- analysis / outcome / tco wrappers ---
cma <- createCmAnalysis(
  analysisId = 1, description = "t",
  getDbCohortMethodDataArgs = gda, createStudyPopArgs = spa,
  createPsArgs = psa, matchOnPsArgs = mopa, fitOutcomeModelArgs = foma
)
check("cmAnalysis class == 'cmAnalysis'", identical(class(cma), "cmAnalysis"))

oc  <- createOutcome(outcomeId = 3)
check("outcome class == 'outcome'", identical(class(oc), "outcome"))

# Pass a NAMED outcomes list on purpose -> builder must unname it (JSON array).
tco <- createTargetComparatorOutcomes(targetId = 2, comparatorId = 1,
                                      outcomes = list(o1 = oc))
check("tco class == 'targetComparatorOutcomes'", identical(class(tco), "targetComparatorOutcomes"))
check("outcomes is unnamed (serializes as array)", is.null(names(tco$outcomes)))

# Pass NAMED list fields on purpose -> module builder must unname them.
mod <- createCohortMethodModuleSpecifications(
  cmAnalysisList = list(cmAnalysis1 = cma),
  targetComparatorOutcomesList = list(tco1 = tco)
)
check("module class[1] specific-first", identical(class(mod)[[1]], "CohortMethodModuleSpecifications"))
check("cmAnalysisList is unnamed (array)",
      is.null(names(mod$settings$cmAnalysisList)))
check("targetComparatorOutcomesList is unnamed (array)",
      is.null(names(mod$settings$targetComparatorOutcomesList)))

if (failures > 0L) {
  cat("\n", failures, " check(s) failed\n", sep = "")
  quit(status = 1)
}
cat("\nAll CohortMethod class/shape checks passed\n")
