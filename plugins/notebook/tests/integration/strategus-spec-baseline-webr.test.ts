import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WebRKernel } from '@/kernels/webr/WebRKernel'
import type { KernelOutput } from '@/kernels/types'

const baseline = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/strategus-baseline.json'), 'utf-8')
)

function pickScopedModules(spec: any) {
  return spec.moduleSpecifications.filter((m: any) =>
    ['CohortGeneratorModule', 'CohortMethodModule', 'PatientLevelPredictionModule'].includes(m.module)
  )
}

// PatientLevelPrediction's setLassoLogisticRegression() and createDefaultSplitSetting()
// both randomly generate a seed when one isn't explicitly supplied (see
// StrategusSpecBuilder.R:1493 and :1319, and generate-strategus-baseline.R which also
// calls both with no seed argument). This makes those two fields inherently
// non-reproducible across the R baseline and the WebR-generated spec, so they cannot be
// part of an exact-equality check. We strip them out (after confirming they are the
// expected type/shape) before comparing everything else with toEqual.
function extractAndStripRandomSeeds(spec: any): { seeds: unknown[]; stripped: any } {
  const clone = JSON.parse(JSON.stringify(spec))
  const seeds: unknown[] = []
  const plpModule = clone.moduleSpecifications.find((m: any) => m.module === 'PatientLevelPredictionModule')
  if (plpModule) {
    for (const modelDesign of plpModule.settings.modelDesignList) {
      if (modelDesign.splitSettings && 'seed' in modelDesign.splitSettings) {
        seeds.push(modelDesign.splitSettings.seed)
        delete modelDesign.splitSettings.seed
      }
      const modelSettings = modelDesign.modelSettings
      if (modelSettings && modelSettings.param && 'seed' in modelSettings.param) {
        seeds.push(modelSettings.param.seed)
        delete modelSettings.param.seed
      }
    }
  }
  return { seeds, stripped: clone }
}

async function collect(iter: AsyncIterable<KernelOutput>): Promise<KernelOutput[]> {
  const out: KernelOutput[] = []
  for await (const o of iter) out.push(o)
  return out
}

