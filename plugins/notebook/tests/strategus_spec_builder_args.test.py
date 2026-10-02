"""strategus_spec_builder_args.test.py

Verifies that the CohortMethod-facing constructors in strategus_spec_builder.py emit
exactly the argument names CohortMethod 5.5.2 (pinned in the Data2Evidence flow-hades
renv.lock) accepts, in the object shapes captured in
docs/superpowers/specs/2026-09-10-hades-object-field-sets-evidence.md — i.e.
names(<constructor>(...)), NOT names(formals(...)). A field whose value is not supplied
is dropped by the real package's own object, so several constructors here emit fewer
fields than their signature accepts. Mirrors
StrategusSpecBuilder-cohortmethod-args.test.R, adapted to snake_case.

Also verifies that every argument CohortMethod 5.5.2 removed or renamed still exists in
its original positional slot (so old positional call sites fail loudly, here, instead of
deep in a Strategus flow run), raising a TypeError naming "5.5.2", for both a keyword
call and a positional call landing on that slot.

Run: python3 plugins/notebook/tests/strategus_spec_builder_args.test.py
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


def keys(obj: dict) -> list:
    """Emitted keys in insertion order, excluding _class."""
    return [k for k in obj if k != "_class"]


def sorted_keys(obj: dict) -> list:
    return sorted(keys(obj))


def expect_removed(label, fn, arg_name, keyword_value, positional_args, required_kwargs=None,
                    positional_guard_arg=None):
    """Asserts that both a keyword call and a positional call raise a TypeError whose
    message contains "5.5.2" AND names the specific argument the raised guard is for.
    `positional_args` is a tuple of values filling every slot up to and including
    arg_name's position (using each slot's own default where a value doesn't matter).
    `required_kwargs`, when given, fills the target function's other required
    (no-default) parameters for the keyword call — unlike R's lazy argument evaluation,
    Python raises its own TypeError for a missing required argument before our guard
    ever runs, so those slots must be supplied to observe the guard's error instead.

    `positional_guard_arg` names the guard the positional call actually trips. It
    defaults to `arg_name`, i.e. "the positional call reaches arg_name's own guard".
    But supplying any removed slot positionally — even None, even just to fill a later
    slot — trips THAT slot's guard first if it sits earlier in the signature. Where an
    earlier removed slot sits before arg_name, pass that slot's name here instead, so
    the assertion documents (and checks) the guard that actually fires rather than
    implying the positional call reaches arg_name's guard when it cannot."""
    if positional_guard_arg is None:
        positional_guard_arg = arg_name

    kw_call = dict(required_kwargs or {})
    kw_call[arg_name] = keyword_value
    try:
        fn(**kw_call)
        kw_error = None
    except TypeError as e:
        kw_error = e
    check(
        kw_error is not None and "5.5.2" in str(kw_error) and arg_name in str(kw_error),
        f"{label}: keyword call raises with '5.5.2' message naming '{arg_name}'"
    )

    try:
        fn(*positional_args)
        pos_error = None
    except TypeError as e:
        pos_error = e
    if positional_guard_arg == arg_name:
        pos_description = (
            f"{label}: positional call landing on original slot raises with '5.5.2' "
            f"message naming '{arg_name}'"
        )
    else:
        pos_description = (
            f"{label}: positional call cannot reach '{arg_name}' directly — an earlier "
            f"removed slot ('{positional_guard_arg}') is filled first, so its guard fires "
            f"instead; raises with '5.5.2' message naming '{positional_guard_arg}'"
        )
    check(
        pos_error is not None and "5.5.2" in str(pos_error) and positional_guard_arg in str(pos_error),
        pos_description
    )


# =============================================================================
# Exact emitted key sets (the OBJECT's fields, not the signature) — order matters.
# =============================================================================

