"""strategus_spec_builder_covariate_settings.test.py

Verifies that the covariate-settings helpers in strategus_spec_builder.py emit objects
FeatureExtraction 3.11.0's Java createSql() can actually read. createSql() looks fields
up by exact name; the private default helper previously emitted use*-prefixed keys
(constructor ARGUMENT names) instead of the prefix-free FIELD names FeatureExtraction's
object actually carries. Python dicts do not drop keys the way `settings$x <- c()` does
in R, so create_default_covariate_settings() is unaffected there and is not asserted
against here beyond a supplied-value-preserved check.

Authoritative field sets are documented in
docs/superpowers/specs/2026-09-10-hades-object-field-sets-evidence.md.
Mirrors StrategusSpecBuilder-covariate-settings.test.R, adapted to snake_case.

Run: python3 plugins/notebook/tests/strategus_spec_builder_covariate_settings.test.py
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

ALWAYS_PRESENT_NON_FLAG_FIELDS = [
    "temporal", "temporalSequence", "longTermStartDays", "mediumTermStartDays",
    "shortTermStartDays", "endDays", "includedCovariateConceptIds",
    "addDescendantsToInclude", "excludedCovariateConceptIds", "addDescendantsToExclude",
    "includedCovariateIds",
]

# =============================================================================
# (a) + (b): _get_default_characterization_covariate_settings — prefix-free keys,
# mediumTermStartDays present
# =============================================================================

char_settings = sb._get_default_characterization_covariate_settings()

check(
    not any(k.startswith("use") for k in char_settings if isinstance(k, str)),
    "_get_default_characterization_covariate_settings(): no emitted key starts with 'use'"
)

check(
    all(f in char_settings for f in ALWAYS_PRESENT_NON_FLAG_FIELDS),
    "_get_default_characterization_covariate_settings(): all 11 always-present non-flag fields present"
)

check(
    char_settings.get("mediumTermStartDays") == -180,
    "_get_default_characterization_covariate_settings(): mediumTermStartDays == -180"
)

check(
    char_settings.get("longTermStartDays") == -365
    and char_settings.get("shortTermStartDays") == -30
    and char_settings.get("endDays") == 0,
    "_get_default_characterization_covariate_settings(): other day-window default VALUES unchanged"
)

check(
    char_settings.get("_fun") == "getDbCovariateData",
    "_get_default_characterization_covariate_settings(): _fun NOT touched (still getDbCovariateData)"
)

# =============================================================================
# create_default_covariate_settings — dicts don't drop keys; verify empty fields present
# and a supplied value is preserved
# =============================================================================

default_settings = sb.create_default_covariate_settings()

check(
    "includedCovariateConceptIds" in default_settings
    and default_settings["includedCovariateConceptIds"] == [],
    "create_default_covariate_settings(): includedCovariateConceptIds present as empty list"
)

check(
    "excludedCovariateConceptIds" in default_settings
    and default_settings["excludedCovariateConceptIds"] == [],
    "create_default_covariate_settings(): excludedCovariateConceptIds present as empty list"
)

check(
    "includedCovariateIds" in default_settings
    and default_settings["includedCovariateIds"] == [],
    "create_default_covariate_settings(): includedCovariateIds present as empty list"
)

supplied_settings = sb.create_default_covariate_settings(
    included_covariate_concept_ids=[1, 2, 3]
)
check(
    supplied_settings["includedCovariateConceptIds"] == [1, 2, 3],
    "create_default_covariate_settings(): a supplied value is preserved"
)

# =============================================================================
# create_covariate_settings(useDemographicsGender=True): exactly DemographicsGender +
# the 11 always-present non-flag fields
# =============================================================================

gender_only = sb.create_covariate_settings(useDemographicsGender=True)
emitted_keys = {k for k in gender_only if k not in ("_class", "_fun")}
check(
    emitted_keys == {"DemographicsGender", *ALWAYS_PRESENT_NON_FLAG_FIELDS}
    and len(emitted_keys) == 12,
    "create_covariate_settings(useDemographicsGender=True): emits exactly DemographicsGender + the 11 non-flag fields"
)

# =============================================================================
# (d) _get_default_temporal_covariate_settings — valid flag set, VisitConceptCount
# replacement, _fun == getDbDefaultCovariateData (scoped to this function only)
# =============================================================================

temporal_settings = sb._get_default_temporal_covariate_settings()

VALID_TEMPORAL_FLAGS = {
    "ConditionEraGroupStart", "ConditionEraGroupOverlap",
    "DrugEraGroupStart", "DrugEraGroupOverlap", "VisitConceptCount",
}

non_flag_fields = {
    "temporal", "temporalSequence", "temporalStartDays", "temporalEndDays",
    "includedCovariateConceptIds", "excludedCovariateConceptIds", "includedCovariateIds",
    "addDescendantsToInclude", "addDescendantsToExclude", "_class", "_fun",
}
emitted_flags = {k for k in temporal_settings if k not in non_flag_fields}

check(
    emitted_flags == VALID_TEMPORAL_FLAGS,
    "_get_default_temporal_covariate_settings(): flag set is exactly the 5 valid names"
)

check(
    "useVisitConceptCountStart" not in temporal_settings
    and "useVisitConceptCountOverlap" not in temporal_settings
    and "VisitConceptCountStart" not in temporal_settings
    and "VisitConceptCountOverlap" not in temporal_settings,
    "_get_default_temporal_covariate_settings(): excludes the two rejected VisitConceptCountStart/Overlap flags"
)

check(
    not any(k.startswith("use") for k in temporal_settings if isinstance(k, str)),
    "_get_default_temporal_covariate_settings(): no emitted key starts with 'use'"
)

check(
    len(temporal_settings["temporalStartDays"]) == len(temporal_settings["temporalEndDays"]),
    "_get_default_temporal_covariate_settings(): temporalStartDays/temporalEndDays are equal length"
)

check(
    temporal_settings.get("_fun") == "getDbDefaultCovariateData",
    "_get_default_temporal_covariate_settings(): _fun is getDbDefaultCovariateData (the worker), not getDbCovariateData"
)

# =============================================================================
# create_control — complete Cyclops 3.6.0 23-field control object, exact
# order, cv_type accepted but not emitted, _class cyclopsControl
# =============================================================================

CYCLOPS_CONTROL_FIELDS = [
    "maxIterations", "tolerance", "convergenceType", "autoSearch", "fold",
    "lowerLimit", "upperLimit", "gridSteps", "minCVData", "cvRepetitions",
    "noiseLevel", "threads", "seed", "resetCoefficients", "startingVariance",
    "useKKTSwindle", "tuneSwindle", "selectorType", "initialBound",
    "maxBoundCount", "algorithm", "doItAll", "syncCV",
]

control = sb.create_control()
control_keys = [k for k in control if k != "_class"]

check(
    set(control_keys) == set(CYCLOPS_CONTROL_FIELDS) and len(control_keys) == 23,
    "create_control(): emits exactly the 23 Cyclops 3.6.0 control fields",
)

check(
    control_keys == CYCLOPS_CONTROL_FIELDS,
    "create_control(): field order matches Cyclops 3.6.0 exactly",
)

check(
    "cvType" not in control,
    "create_control(): cvType is NOT emitted into the object",
)

check(
    control.get("_class") == "cyclopsControl",
    "create_control(): class is cyclopsControl",
)

# cv_type must still be accepted as a constructor argument without error
control_with_cv_type = sb.create_control(cv_type="auto")
check(
    "cvType" not in control_with_cv_type,
    "create_control(cv_type='auto'): accepted as an argument without error, still not emitted",
)

# Existing default VALUES must not change, even though they differ from
# Cyclops' own package defaults (deliberate project policy).
check(
    control["selectorType"] == "byPid",
    "create_control(): selectorType default VALUE unchanged ('byPid')",
)

check(
    control["startingVariance"] == 0.01,
    "create_control(): startingVariance default VALUE unchanged (0.01)",
)

# New-field default VALUES take Cyclops' own package defaults.
check(
    control["gridSteps"] == 10
    and control["minCVData"] == 100
    and control["useKKTSwindle"] is False
    and control["tuneSwindle"] == 10
    and control["initialBound"] == 2
    and control["maxBoundCount"] == 5
    and control["algorithm"] == "ccd"
    and control["doItAll"] is True
    and control["syncCV"] is False,
    "create_control(): new-field default VALUES match Cyclops' own package defaults",
)

# =============================================================================
# create_prior — regression: still exactly 7 fields (change nothing)
# =============================================================================

CYCLOPS_PRIOR_FIELDS = {
    "priorType", "variance", "exclude", "graph", "neighborhood",
    "useCrossValidation", "forceIntercept",
}

prior = sb.create_prior()
prior_keys = {k for k in prior if k != "_class"}

check(
    prior_keys == CYCLOPS_PRIOR_FIELDS and len(prior_keys) == 7,
    "create_prior(): still emits exactly the 7 Cyclops fields (regression)",
)

# =============================================================================

if FAILURES > 0:
    print(f"\n{FAILURES} check(s) FAILED.")
    sys.exit(1)
else:
    print("\nAll checks PASSED.")
    sys.exit(0)
