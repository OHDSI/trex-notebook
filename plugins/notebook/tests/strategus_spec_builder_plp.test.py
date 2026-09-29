"""strategus_spec_builder_plp.test.py

Verifies that the PatientLevelPrediction-facing constructors in strategus_spec_builder.py
emit exactly the field names PatientLevelPrediction 6.5.0 (pinned in the Data2Evidence
flow-hades renv.lock) accepts, i.e. names(<constructor>(...)), NOT names(formals(...)).
Confirmed against the installed package inside the alp-dataflow-gen-worker container.
Mirrors StrategusSpecBuilder-plp.test.R, adapted to snake_case.

Covers the four known 6.5.0 changes (executeSettings replacing top-level
run_covariate_summary, hyperparameter_settings removal, skip_diagnostics removal,
split_settings carrying no "type" field) plus fixes found while verifying the rest of
the PLP surface: the modelSettings object shape (fitFunction, param only -- "settings"
metadata lives nested under param as "attr_settings", mirroring the key the R custom
serializer emits for that R attribute (and what the Strategus/PLP deserializer reads),
not as a third top-level field), create_random_forest_feature_selection's max_depth field, and
create_patient_level_prediction_validation_module_specifications's log_level field.

Run: python3 plugins/notebook/tests/strategus_spec_builder_plp.test.py
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
    sys.modules["sb"] = sb
    spec.loader.exec_module(sb)
    return sb


sb = _load_module()


def keys(obj: dict) -> list:
    """Emitted keys in insertion order, excluding the _class marker."""
    return [k for k in obj if k != "_class"]


def expect_removed_function(label, fn, *args, **kwargs) -> None:
    try:
        fn(*args, **kwargs)
        result = None
    except TypeError as e:
        result = e
    check(
        result is not None and "6.5.0" in str(result),
        f"{label}: raises TypeError naming '6.5.0'"
    )


# =============================================================================
# Already-verified: create_study_population_settings (13/13 match) -- assert and move on.
# =============================================================================

check(
    keys(sb.create_study_population_settings()) == [
        "binary", "includeAllOutcomes", "firstExposureOnly", "washoutPeriod",
        "removeSubjectsWithPriorOutcome", "priorOutcomeLookback", "requireTimeAtRisk",
        "minTimeAtRisk", "riskWindowStart", "startAnchor", "riskWindowEnd", "endAnchor",
        "restrictTarToCohortEnd"
    ],
    "create_study_population_settings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object (13/13)"
)

# =============================================================================
# Change 1: create_model_design emits executeSettings (not top-level runCovariateSummary)
# =============================================================================

model_design = sb.create_model_design(
    target_id=1, outcome_id=2,
    model_settings=sb.set_lasso_logistic_regression()
)

check(
    keys(model_design) == [
        "targetId", "outcomeId", "restrictPlpDataSettings", "covariateSettings",
        "populationSettings", "sampleSettings", "featureEngineeringSettings",
        "preprocessSettings", "modelSettings", "splitSettings", "executeSettings"
    ],
    "create_model_design(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
    "runCovariateSummary" not in model_design,
    "create_model_design(): no top-level runCovariateSummary"
)

check(
    keys(model_design["executeSettings"]) == [
        "runSplitData", "runSampleData", "runFeatureEngineering", "runPreprocessData",
        "runModelDevelopment", "runCovariateSummary"
    ],
    "create_model_design()['executeSettings']: emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
    model_design["executeSettings"]["runCovariateSummary"] is True,
    "create_model_design(): runCovariateSummary default (True) preserved inside executeSettings"
)

check(
    sb.create_model_design(
        target_id=1, outcome_id=2, model_settings=sb.set_lasso_logistic_regression(),
        run_covariate_summary=False
    )["executeSettings"]["runCovariateSummary"] is False,
    "create_model_design(run_covariate_summary=False): threads through into executeSettings"
)

# =============================================================================
# Change 2: hyperparameter_settings removed from create_model_design;
# create_hyperparameter_settings and set_ridge_regression deprecated (absent from
# PatientLevelPrediction 6.5.0)
# =============================================================================

check(
    "hyperparameterSettings" not in model_design,
    "create_model_design(): no hyperparameterSettings field"
)

expect_removed_function("create_hyperparameter_settings()", sb.create_hyperparameter_settings)
expect_removed_function("set_ridge_regression()", sb.set_ridge_regression)

# =============================================================================
# Change 3: create_patient_level_prediction_module_specifications drops
# skip_diagnostics; create_patient_level_prediction_validation_module_specifications
# gains log_level
# =============================================================================

plp_module_spec = sb.create_patient_level_prediction_module_specifications(
    model_design_list=[model_design]
)
check(
    keys(plp_module_spec["settings"]) == ["modelDesignList"],
    "create_patient_level_prediction_module_specifications(): settings has only modelDesignList (no skipDiagnostics)"
)

plp_validation_module_spec = sb.create_patient_level_prediction_validation_module_specifications(
    validation_list=[]
)
check(
    keys(plp_validation_module_spec["settings"]) == ["validationList", "logLevel"],
    "create_patient_level_prediction_validation_module_specifications(): settings has validationList, logLevel"
)
check(
    plp_validation_module_spec["settings"]["logLevel"] == "INFO",
    "create_patient_level_prediction_validation_module_specifications(): logLevel defaults to 'INFO'"
)

# =============================================================================
# Change 4: split_settings carries no "type" field (it's a constructor argument only)
# =============================================================================

check(
    keys(sb.create_default_split_setting()) == ["test", "train", "seed", "nfold", "_fun"],
    "create_default_split_setting(): emitted key set/order matches PatientLevelPrediction 6.5.0 object plus _fun marker (no 'type')"
)

# =============================================================================
# Rest of the PLP surface: verified matches
# =============================================================================

check(
    keys(sb.create_restrict_plp_data_settings()) == [
        "studyStartDate", "studyEndDate", "firstExposureOnly", "washoutPeriod", "sampleSize"
    ],
    "create_restrict_plp_data_settings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
    keys(sb.create_preprocess_settings()) == ["minFraction", "normalize", "removeRedundancy"],
    "create_preprocess_settings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
    keys(sb.create_sample_settings()) == ["numberOutcomestoNonOutcomes", "sampleSeed", "_fun"],
    "create_sample_settings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object plus _fun marker"
)

check(
    keys(sb.create_feature_engineering_settings()) == ["_fun"],
    "create_feature_engineering_settings(type='none'): emits an empty object (plus _fun marker), matching PatientLevelPrediction 6.5.0"
)

check(
    keys(sb.create_univariate_feature_selection()) == ["k", "_fun"],
    "create_univariate_feature_selection(): emitted key set matches PatientLevelPrediction 6.5.0 object (k only, plus _fun marker)"
)

cohort_covariate_settings = sb.create_cohort_covariate_settings(
    cohort_name="test", setting_id=1, cohort_id=2, cohort_table="test_table"
)
check(
    keys(cohort_covariate_settings) == [
        "covariateName", "covariateId", "cohortDatabaseSchema", "cohortTable", "cohortIds",
        "startDay", "endDays", "count", "ageInteraction", "lnAgeInteraction", "analysisId", "_fun"
    ],
    "create_cohort_covariate_settings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

validation_design = sb.create_validation_design(target_id=1, outcome_id=2, plp_model_list=["dummy"])
check(
    keys(validation_design) == [
        "targetId", "outcomeId", "populationSettings", "plpModelList", "restrictPlpDataSettings",
        "recalibrate", "runCovariateSummary"
    ],
    "create_validation_design(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

# =============================================================================
# Fix found while verifying the rest of the surface: create_random_forest_feature_selection's
# object field is max_depth, not maxDepth.
# =============================================================================

check(
    keys(sb.create_random_forest_feature_selection()) == ["ntrees", "max_depth", "_fun"],
    "create_random_forest_feature_selection(): emitted key set/order matches PatientLevelPrediction 6.5.0 object (max_depth, not maxDepth)"
)

# =============================================================================
# Fix found while verifying the rest of the surface: every modelSettings object is
# {fitFunction, param} only -- the "settings" metadata PLP attaches lives nested under
# param as "attr_settings" (the key R's custom serializer emits for that R attribute,
# and what the Strategus/PLP deserializer reads), not as a third top-level field.
# =============================================================================

def expect_model_settings_shape(label, obj):
    check(
        keys(obj) == ["fitFunction", "param"],
        f"{label}: modelSettings object has only {{fitFunction, param}}"
    )
    check(
        "attr_settings" in obj["param"],
        f"{label}: settings metadata carried nested under param as attr_settings"
    )


expect_model_settings_shape("set_lasso_logistic_regression()", sb.set_lasso_logistic_regression())
expect_model_settings_shape("set_cox_model()", sb.set_cox_model())
expect_model_settings_shape("set_iterative_hard_thresholding()", sb.set_iterative_hard_thresholding())
expect_model_settings_shape("set_naive_bayes()", sb.set_naive_bayes())

check(
    sb.set_lasso_logistic_regression()["fitFunction"] == "fitCyclopsModel",
    "set_lasso_logistic_regression(): fitFunction unchanged ('fitCyclopsModel')"
)
check(
    sb.set_naive_bayes()["fitFunction"] == "fitSklearn",
    "set_naive_bayes(): fitFunction is 'fitSklearn' (previously missing entirely)"
)

# =============================================================================
# Pinned default VALUES -- never change these
# =============================================================================

check(
    sb.create_study_population_settings()["minTimeAtRisk"] == 364,
    "create_study_population_settings: minTimeAtRisk default is still 364"
)

check(
    sb.create_default_split_setting()["nfold"] == 3,
    "create_default_split_setting: nfold default is still 3"
)

check(
    sb.create_random_forest_feature_selection()["ntrees"] == 2000,
    "create_random_forest_feature_selection: ntrees default is still 2000"
)

# =============================================================================

if FAILURES > 0:
    print(f"\n{FAILURES} check(s) FAILED.")
    sys.exit(1)
else:
    print("\nAll checks PASSED.")
    sys.exit(0)