check(
    keys(sb.create_get_db_cohort_method_data_args()) == [
        "studyStartDate", "studyEndDate", "firstExposureOnly", "removeDuplicateSubjects",
        "restrictToCommonPeriod", "washoutPeriod", "maxCohortSize", "covariateSettings"
    ],
    "create_get_db_cohort_method_data_args(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
    keys(sb.create_create_study_population_args()) == [
        "firstExposureOnly", "restrictToCommonPeriod", "washoutPeriod", "removeDuplicateSubjects",
        "removeSubjectsWithPriorOutcome", "priorOutcomeLookback", "minDaysAtRisk", "maxDaysAtRisk",
        "riskWindowStart", "startAnchor", "riskWindowEnd", "endAnchor", "censorAtNewRiskWindow"
    ],
    "create_create_study_population_args(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
    keys(sb.create_create_ps_args()) == [
        "maxCohortSizeForFitting", "errorOnHighCorrelation", "stopOnError", "prior", "control",
        "estimator"
    ],
    "create_create_ps_args(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
    keys(sb.create_trim_by_ps_args()) == ["trimFraction"],
    "create_trim_by_ps_args(): emitted key set matches CohortMethod 5.5.2 object (trimFraction only)"
)

check(
    keys(sb.create_truncate_iptw_args()) == ["maxWeight"],
    "create_truncate_iptw_args(): emitted key set unchanged (maxWeight only)"
)

check(
    keys(sb.create_match_on_ps_args()) == ["caliper", "caliperScale", "maxRatio", "allowReverseMatch"],
    "create_match_on_ps_args(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
    keys(sb.create_stratify_by_ps_args()) == ["numberOfStrata", "baseSelection"],
    "create_stratify_by_ps_args(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
    keys(sb.create_compute_covariate_balance_args()) == ["maxCohortSize"],
    "create_compute_covariate_balance_args(): emitted key set matches CohortMethod 5.5.2 object (maxCohortSize only)"
)

check(
    keys(sb.create_fit_outcome_model_args()) == [
        "modelType", "stratified", "useCovariates", "inversePtWeighting", "profileBounds",
        "prior", "control"
    ],
    "create_fit_outcome_model_args(): emitted key set/order matches CohortMethod 5.5.2 object"
)

cm_analysis = sb.create_cm_analysis(
    get_db_cohort_method_data_args=sb.create_get_db_cohort_method_data_args(),
    create_study_pop_args=sb.create_create_study_population_args()
)
check(
    keys(cm_analysis) == [
        "analysisId", "description", "getDbCohortMethodDataArgs", "createStudyPopArgs"
    ],
    "create_cm_analysis(): emits only the 4 always-present fields when no optional slot is supplied"
)

outcome = sb.create_outcome(outcome_id=1)
check(
    keys(outcome) == ["outcomeId", "outcomeOfInterest", "trueEffectSize"],
    "create_outcome(): emitted key set/order matches CohortMethod 5.5.2 object"
)

tco = sb.create_target_comparator_outcomes(target_id=1, comparator_id=2, outcomes=[])
check(
    keys(tco) == ["targetId", "comparatorId", "outcomes"],
    "create_target_comparator_outcomes(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
    keys(sb.create_cm_diagnostic_thresholds()) == [
        "mdrrThreshold", "easeThreshold", "sdmThreshold", "equipoiseThreshold",
        "generalizabilitySdmThreshold"
    ],
    "create_cm_diagnostic_thresholds(): emitted key set/order matches CohortMethod 5.5.2 object"
)

# =============================================================================
# Conditionally-emitted parameters: present only when the caller actually supplies them
# =============================================================================

check(
    sb.create_match_on_ps_args().get("stratificationColumns") is None
    and sb.create_match_on_ps_args(stratification_columns=["a"])["stratificationColumns"] == ["a"],
    "create_match_on_ps_args: stratification_columns absent by default, present when supplied"
)

check(
    sb.create_stratify_by_ps_args().get("stratificationColumns") is None
    and sb.create_stratify_by_ps_args(stratification_columns=["a"])["stratificationColumns"] == ["a"],
    "create_stratify_by_ps_args: stratification_columns absent by default, present when supplied"
)

check(
    "subgroupCovariateId" not in sb.create_compute_covariate_balance_args()
    and sb.create_compute_covariate_balance_args(subgroup_covariate_id=1)["subgroupCovariateId"] == 1,
    "create_compute_covariate_balance_args: subgroup_covariate_id absent by default, present when supplied"
)

