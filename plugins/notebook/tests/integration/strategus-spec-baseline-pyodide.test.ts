import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PyodideKernel } from '@/kernels/pyodide/PyodideKernel'
import type { KernelOutput } from '@/kernels/types'

const baseline = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/strategus-baseline.json'), 'utf-8')
)

function pickScopedModules(spec: any) {
  return spec.moduleSpecifications.filter((m: any) =>
    ['CohortGeneratorModule', 'CohortMethodModule', 'PatientLevelPredictionModule'].includes(m.module)
  )
}

async function collect(iter: AsyncIterable<KernelOutput>): Promise<KernelOutput[]> {
  const out: KernelOutput[] = []
  for await (const o of iter) out.push(o)
  return out
}

describe('Strategus spec baseline — Pyodide', () => {
  let kernel: PyodideKernel

  beforeAll(async () => {
    kernel = new PyodideKernel()
    await kernel.connect({ type: 'pyodide' } as any)
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

cohort_definition_set = [
    {"cohortId": 1, "cohortName": "target", "sql": "", "json": {}},
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
    const stdout = outputs
      .filter((o) => o.type === 'stream' && o.name === 'stdout')
      .map((o: any) => o.text)
      .join('')
    const generated = JSON.parse(stdout.trim())

    expect(pickScopedModules(generated)).toEqual(pickScopedModules(baseline))
  }, 60000)
})