describe('Strategus spec baseline — WebR', () => {
  let kernel: WebRKernel

  beforeAll(async () => {
    kernel = new WebRKernel()
    await kernel.connect({ type: 'webr' } as any)
  }, 60000)

  afterAll(async () => {
    await kernel.disconnect()
  })

  it('matches the R baseline for CohortGenerator, CohortMethod, and PLP specs', async () => {
    // Scenario mirrors plugins/notebook/tests/fixtures/generate-strategus-baseline.R exactly:
    // target=1, comparator=2, outcome=3, excludedCovariateConceptIds=c(1118084,1124300),
    // covariateSettings addDescendantsToExclude=TRUE, washoutPeriod=183,
    // firstExposureOnly=TRUE, removeDuplicateSubjects="remove all", maxCohortSize=100000,
    // createStudyPopulationArgs minDaysAtRisk=1/riskWindowStart=0/startAnchor="cohort start"/
    // riskWindowEnd=30/endAnchor="cohort end", fitOutcomeModelArgs modelType="cox",
    // cmAnalysis analysisId=1 "No matching, simple outcome model" (no PS/matching steps),
    // cohortGenerator generateStats=TRUE, PLP targetId=1/outcomeId=3 with
    // populationSettings startAnchor="cohort start"/riskWindowStart=1/endAnchor="cohort start"/
    // riskWindowEnd=365/minTimeAtRisk=1, default covariateSettings, lasso logistic
    // regression modelSettings, runCovariateSummary=TRUE.
    const code = `
# StrategusSpecBuilder.R's functions are already loaded into the global R
# environment by WebRKernel.connect() (see WebRKernel.ts), so no source() call
# is needed here. jsonlite is not preinstalled (only checkmate is, for
# StrategusSpecBuilder.R itself), so install it explicitly before use.
if (!requireNamespace("jsonlite", quietly = TRUE)) webr::install("jsonlite")

# .isCohortDefinitionSet() requires a data frame with cohortId/cohortName/sql/json columns
cohortDefinitionSet <- data.frame(
  cohortId = 1,
  cohortName = "target",
  sql = "",
  json = "{}",
  stringsAsFactors = FALSE
)
cohortSharedResource <- createCohortSharedResourceSpecifications(cohortDefinitionSet)

cohortGeneratorSpec <- createCohortGeneratorModuleSpecifications(generateStats = TRUE)

cmCovariateSettings <- createDefaultCovariateSettings(addDescendantsToExclude = TRUE)

getDbCmDataArgs <- createGetDbCohortMethodDataArgs(
  covariateSettings = cmCovariateSettings,
  washoutPeriod = 183,
  firstExposureOnly = TRUE,
  removeDuplicateSubjects = "remove all",
  maxCohortSize = 100000
)

createStudyPopArgs <- createCreateStudyPopulationArgs(
  minDaysAtRisk = 1,
  riskWindowStart = 0,
  startAnchor = "cohort start",
  riskWindowEnd = 30,
  endAnchor = "cohort end"
)

fitOutcomeModelArgs <- createFitOutcomeModelArgs(modelType = "cox")

cmAnalysis1 <- createCmAnalysis(
  analysisId = 1,
  description = "No matching, simple outcome model",
  getDbCohortMethodDataArgs = getDbCmDataArgs,
  createStudyPopArgs = createStudyPopArgs,
  fitOutcomeModelArgs = fitOutcomeModelArgs
)

cmAnalysisList <- list(cmAnalysis1)

outcome3 <- createOutcome(outcomeId = 3, outcomeOfInterest = TRUE)

tco1 <- createTargetComparatorOutcomes(
  targetId = 1,
  comparatorId = 2,
  outcomes = list(outcome3),
  excludedCovariateConceptIds = c(1118084, 1124300)
)

targetComparatorOutcomesList <- list(tco1)

cohortMethodSpec <- createCohortMethodModuleSpecifications(
  cmAnalysisList = cmAnalysisList,
  targetComparatorOutcomesList = targetComparatorOutcomesList
)

plpPopulationSettings <- createStudyPopulationSettings(
  startAnchor = "cohort start",
  riskWindowStart = 1,
  endAnchor = "cohort start",
  riskWindowEnd = 365,
  minTimeAtRisk = 1
)

plpCovariateSettings <- createDefaultCovariateSettings()

modelDesign1 <- createModelDesign(
  targetId = 1,
  outcomeId = 3,
  populationSettings = plpPopulationSettings,
  covariateSettings = plpCovariateSettings,
  modelSettings = setLassoLogisticRegression(),
  runCovariateSummary = TRUE
)

modelDesignList <- list(modelDesign1)
plpSpec <- createPatientLevelPredictionModuleSpecifications(modelDesignList = modelDesignList)

spec <- createEmptyAnalysisSpecifications()
spec <- addSharedResources(spec, cohortSharedResource)
spec <- addModuleSpecifications(spec, cohortGeneratorSpec)
spec <- addModuleSpecifications(spec, cohortMethodSpec)
spec <- addModuleSpecifications(spec, plpSpec)

# Strip S3 classes recursively so jsonlite serializes the underlying plain
# lists/data.frames (same as generate-strategus-baseline.R does for the fixture).
stripClasses <- function(x) {
  if (is.data.frame(x)) return(x)
  if (is.list(x)) x <- lapply(x, stripClasses)
  attr(x, "class") <- NULL
  x
}

cat(jsonlite::toJSON(stripClasses(spec), auto_unbox = TRUE, pretty = FALSE, null = "null"))
`
    const outputs = await collect(kernel.execute(code, 'r'))
    const stdout = outputs
      .filter((o) => o.type === 'stream' && o.name === 'stdout')
      .map((o: any) => o.text)
      .join('')
    if (!stdout.trim()) {
      console.error('DEBUG outputs:', JSON.stringify(outputs, null, 2))
    }
    const generated = JSON.parse(stdout.trim())

    const generatedScoped = { moduleSpecifications: pickScopedModules(generated) }
    const baselineScoped = { moduleSpecifications: pickScopedModules(baseline) }

    const { seeds: generatedSeeds, stripped: generatedStripped } = extractAndStripRandomSeeds(generatedScoped)
    const { seeds: baselineSeeds, stripped: baselineStripped } = extractAndStripRandomSeeds(baselineScoped)

    // Random seeds can't match exactly (they're generated fresh each run / each fixture
    // build) — just confirm they exist and are numbers on both sides.
    expect(generatedSeeds.length).toBe(baselineSeeds.length)
    for (const seed of generatedSeeds) {
      expect(typeof seed).toBe('number')
    }
    for (const seed of baselineSeeds) {
      expect(typeof seed).toBe('number')
    }

    // Everything else must match exactly.
    expect(generatedStripped).toEqual(baselineStripped)
  }, 60000)
})