check(
    "covariateFilter" not in sb.create_compute_covariate_balance_args()
    and sb.create_compute_covariate_balance_args(covariate_filter="x")["covariateFilter"] is not None,
    "create_compute_covariate_balance_args: covariate_filter absent by default, present when supplied"
)

check(
    "profileGrid" not in sb.create_fit_outcome_model_args()
    and sb.create_fit_outcome_model_args(profile_grid=[1, 2])["profileGrid"] == [1, 2],
    "create_fit_outcome_model_args: profile_grid absent by default, present when supplied"
)

check(
    "interactionCovariateIds" not in sb.create_fit_outcome_model_args()
    and sb.create_fit_outcome_model_args(interaction_covariate_ids=[123])["interactionCovariateIds"] == [123],
    "create_fit_outcome_model_args: interaction_covariate_ids absent by default, present when supplied"
)

check(
    "excludeCovariateIds" not in sb.create_fit_outcome_model_args()
    and sb.create_fit_outcome_model_args(exclude_covariate_ids=[123])["excludeCovariateIds"] == [123],
    "create_fit_outcome_model_args: exclude_covariate_ids absent by default, present when supplied"
)

check(
    "includeCovariateIds" not in sb.create_fit_outcome_model_args()
    and sb.create_fit_outcome_model_args(include_covariate_ids=[123])["includeCovariateIds"] == [123],
    "create_fit_outcome_model_args: include_covariate_ids absent by default, present when supplied"
)

check(
    "excludeCovariateIds" not in sb.create_create_ps_args()
    and sb.create_create_ps_args(exclude_covariate_ids=[123])["excludeCovariateIds"] == [123],
    "create_create_ps_args: exclude_covariate_ids absent by default, present when supplied"
)

check(
    "includeCovariateIds" not in sb.create_create_ps_args()
    and sb.create_create_ps_args(include_covariate_ids=[123])["includeCovariateIds"] == [123],
    "create_create_ps_args: include_covariate_ids absent by default, present when supplied"
)

check(
    "attritionFractionThreshold" not in sb.create_cm_diagnostic_thresholds()
    and sb.create_cm_diagnostic_thresholds(attrition_fraction_threshold=0.1)["attritionFractionThreshold"] == 0.1,
    "create_cm_diagnostic_thresholds: attrition_fraction_threshold absent by default, present when supplied"
)

cm_analysis_with_ps = sb.create_cm_analysis(
    get_db_cohort_method_data_args=sb.create_get_db_cohort_method_data_args(),
    create_study_pop_args=sb.create_create_study_population_args(),
    create_ps_args=sb.create_create_ps_args()
)
check(
    "createPsArgs" in cm_analysis_with_ps and "trimByPsArgs" not in cm_analysis_with_ps,
    "create_cm_analysis: optional slot (create_ps_args) present only when supplied, others stay absent"
)

check(
    "riskWindowStart" not in sb.create_outcome(outcome_id=1)
    and sb.create_outcome(outcome_id=1, risk_window_start=0)["riskWindowStart"] == 0,
    "create_outcome: risk_window_start absent by default, present when supplied"
)

check(
    "includedCovariateConceptIds" not in sb.create_target_comparator_outcomes(
        target_id=1, comparator_id=2, outcomes=[]
    )
    and sb.create_target_comparator_outcomes(
        target_id=1, comparator_id=2, outcomes=[], included_covariate_concept_ids=[123]
    )["includedCovariateConceptIds"] == [123],
    "create_target_comparator_outcomes: included_covariate_concept_ids absent by default, present when supplied"
)

# =============================================================================
# Pinned default VALUES — never change these
# =============================================================================

check(
    sb.create_get_db_cohort_method_data_args()["washoutPeriod"] == 365,
    "create_get_db_cohort_method_data_args: washout_period default is still 365"
)

check(
    sb.create_fit_outcome_model_args()["modelType"] == "cox",
    "create_fit_outcome_model_args: model_type default is still 'cox'"
)

