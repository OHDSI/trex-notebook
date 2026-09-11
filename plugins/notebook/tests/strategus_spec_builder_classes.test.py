"""strategus_spec_builder_classes.test.py

Verifies the S3 class values ("_class") Strategus expects for the CohortMethod
surface of strategus_spec_builder.py, and that module specifications carry a
specific-first "_class" tuple, mirroring the R fix in StrategusSpecBuilder.R.

Python lists are already JSON arrays, so there is no unname()-equivalent
concern here; the corresponding checks just confirm cmAnalysisList,
targetComparatorOutcomesList and outcomes come back as plain lists.

Deliberately out of scope (not touched here): the SCCS study-population args
and the CohortIncidence outcome definition, which reuse the literal strings
"CreateStudyPopulationArgs" and "Outcome" for unrelated objects.

Run: python3 plugins/notebook/tests/strategus_spec_builder_classes.test.py
"""

import importlib.util
import os
import sys

FAILURES = 0


def check(condition: bool, message: str) -> None:
    global FAILURES
    if condition:
        print(f"PASS: {message}")
    else:
        print(f"FAIL: {message}")
        FAILURES += 1


def _load_module():
    here = os.path.dirname(os.path.abspath(__file__))
    module_path = os.path.join(
        here, "..", "src", "kernels", "pyodide", "strategus_spec_builder.py"
    )
    module_path = os.path.normpath(module_path)
    spec = importlib.util.spec_from_file_location("sb", module_path)
    sb = importlib.util.module_from_spec(spec)
    # Python 3.11+ dataclass processing inspects sys.modules for the module
    # being defined; without this, spec.loader.exec_module raises an
    # unrelated AttributeError.
    sys.modules["sb"] = sb
    spec.loader.exec_module(sb)
    return sb


sb = _load_module()

# --- Class value mapping (12 functions, all -> lowercase "args"/leaf names) ---

check(sb.create_get_db_cohort_method_data_args()["_class"] == "args",
      "create_get_db_cohort_method_data_args: _class is 'args'")

check(sb.create_create_study_population_args()["_class"] == "args",
      "create_create_study_population_args: _class is 'args'")

check(sb.create_create_ps_args()["_class"] == "args",
      "create_create_ps_args: _class is 'args'")

check(sb.create_trim_by_ps_args()["_class"] == "args",
      "create_trim_by_ps_args: _class is 'args'")

check(sb.create_truncate_iptw_args()["_class"] == "args",
      "create_truncate_iptw_args: _class is 'args'")

check(sb.create_match_on_ps_args()["_class"] == "args",
      "create_match_on_ps_args: _class is 'args'")

check(sb.create_stratify_by_ps_args()["_class"] == "args",
      "create_stratify_by_ps_args: _class is 'args'")

check(sb.create_compute_covariate_balance_args()["_class"] == "args",
      "create_compute_covariate_balance_args: _class is 'args'")

check(sb.create_fit_outcome_model_args()["_class"] == "args",
      "create_fit_outcome_model_args: _class is 'args'")

cm_analysis = sb.create_cm_analysis(
    get_db_cohort_method_data_args=sb.create_get_db_cohort_method_data_args(),
    create_study_pop_args=sb.create_create_study_population_args(),
)
check(cm_analysis["_class"] == "cmAnalysis",
      "create_cm_analysis: _class is 'cmAnalysis'")

outcome = sb.create_outcome(outcome_id=1)
check(outcome["_class"] == "outcome",
      "create_outcome: _class is 'outcome'")

outcome2 = sb.create_outcome(outcome_id=2)
tco = sb.create_target_comparator_outcomes(
    target_id=1, comparator_id=2, outcomes=[outcome, outcome2]
)
check(tco["_class"] == "targetComparatorOutcomes",
      "create_target_comparator_outcomes: _class is 'targetComparatorOutcomes'")

# --- List shapes: Python lists are already JSON arrays; no unname() needed ---

check(isinstance(tco["outcomes"], list) and len(tco["outcomes"]) == 2,
      "create_target_comparator_outcomes: outcomes is a plain list (array) with all elements")

cm_spec = sb.create_cohort_method_module_specifications(
    cm_analysis_list=[cm_analysis],
    target_comparator_outcomes_list=[tco],
)
check(isinstance(cm_spec["settings"]["cmAnalysisList"], list)
      and len(cm_spec["settings"]["cmAnalysisList"]) == 1,
      "create_cohort_method_module_specifications: cmAnalysisList is a plain list (array)")
check(isinstance(cm_spec["settings"]["targetComparatorOutcomesList"], list)
      and len(cm_spec["settings"]["targetComparatorOutcomesList"]) == 1,
      "create_cohort_method_module_specifications: targetComparatorOutcomesList is a plain list (array)")

# --- Module class order: specific-first, mirroring the R fix ---

check(cm_spec["_class"] == ("CohortMethodModuleSpecifications", "ModuleSpecifications"),
      "create_cohort_method_module_specifications: _class is specific-first")

cg_spec = sb.create_cohort_generator_module_specifications()
check(cg_spec["_class"] == ("CohortGeneratorModuleSpecifications", "ModuleSpecifications"),
      "create_cohort_generator_module_specifications: _class is specific-first")

cd_spec = sb.create_cohort_diagnostics_module_specifications()
check(cd_spec["_class"] == ("CohortDiagnosticsModuleSpecifications", "ModuleSpecifications"),
      "create_cohort_diagnostics_module_specifications: _class is specific-first")

ci_spec = sb.create_cohort_incidence_module_specifications()
check(ci_spec["_class"] == ("CohortIncidenceModuleSpecifications", "ModuleSpecifications"),
      "create_cohort_incidence_module_specifications: _class is specific-first")

# --- Out-of-scope sibling functions must be untouched ---

sccs_args = sb.create_sccs_create_study_population_args()
check(sccs_args["_class"] == "CreateStudyPopulationArgs",
      "SCCS create_sccs_create_study_population_args: untouched, still 'CreateStudyPopulationArgs'")

ci_outcome = sb.create_outcome_def(id=1)
check(ci_outcome["_class"] == "Outcome",
      "CohortIncidence create_outcome_def: untouched, still 'Outcome'")

# --- Classes that were already correct and must remain unchanged ---

check(sb.create_cm_diagnostic_thresholds()["_class"] == "CmDiagnosticThresholds",
      "create_cm_diagnostic_thresholds: unchanged, _class is 'CmDiagnosticThresholds'")

check(sb.create_prior()["_class"] == "cyclopsPrior",
      "create_prior: unchanged, _class is 'cyclopsPrior'")

check(sb.create_control()["_class"] == "cyclopsControl",
      "create_control: unchanged, _class is 'cyclopsControl'")

check(sb.create_covariate_settings(useDemographicsGender=True)["_class"] == "covariateSettings",
      "create_covariate_settings: unchanged, _class is 'covariateSettings'")

if FAILURES:
    print(f"\n{FAILURES} check(s) FAILED.")
    sys.exit(1)
else:
    print("\nAll checks PASSED.")
    sys.exit(0)
