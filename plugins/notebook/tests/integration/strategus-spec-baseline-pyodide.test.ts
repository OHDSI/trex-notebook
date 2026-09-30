import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PyodideKernel } from '@/kernels/pyodide/PyodideKernel'
import type { KernelOutput } from '@/kernels/types'

const baseline = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/strategus-baseline.json'), 'utf-8')
)

// Extracts the moduleSpecifications we care about, plus a structural (not
// content-level) view of sharedResources. The baseline's sharedResources
// (plugins/notebook/tests/fixtures/strategus-baseline.json) embeds real
// cohort definitions pulled from the Strategus R package's own OMOP test
// fixtures (CohortGenerator::getCohortDefinitionSet() reading
// testdata/Cohorts.csv, testdata/cohorts/*.json, testdata/sql/*.sql — see
// generate-strategus-baseline.R) — e.g. actual "Celecoxib"/"Diclofenac"
// cohort expressions with real OMOP concept IDs. Reproducing that exact
// content from this test would mean vendoring those package fixtures, which
// is disproportionate for this verification harness. Instead we compare the
// *shape* of sharedResources — the set of cohortIds present and the field
// names on each cohort definition entry — which is enough to catch a
// structural drift (e.g. a renamed/missing field) without requiring the
// synthetic test cohorts to carry identical names/content to the baseline's.
function pickScoped(spec: any) {
  const moduleSpecifications = spec.moduleSpecifications.filter((m: any) =>
    ['CohortGeneratorModule', 'CohortMethodModule', 'PatientLevelPredictionModule'].includes(m.module)
  )
  const sharedResourcesShape = (spec.sharedResources ?? []).map((sr: any) => ({
    keys: Object.keys(sr).sort(),
    cohortDefinitions: (sr.cohortDefinitions ?? [])
      .map((cd: any) => ({ cohortId: cd.cohortId, keys: Object.keys(cd).sort() }))
      .sort((a: any, b: any) => a.cohortId - b.cohortId),
  }))
  return { moduleSpecifications, sharedResourcesShape }
}

// PatientLevelPrediction's createDefaultSplitSetting() (invoked internally by
// create_model_design()'s default splitSettings) randomly generates a seed
// when one isn't explicitly supplied — mirroring StrategusSpecBuilder.R's
// createDefaultSplitSetting() and generate-strategus-baseline.R, which also
// leaves splitSettings unspecified — so modelDesign.splitSettings.seed is
// inherently non-reproducible across the R baseline and the Pyodide-generated
// spec and can't be part of an exact-equality check. Note:
// set_lasso_logistic_regression()'s modelSettings.param does NOT contain a
// seed field (confirmed against the baseline fixture) — only
// splitSettings.seed is random here. We strip that one field out (after
// confirming it's the expected type) before comparing everything else with
// toEqual.
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
    }
  }
  return { seeds, stripped: clone }
}

async function collect(iter: AsyncIterable<KernelOutput>): Promise<KernelOutput[]> {
  const out: KernelOutput[] = []
  for await (const o of iter) out.push(o)
  return out
}