check(
    sb.create_stratify_by_ps_args()["numberOfStrata"] == 10,
    "create_stratify_by_ps_args: number_of_strata default is still 10"
)

check(
    sb.create_cm_diagnostic_thresholds()["generalizabilitySdmThreshold"] == 999,
    "create_cm_diagnostic_thresholds: generalizability_sdm_threshold default is still 999"
)

check(
    sb.create_trim_by_ps_args()["trimFraction"] is None,
    "create_trim_by_ps_args: trim_fraction default is still None"
)

# =============================================================================
# Removed/renamed arguments (16) — each stays in its original positional slot,
# guarded, and raises naming "5.5.2" for both a keyword and a positional call.
# =============================================================================

# --- create_get_db_cohort_method_data_args: nesting_cohort_id(5), min_age(7), max_age(8),
# --- gender_concept_ids(9) ---

expect_removed(
    "create_get_db_cohort_method_data_args(nesting_cohort_id=...)", sb.create_get_db_cohort_method_data_args,
    "nesting_cohort_id", 1,
    (sb.create_default_covariate_settings(), "keep first, truncate to second", True, 365, 1)
)

expect_removed(
    "create_get_db_cohort_method_data_args(min_age=...)", sb.create_get_db_cohort_method_data_args,
    "min_age", 18,
    (sb.create_default_covariate_settings(), "keep first, truncate to second", True, 365, None, True, 18),
    positional_guard_arg="nesting_cohort_id"
)

expect_removed(
    "create_get_db_cohort_method_data_args(max_age=...)", sb.create_get_db_cohort_method_data_args,
    "max_age", 65,
    (sb.create_default_covariate_settings(), "keep first, truncate to second", True, 365, None, True, None, 65),
    positional_guard_arg="nesting_cohort_id"
)

expect_removed(
    "create_get_db_cohort_method_data_args(gender_concept_ids=...)", sb.create_get_db_cohort_method_data_args,
    "gender_concept_ids", 8507,
    (sb.create_default_covariate_settings(), "keep first, truncate to second", True, 365, None, True, None, None, 8507),
    positional_guard_arg="nesting_cohort_id"
)

# --- create_trim_by_ps_args: equipoise_bounds(2), max_weight(3), trim_method(4) ---

expect_removed(
    "create_trim_by_ps_args(equipoise_bounds=...)", sb.create_trim_by_ps_args,
    "equipoise_bounds", [0.3, 0.7],
    (None, [0.3, 0.7])
)

expect_removed(
    "create_trim_by_ps_args(max_weight=...)", sb.create_trim_by_ps_args,
    "max_weight", 10,
    (None, None, 10),
    positional_guard_arg="equipoise_bounds"
)

expect_removed(
    "create_trim_by_ps_args(trim_method=...)", sb.create_trim_by_ps_args,
    "trim_method", "one-sided",
    (None, None, None, "one-sided"),
    positional_guard_arg="equipoise_bounds"
)

# --- create_match_on_ps_args: match_columns(5), match_covariate_ids(6) ---

expect_removed(
    "create_match_on_ps_args(match_columns=...)", sb.create_match_on_ps_args,
    "match_columns", "x",
    (0.2, "standardized logit", 1, False, "x")
)

expect_removed(
    "create_match_on_ps_args(match_covariate_ids=...)", sb.create_match_on_ps_args,
    "match_covariate_ids", 123,
    (0.2, "standardized logit", 1, False, None, 123),
    positional_guard_arg="match_columns"
)

# --- create_stratify_by_ps_args: stratification_covariate_ids(4) ---

expect_removed(
    "create_stratify_by_ps_args(stratification_covariate_ids=...)", sb.create_stratify_by_ps_args,
    "stratification_covariate_ids", 123,
    (10, "all", [], 123)
)

# --- create_compute_covariate_balance_args: threshold(4), alpha(5) ---

expect_removed(
    "create_compute_covariate_balance_args(threshold=...)", sb.create_compute_covariate_balance_args,
    "threshold", 0.1,
    (None, 250000, None, 0.1)
)

