"""strategus_spec_builder_characterization.test.py

Verifies that create_characterization_module_specifications emits a settings
object matching the installed Strategus::CharacterizationModule layout:

  settings = { analysis: <characterizationSettings>, minCharacterizationMean }

Previously the builder flattened all user inputs into settings, which produced
settings.analysis = NULL at runtime and failed Strategus' assertion:

  Variable 'settings': Must inherit from class 'characterizationSettings',
  but has class 'NULL'

Also verifies _get_default_case_covariate_settings routes through
create_during_covariate_settings so Java-field names are prefix-free (fixes the
'use*'-prefixed keys that FeatureExtraction's createSql() cannot read).

Run: python3 plugins/notebook/tests/strategus_spec_builder_characterization.test.py
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

# =============================================================================
# _get_default_case_covariate_settings — prefix-free FIELD names
# =============================================================================

case = sb._get_default_case_covariate_settings()

check(
    not any(k.startswith("use") for k in case if isinstance(k, str)),
    "_get_default_case_covariate_settings(): no emitted key starts with 'use'"
)

check(
    case.get("_fun") == "Characterization::getDbDuringCovariateData",
    "_get_default_case_covariate_settings(): _fun == Characterization::getDbDuringCovariateData"
)

check(
    case.get("_class") == "covariateSettings",
    "_get_default_case_covariate_settings(): _class == covariateSettings"
)

for stripped in [
    "ConditionGroupEraDuring", "DrugGroupEraDuring", "ProcedureOccurrenceDuring",
    "DeviceExposureDuring", "MeasurementDuring", "ObservationDuring",
    "VisitConceptCountDuring",
]:
    check(
        case.get(stripped) is True,
        f"_get_default_case_covariate_settings(): {stripped} == True (prefix stripped)"
    )

# =============================================================================
# create_characterization_module_specifications — the user's actual notebook call
# cModule$createModuleSpecifications(
#   targetIds=[1,2], outcomeIds=3, minPriorObservation=0,
#   riskWindowStart=1, startAnchor="cohort start",
#   riskWindowEnd=99999, endAnchor="cohort start",
#   covariateSettings=<default>, minCharacterizationMean=0.01)
# =============================================================================

cov = sb._get_default_characterization_covariate_settings()
spec = sb.create_characterization_module_specifications(
    target_ids=[1, 2],
    outcome_ids=3,  # scalar — must be accepted
    min_prior_observation=0,
    risk_window_start=1,  # scalar — must be accepted
    start_anchor="cohort start",
    risk_window_end=99999,
    end_anchor="cohort start",
    covariate_settings=cov,
    min_characterization_mean=0.01,
)

check(spec.get("module") == "CharacterizationModule", "module name preserved")
settings = spec.get("settings", {})

check("analysis" in settings, "settings.analysis present")
check(
    isinstance(settings.get("analysis"), dict)
    and settings["analysis"].get("_class") == "characterizationSettings",
    "settings.analysis._class == characterizationSettings"
)

check(
    settings.get("minCharacterizationMean") == 0.01,
    "settings.minCharacterizationMean preserved at module level"
)

# All the flattened inputs should NOT be present at module level any more
for leaked in [
    "targetIds", "outcomeIds", "outcomeWashoutDays", "minPriorObservation",
    "dechallengeStopInterval", "dechallengeEvaluationWindow",
    "riskWindowStart", "startAnchor", "riskWindowEnd", "endAnchor",
    "covariateSettings", "caseCovariateSettings",
]:
    check(
        leaked not in settings,
        f"settings.{leaked} dropped from module-level (lives inside analysis sub-objects)"
    )

analysis = settings.get("analysis", {})

check(
    isinstance(analysis.get("timeToEventSettings"), list)
    and len(analysis["timeToEventSettings"]) == 1,
    "analysis.timeToEventSettings is a list of length 1"
)
check(
    analysis["timeToEventSettings"][0].get("targetIds") == [1, 2]
    and analysis["timeToEventSettings"][0].get("outcomeIds") == [3],
    "analysis.timeToEventSettings[0] wraps targetIds/outcomeIds as vectors"
)

check(
    isinstance(analysis.get("dechallengeRechallengeSettings"), list)
    and len(analysis["dechallengeRechallengeSettings"]) == 1,
    "analysis.dechallengeRechallengeSettings is a list of length 1"
)
drch = analysis["dechallengeRechallengeSettings"][0]
check(
    drch.get("dechallengeStopInterval") == 30
    and drch.get("dechallengeEvaluationWindow") == 30,
    "analysis.dechallengeRechallengeSettings carries default intervals"
)
# Characterization::getDechallengeRechallengeJobs reads targetCohortDefinitionIds /
# outcomeCohortDefinitionIds; using targetIds/outcomeIds here produces NULL extraction
# and a 0-row expand.grid, which later triggers "replacement has 1 row, data has 0".
check(
    drch.get("targetCohortDefinitionIds") == [1, 2]
    and drch.get("outcomeCohortDefinitionIds") == [3],
    "analysis.dechallengeRechallengeSettings uses targetCohortDefinitionIds / outcomeCohortDefinitionIds (not targetIds / outcomeIds)"
)
check(
    "targetIds" not in drch and "outcomeIds" not in drch,
    "analysis.dechallengeRechallengeSettings does NOT leak targetIds / outcomeIds"
)

check(
    isinstance(analysis.get("aggregateCovariateSettings"), list)
    and len(analysis["aggregateCovariateSettings"]) == 1,
    "analysis.aggregateCovariateSettings length = 1 risk window * 1 washout group"
)
agg = analysis["aggregateCovariateSettings"][0]
check(
    agg.get("riskWindowStart") == 1 and agg.get("riskWindowEnd") == 99999,
    "aggregate carries scalar risk-window values the user supplied"
)
check(
    agg.get("startAnchor") == "cohort start" and agg.get("endAnchor") == "cohort start",
    "aggregate carries anchors verbatim"
)
check(
    "covariateSettings" in agg and "caseCovariateSettings" in agg,
    "aggregate carries covariateSettings AND caseCovariateSettings INSIDE itself"
)

# Also test the multi-riskWindow × multi-washout expansion
spec2 = sb.create_characterization_module_specifications(
    target_ids=[1, 2],
    outcome_ids=[3, 4, 5],
    outcome_washout_days=[365, 180, 365],  # groups: {365: [3,5], 180: [4]}
    risk_window_start=[1, 1],
    start_anchor=["cohort start", "cohort start"],
    risk_window_end=[0, 365],
    end_anchor=["cohort end", "cohort end"],
    min_characterization_mean=0.01,
)
agg2 = spec2["settings"]["analysis"]["aggregateCovariateSettings"]
check(
    len(agg2) == 2 * 2,
    f"aggregateCovariateSettings length = len(riskWindow) * len(unique(washout)) = 4 (got {len(agg2)})"
)

# Length-mismatch validation (Strategus parity)
raised = False
try:
    sb.create_characterization_module_specifications(
        target_ids=[1], outcome_ids=[2],
        min_prior_observation=[0, 1],  # length > 1
        min_characterization_mean=0.01,
    )
except Exception:
    raised = True
check(raised, "minPriorObservation length > 1 raises")

raised = False
try:
    sb.create_characterization_module_specifications(
        target_ids=[1], outcome_ids=[2],
        risk_window_start=[1, 1], start_anchor=["cohort start"],  # mismatch
        risk_window_end=[0, 365], end_anchor=["cohort end", "cohort end"],
        min_characterization_mean=0.01,
    )
except Exception:
    raised = True
check(raised, "Time-at-risk vector length mismatch raises")

print()
if FAILURES == 0:
    print("All checks passed.")
    sys.exit(0)
print(f"{FAILURES} failure(s).")
sys.exit(1)