// Requires a real Worker, which jsdom (the vitest environment used here)
// doesn't provide. Opt in with RUN_KERNEL_INTEGRATION=1 in an environment
// that has one.
describe.skipIf(!process.env.RUN_KERNEL_INTEGRATION)('Strategus spec baseline — Pyodide', () => {
  let kernel: PyodideKernel

  beforeAll(async () => {
    kernel = new PyodideKernel()
    await kernel.connect({ type: 'pyodide' } as any)
  }, 60000)

  afterAll(async () => {
    // If beforeAll threw (e.g. the known "Worker is not defined" blocker),
    // kernel may be unset or already unusable; don't let a second,
    // unrelated disconnect error mask the real failure.
    await kernel?.disconnect().catch(() => {})
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
from strategus_spec_builder import (
    create_cohort_shared_resource_specifications,
    create_cohort_generator_module_specifications,
    create_cohort_method_module_specifications,
    create_patient_level_prediction_module_specifications,
    create_empty_analysis_specifications,
    add_shared_resources,
    add_module_specifications,
    create_default_covariate_settings,
    create_get_db_cohort_method_data_args,
    create_create_study_population_args,
    create_fit_outcome_model_args,
    create_cm_analysis,
    create_outcome,
    create_target_comparator_outcomes,
    create_study_population_settings,
    create_model_design,
    set_lasso_logistic_regression,
    to_json,
)

# IDs mirror the target/comparator/outcome cohorts used below (1/2/3); the
# baseline's sharedResources instead embeds real Strategus package OMOP test
# cohorts, so only the shared-resource *shape* (cohortIds + field names) is
# compared, not this synthetic content (see pickScoped()'s comment).
cohort_definition_set = [
    {"cohortId": 1, "cohortName": "target", "sql": "", "json": {}},
    {"cohortId": 2, "cohortName": "comparator", "sql": "", "json": {}},
    {"cohortId": 3, "cohortName": "outcome", "sql": "", "json": {}},
]

cohort_shared_resource = create_cohort_shared_resource_specifications(cohort_definition_set)

cohort_generator_spec = create_cohort_generator_module_specifications(generate_stats=True)

cm_covariate_settings = create_default_covariate_settings(
    add_descendants_to_exclude=True,
)

get_db_cm_data_args = create_get_db_cohort_method_data_args(
    covariate_settings=cm_covariate_settings,
    washout_period=183,
    first_exposure_only=True,
    remove_duplicate_subjects="remove all",
    max_cohort_size=100000,
)

create_study_pop_args = create_create_study_population_args(
    min_days_at_risk=1,
    risk_window_start=0,
    start_anchor="cohort start",
    risk_window_end=30,
    end_anchor="cohort end",
)

fit_outcome_model_args = create_fit_outcome_model_args(model_type="cox")

cm_analysis_1 = create_cm_analysis(
    analysis_id=1,
    description="No matching, simple outcome model",
    get_db_cohort_method_data_args=get_db_cm_data_args,
    create_study_pop_args=create_study_pop_args,
    fit_outcome_model_args=fit_outcome_model_args,
)

cm_analysis_list = [cm_analysis_1]

outcome_3 = create_outcome(outcome_id=3, outcome_of_interest=True)

tco_1 = create_target_comparator_outcomes(
    target_id=1,
    comparator_id=2,
    outcomes=[outcome_3],
    excluded_covariate_concept_ids=[1118084, 1124300],
)

target_comparator_outcomes_list = [tco_1]

cohort_method_spec = create_cohort_method_module_specifications(
    cm_analysis_list=cm_analysis_list,
    target_comparator_outcomes_list=target_comparator_outcomes_list,
)

plp_population_settings = create_study_population_settings(
    start_anchor="cohort start",
    risk_window_start=1,
    end_anchor="cohort start",
    risk_window_end=365,
    min_time_at_risk=1,
)

plp_covariate_settings = create_default_covariate_settings()

model_design_1 = create_model_design(
    target_id=1,
    outcome_id=3,
    population_settings=plp_population_settings,
    covariate_settings=plp_covariate_settings,
    model_settings=set_lasso_logistic_regression(),
    run_covariate_summary=True,
)

model_design_list = [model_design_1]
plp_spec = create_patient_level_prediction_module_specifications(
    model_design_list=model_design_list
)

spec = create_empty_analysis_specifications()
spec = add_shared_resources(spec, cohort_shared_resource)
spec = add_module_specifications(spec, cohort_generator_spec)
spec = add_module_specifications(spec, cohort_method_spec)
spec = add_module_specifications(spec, plp_spec)

print(to_json(spec, pretty=False))
`
    const outputs = await collect(kernel.execute(code, 'python'))

    // Surface any real Python-side failure (error outputs, or stderr stream
    // text) before attempting to parse stdout as JSON, so a genuine failure
    // reports its actual message instead of an opaque "Unexpected end of
    // JSON input".
    const errorOutputs = outputs.filter(
      (o: any) => o.type === 'error' || (o.type === 'stream' && o.name === 'stderr')
    )
    expect(errorOutputs).toEqual([])

    const stdout = outputs
      .filter((o) => o.type === 'stream' && o.name === 'stdout')
      .map((o: any) => o.text)
      .join('')
    const generated = JSON.parse(stdout.trim())

    const generatedScoped = pickScoped(generated)
    const baselineScoped = pickScoped(baseline)

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