expect_removed(
    "create_compute_covariate_balance_args(alpha=...)", sb.create_compute_covariate_balance_args,
    "alpha", 0.05,
    (None, 250000, None, None, 0.05),
    positional_guard_arg="threshold"
)

# --- create_fit_outcome_model_args: bootstrap_ci(5), bootstrap_replicates(6) ---

expect_removed(
    "create_fit_outcome_model_args(bootstrap_ci=...)", sb.create_fit_outcome_model_args,
    "bootstrap_ci", True,
    ("cox", False, False, False, True)
)

expect_removed(
    "create_fit_outcome_model_args(bootstrap_replicates=...)", sb.create_fit_outcome_model_args,
    "bootstrap_replicates", 100,
    ("cox", False, False, False, None, 100),
    positional_guard_arg="bootstrap_ci"
)

# --- create_cm_diagnostic_thresholds: sdm_alpha(4) ---

expect_removed(
    "create_cm_diagnostic_thresholds(sdm_alpha=...)", sb.create_cm_diagnostic_thresholds,
    "sdm_alpha", 0.05,
    (10, 0.25, 0.1, 0.05)
)

# --- create_target_comparator_outcomes: nesting_cohort_id(4) ---

expect_removed(
    "create_target_comparator_outcomes(nesting_cohort_id=...)", sb.create_target_comparator_outcomes,
    "nesting_cohort_id", 99,
    (1, 2, [], 99),
    required_kwargs={"target_id": 1, "comparator_id": 2, "outcomes": []}
)

# =============================================================================
# create_cm_analysis: every *_args slot is type-checked (_class == "args"). Four slots
# (trim_by_ps_to_equipoise_args, trim_by_iptw_args, match_on_ps_and_covariates_args,
# stratify_by_ps_and_covariates_args) were inserted mid-signature to match CohortMethod
# 5.5.2's order, shifting six existing slots. All 14 *_args slots are None-defaulted
# with no type check on their own, so a legacy positional call site could bind an
# object into the wrong slot and produce a structurally valid but semantically wrong
# spec, silently. Assert a wrongly-typed value in ANY slot raises, naming that slot,
# instead.
# =============================================================================

WRONG_TYPED_ARGS_OBJECT = {"foo": 1, "_class": "outcome"}


def expect_cm_analysis_slot_type_error(slot_name):
    call_kwargs = {
        "get_db_cohort_method_data_args": sb.create_get_db_cohort_method_data_args(),
        "create_study_pop_args": sb.create_create_study_population_args(),
    }
    call_kwargs[slot_name] = WRONG_TYPED_ARGS_OBJECT
    try:
        sb.create_cm_analysis(**call_kwargs)
        error = None
    except TypeError as e:
        error = e
    check(
        error is not None and slot_name in str(error),
        f"create_cm_analysis({slot_name}=<wrong class>): raises, naming '{slot_name}'"
    )


for slot_name in [
    "get_db_cohort_method_data_args", "create_study_pop_args", "create_ps_args",
    "trim_by_ps_args", "trim_by_ps_to_equipoise_args", "trim_by_iptw_args",
    "truncate_iptw_args", "match_on_ps_args", "match_on_ps_and_covariates_args",
    "stratify_by_ps_args", "stratify_by_ps_and_covariates_args",
    "compute_shared_covariate_balance_args", "compute_covariate_balance_args",
    "fit_outcome_model_args"
]:
    expect_cm_analysis_slot_type_error(slot_name)

try:
    sb.create_cm_analysis(
        get_db_cohort_method_data_args=sb.create_get_db_cohort_method_data_args(),
        create_study_pop_args=sb.create_create_study_population_args(),
        create_ps_args=sb.create_create_ps_args(),
        trim_by_ps_args=sb.create_trim_by_ps_args(),
        truncate_iptw_args=sb.create_truncate_iptw_args(),
        match_on_ps_args=sb.create_match_on_ps_args(),
        stratify_by_ps_args=sb.create_stratify_by_ps_args(),
        compute_covariate_balance_args=sb.create_compute_covariate_balance_args(),
        fit_outcome_model_args=sb.create_fit_outcome_model_args()
    )
    no_error = True
except TypeError:
    no_error = False
check(no_error, "create_cm_analysis: correctly-typed slots (_class == 'args') do not raise")

# Every constructor stamps the same "args" _class, so the guard tells slots apart by
# field names: a real constructor object in the wrong slot must raise too.
BASE_KWARGS = {
    "get_db_cohort_method_data_args": sb.create_get_db_cohort_method_data_args(),
    "create_study_pop_args": sb.create_create_study_population_args(),
}


def cm_analysis_error(**kwargs):
    try:
        sb.create_cm_analysis(**{**BASE_KWARGS, **kwargs})
        return None
    except TypeError as e:
        return str(e)


err = cm_analysis_error(trim_by_ps_args=sb.create_match_on_ps_args())
check(err is not None and "trim_by_ps_args" in err and "create_match_on_ps_args" in err,
      "create_cm_analysis(trim_by_ps_args=create_match_on_ps_args()): raises, naming the slot "
      "and the constructor it looks like")

err = cm_analysis_error(fit_outcome_model_args=sb.create_create_ps_args())
check(err is not None and "fit_outcome_model_args" in err,
      "create_cm_analysis(fit_outcome_model_args=create_create_ps_args()): raises")

check(cm_analysis_error(
    create_ps_args=sb.create_create_ps_args(exclude_covariate_ids=[1, 2]),
    match_on_ps_args=sb.create_match_on_ps_args(stratification_columns=["a"]),
    compute_covariate_balance_args=sb.create_compute_covariate_balance_args(subgroup_covariate_id=1),
    fit_outcome_model_args=sb.create_fit_outcome_model_args(profile_grid=[0, 1]),
) is None, "create_cm_analysis: constructor objects carrying optional fields still match their slot")

# Pre-5.5.2 positional order: (..., create_ps_args, trim_by_ps_args, truncate_iptw_args,
# match_on_ps_args, ...). Under the 5.5.2 order truncate_iptw_args lands in
# trim_by_ps_to_equipoise_args, which must raise rather than silently mis-bind.
try:
    sb.create_cm_analysis(
        1, "legacy positional",
        sb.create_get_db_cohort_method_data_args(), sb.create_create_study_population_args(),
        sb.create_create_ps_args(), sb.create_trim_by_ps_args(),
        sb.create_truncate_iptw_args(), sb.create_match_on_ps_args()
    )
    legacy_err = None
except TypeError as e:
    legacy_err = str(e)
check(legacy_err is not None and "trim_by_ps_to_equipoise_args" in legacy_err,
      "create_cm_analysis: legacy positional call raises at the first shifted slot")

for slot_name, analysis_key in {
    "trim_by_ps_to_equipoise_args": "trimByPsToEquipoiseArgs",
    "trim_by_iptw_args": "trimByIptwArgs",
    "match_on_ps_and_covariates_args": "matchOnPsAndCovariatesArgs",
    "stratify_by_ps_and_covariates_args": "stratifyByPsAndCovariatesArgs",
    "compute_shared_covariate_balance_args": "computeSharedCovariateBalanceArgs",
}.items():
    try:
        analysis = sb.create_cm_analysis(**{**BASE_KWARGS, slot_name: {"someField": 1}})
    except TypeError:
        analysis = None
    check(analysis is not None and analysis.get(analysis_key, {}).get("_class") == "args",
          f"create_cm_analysis({slot_name}=<hand-built dict>): accepted and stamped _class 'args'")

    err = cm_analysis_error(**{slot_name: sb.create_truncate_iptw_args()})
    check(err is not None and slot_name in err,
          f"create_cm_analysis({slot_name}=create_truncate_iptw_args()): constructor object "
          "rejected in hand-set slot")

# =============================================================================

if FAILURES > 0:
    print(f"\n{FAILURES} check(s) FAILED.")
    sys.exit(1)
else:
    print("\nAll checks PASSED.")
    sys.exit(0)
