"""
Strategus Spec Builder for Pyodide

Standalone Strategus Analysis Specification Builder for Pyodide (browser-based Python).
This module provides functions to create Strategus analysis specifications
without requiring Java dependencies or R packages.

Usage:
    # In Pyodide (browser)
    from strategus_spec_builder import *

    # Or load from URL
    import pyodide_http
    pyodide_http.patch_all()
    exec(requests.get("https://raw.githubusercontent.com/OHDSI/Strategus/main/inst/pyodide/strategus_spec_builder.py").text)

Dependencies:
    - None (pure Python, works in Pyodide)

Based on Strategus v1.4.1

HADES Package Version Tracking (for maintenance):
    - CohortMethod 5.4.0
    - CohortDiagnostics 3.3.0
    - FeatureExtraction 3.7.0
    - Characterization 2.0.0

Note: Default settings are inlined from the HADES packages listed above.
If HADES package defaults change, this file may need updates.
"""

from __future__ import annotations
import json
import math
from dataclasses import dataclass, field, asdict
from typing import Any, Optional, Union


# =============================================================================
# Specification Classes
# =============================================================================

@dataclass
class AnalysisSpecifications:
    """Container for Strategus analysis specifications."""
    shared_resources: list = field(default_factory=list)
    module_specifications: list = field(default_factory=list)
    _class: str = field(default="AnalysisSpecifications", repr=False)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "sharedResources": self.shared_resources,
            "moduleSpecifications": self.module_specifications
        }

    def to_json(self, pretty: bool = True) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=2 if pretty else None)


@dataclass
class SharedResources:
    """Base class for shared resources."""
    _class: tuple = field(default=("SharedResources",), repr=False)

    def to_dict(self) -> dict:
        """Convert to dictionary, excluding private fields."""
        result = {}
        for k, v in self.__dict__.items():
            if not k.startswith("_"):
                result[k] = v
        return result


@dataclass
class ModuleSpecifications:
    """Base class for module specifications."""
    module: str
    settings: dict
    _class: tuple = field(default=("ModuleSpecifications",), repr=False)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "module": self.module,
            "settings": self.settings
        }


# =============================================================================
# Internal Helper Functions
# =============================================================================

def _is_cohort_definition_set(df: list[dict]) -> bool:
    """Validate cohort definition set structure."""
    if not isinstance(df, list) or len(df) == 0:
        return False
    required_cols = {"cohortId", "cohortName", "sql", "json"}
    return all(required_cols.issubset(row.keys()) for row in df)


def _listafy(df: list[dict]) -> list[dict]:
    """Convert cohort definition set to list format for JSON."""
    result = []
    for row in df:
        cohort_data = {
            "cohortId": row["cohortId"],
            "cohortName": row["cohortName"],
            "cohortDefinition": row["json"]
        }
        result.append(cohort_data)
    return result


# =============================================================================
# Inlined Default Settings (from HADES packages)
# =============================================================================

def _create_default_cm_diagnostic_thresholds() -> dict:
    """CohortMethod diagnostic thresholds (from CohortMethod::createCmDiagnosticThresholds)."""
    return {
        "mdrrThreshold": 10,
        "easeThreshold": 0.25,
        "sdmThreshold": 0.1,
        "equipoiseThreshold": 0.2,
        "generalizabilitySdmThreshold": 1,
        "_class": "CmDiagnosticThresholds"
    }


def _create_default_es_diagnostic_thresholds() -> dict:
    """Evidence Synthesis diagnostic thresholds."""
    return {
        "mdrrThreshold": 10,
        "easeThreshold": 0.25,
        "i2Threshold": 0.4,
        "tauThreshold": math.log(2),  # ~0.693
        "_class": "EsDiagnosticThresholds"
    }


def _get_default_characterization_covariate_settings() -> dict:
    """Characterization covariate settings (from FeatureExtraction)."""
    return {
        "temporal": False,
        "temporalSequence": False,
        # Demographics - all enabled
        "useDemographicsGender": True,
        "useDemographicsAge": True,
        "useDemographicsAgeGroup": True,
        "useDemographicsRace": True,
        "useDemographicsEthnicity": True,
        "useDemographicsIndexYear": True,
        "useDemographicsIndexMonth": True,
        "useDemographicsTimeInCohort": True,
        "useDemographicsPriorObservationTime": True,
        "useDemographicsPostObservationTime": True,
        # Long term covariates
        "useConditionGroupEraLongTerm": True,
        "useDrugGroupEraOverlapping": True,
        "useDrugGroupEraLongTerm": True,
        "useProcedureOccurrenceLongTerm": True,
        "useMeasurementLongTerm": True,
        "useObservationLongTerm": True,
        "useDeviceExposureLongTerm": True,
        "useVisitConceptCountLongTerm": True,
        # Short term covariates
        "useConditionGroupEraShortTerm": True,
        "useDrugGroupEraShortTerm": True,
        "useProcedureOccurrenceShortTerm": True,
        "useMeasurementShortTerm": True,
        "useObservationShortTerm": True,
        "useDeviceExposureShortTerm": True,
        "useVisitConceptCountShortTerm": True,
        # Time windows
        "endDays": 0,
        "longTermStartDays": -365,
        "shortTermStartDays": -30,
        # Concept filtering
        "includedCovariateConceptIds": [],
        "excludedCovariateConceptIds": [],
        "includedCovariateIds": [],
        "addDescendantsToInclude": False,
        "addDescendantsToExclude": False,
        "_class": "covariateSettings",
        "_fun": "getDbCovariateData"
    }


def _get_default_case_covariate_settings() -> dict:
    """Characterization case (during) covariate settings."""
    return {
        "useConditionGroupEraDuring": True,
        "useDrugGroupEraDuring": True,
        "useProcedureOccurrenceDuring": True,
        "useDeviceExposureDuring": True,
        "useMeasurementDuring": True,
        "useObservationDuring": True,
        "useVisitConceptCountDuring": True,
        "_class": "covariateSettings",
        "_fun": "Characterization::getDuringCovariateData"
    }


def _get_default_temporal_covariate_settings() -> dict:
    """CohortDiagnostics temporal covariate settings."""
    return {
        "temporal": True,
        "temporalSequence": False,
        # Condition covariates
        "useConditionEraGroupStart": True,
        "useConditionEraGroupOverlap": True,
        # Drug covariates
        "useDrugEraGroupStart": True,
        "useDrugEraGroupOverlap": True,
        # Visit covariates
        "useVisitConceptCountStart": True,
        "useVisitConceptCountOverlap": True,
        # Time windows (mandatory for CohortDiagnostics)
        "temporalStartDays": [-365, -30, -365, -30, 0, 1, 31, -9999],
        "temporalEndDays": [0, 0, -31, -1, 0, 30, 365, 9999],
        # Concept filtering
        "includedCovariateConceptIds": [],
        "excludedCovariateConceptIds": [],
        "includedCovariateIds": [],
        "addDescendantsToInclude": False,
        "addDescendantsToExclude": False,
        "_class": "covariateSettings",
        "_fun": "getDbCovariateData"
    }


# =============================================================================
# Core Public Functions (User Story 1)
# =============================================================================

def create_empty_analysis_specifications() -> AnalysisSpecifications:
    """
    Create an empty analysis specifications object.

    Returns:
        An AnalysisSpecifications object with empty shared_resources and module_specifications.

    Example:
        >>> spec = create_empty_analysis_specifications()
        >>> print(spec.to_json())
    """
    return AnalysisSpecifications()


def add_shared_resources(
    analysis_specifications: AnalysisSpecifications,
    shared_resources: dict
) -> AnalysisSpecifications:
    """
    Add shared resources to analysis specifications.

    Args:
        analysis_specifications: The analysis specifications to modify.
        shared_resources: A shared resources dictionary.

    Returns:
        The modified analysis specifications.

    Raises:
        TypeError: If inputs are not the correct type.
    """
    if not isinstance(analysis_specifications, AnalysisSpecifications):
        raise TypeError("analysis_specifications must be an AnalysisSpecifications object")
    if not isinstance(shared_resources, dict):
        raise TypeError("shared_resources must be a dictionary")

    analysis_specifications.shared_resources.append(shared_resources)
    return analysis_specifications


def add_module_specifications(
    analysis_specifications: AnalysisSpecifications,
    module_specifications: dict
) -> AnalysisSpecifications:
    """
    Add module specifications to analysis specifications.

    Args:
        analysis_specifications: The analysis specifications to modify.
        module_specifications: A module specifications dictionary.

    Returns:
        The modified analysis specifications.

    Raises:
        TypeError: If inputs are not the correct type.
    """
    if not isinstance(analysis_specifications, AnalysisSpecifications):
        raise TypeError("analysis_specifications must be an AnalysisSpecifications object")
    if not isinstance(module_specifications, dict):
        raise TypeError("module_specifications must be a dictionary")

    analysis_specifications.module_specifications.append(module_specifications)
    return analysis_specifications


# =============================================================================
# Shared Resource Functions (User Story 2)
# =============================================================================

def create_cohort_shared_resource_specifications(
    cohort_definition_set: list[dict]
) -> dict:
    """
    Create cohort shared resource specifications.

    Args:
        cohort_definition_set: A list of dictionaries with keys:
            cohortId, cohortName, sql, json.
            Optionally: isSubset, subsetParent, subsetDefinitionId.

    Returns:
        A shared resources dictionary for cohort definitions.

    Raises:
        ValueError: If cohort_definition_set is not properly defined.

    Example:
        >>> cohorts = [
        ...     {"cohortId": 1, "cohortName": "Target", "sql": "SELECT...", "json": "{}"},
        ...     {"cohortId": 2, "cohortName": "Outcome", "sql": "SELECT...", "json": "{}"}
        ... ]
        >>> shared = create_cohort_shared_resource_specifications(cohorts)
    """
    if not _is_cohort_definition_set(cohort_definition_set):
        raise ValueError(
            "cohort_definition_set is not properly defined. "
            "Required keys: cohortId, cohortName, sql, json"
        )

    # Check for subset definitions
    has_subsets = any(
        row.get("isSubset", False) for row in cohort_definition_set
    )

    if has_subsets:
        parent_cohorts = [r for r in cohort_definition_set if not r.get("isSubset", False)]
    else:
        parent_cohorts = cohort_definition_set

    shared_resource = {
        "cohortDefinitions": _listafy(parent_cohorts),
        "_class": ("CohortDefinitionSharedResources", "SharedResources")
    }

    if has_subsets:
        subset_cohorts = [r for r in cohort_definition_set if r.get("isSubset", False)]
        subset_id_mapping = []
        for row in subset_cohorts:
            id_mapping = {
                "cohortId": row["cohortId"],
                "subsetId": row.get("subsetDefinitionId"),
                "targetCohortId": row.get("subsetParent")
            }
            subset_id_mapping.append(id_mapping)
        shared_resource["cohortSubsets"] = subset_id_mapping

    return shared_resource


def create_negative_control_outcome_cohort_shared_resource_specifications(
    negative_control_outcome_cohort_set: list[dict],
    occurrence_type: str,
    detect_on_descendants: bool
) -> dict:
    """
    Create negative control outcome cohort shared resource specifications.

    Args:
        negative_control_outcome_cohort_set: List of dicts with cohortId, cohortName, outcomeConceptId.
        occurrence_type: Either "first" or "all".
        detect_on_descendants: Whether to detect on descendant concepts.

    Returns:
        A shared resources dictionary for negative control outcomes.
    """
    return {
        "negativeControlOutcomes": {
            "negativeControlOutcomeCohortSet": negative_control_outcome_cohort_set,
            "occurrenceType": occurrence_type,
            "detectOnDescendants": detect_on_descendants
        },
        "_class": ("NegativeControlOutcomeSharedResources", "SharedResources")
    }


# =============================================================================
# Module Specification Functions (User Story 3)
# =============================================================================

def create_cohort_generator_module_specifications(
    generate_stats: bool = True
) -> dict:
    """Create CohortGenerator module specifications."""
    return {
        "module": "CohortGeneratorModule",
        "settings": {
            "generateStats": generate_stats
        },
        "_class": ("ModuleSpecifications", "CohortGeneratorModuleSpecifications")
    }


def create_cohort_diagnostics_module_specifications(
    cohort_ids: Optional[list[int]] = None,
    run_inclusion_statistics: bool = True,
    run_included_source_concepts: bool = True,
    run_orphan_concepts: bool = True,
    run_time_series: bool = False,
    run_visit_context: bool = True,
    run_breakdown_index_events: bool = True,
    run_incidence_rate: bool = True,
    run_cohort_relationship: bool = True,
    run_temporal_cohort_characterization: bool = True,
    temporal_covariate_settings: Optional[dict] = None,
    min_characterization_mean: float = 0.01,
    ir_washout_period: int = 0
) -> dict:
    """Create CohortDiagnostics module specifications."""
    if temporal_covariate_settings is None:
        temporal_covariate_settings = _get_default_temporal_covariate_settings()

    return {
        "module": "CohortDiagnosticsModule",
        "settings": {
            "cohortIds": cohort_ids,
            "runInclusionStatistics": run_inclusion_statistics,
            "runIncludedSourceConcepts": run_included_source_concepts,
            "runOrphanConcepts": run_orphan_concepts,
            "runTimeSeries": run_time_series,
            "runVisitContext": run_visit_context,
            "runBreakdownIndexEvents": run_breakdown_index_events,
            "runIncidenceRate": run_incidence_rate,
            "runCohortRelationship": run_cohort_relationship,
            "runTemporalCohortCharacterization": run_temporal_cohort_characterization,
            "temporalCovariateSettings": temporal_covariate_settings,
            "minCharacterizationMean": min_characterization_mean,
            "irWashoutPeriod": ir_washout_period
        },
        "_class": ("ModuleSpecifications", "CohortDiagnosticsModuleSpecifications")
    }


def create_cohort_incidence_module_specifications(
    ir_design: Optional[dict] = None
) -> dict:
    """Create CohortIncidence module specifications."""
    return {
        "module": "CohortIncidenceModule",
        "settings": {
            "irDesign": ir_design
        },
        "_class": ("ModuleSpecifications", "CohortIncidenceModuleSpecifications")
    }


def create_cohort_method_module_specifications(
    cm_analysis_list: list,
    target_comparator_outcomes_list: list,
    analyses_to_exclude: Optional[list] = None,
    refit_ps_for_every_outcome: bool = False,
    refit_ps_for_every_study_population: bool = True,
    cm_diagnostic_thresholds: Optional[dict] = None
) -> dict:
    """Create CohortMethod module specifications."""
    if cm_diagnostic_thresholds is None:
        cm_diagnostic_thresholds = _create_default_cm_diagnostic_thresholds()

    return {
        "module": "CohortMethodModule",
        "settings": {
            "cmAnalysisList": cm_analysis_list,
            "targetComparatorOutcomesList": target_comparator_outcomes_list,
            "analysesToExclude": analyses_to_exclude,
            "refitPsForEveryOutcome": refit_ps_for_every_outcome,
            "refitPsForEveryStudyPopulation": refit_ps_for_every_study_population,
            "cmDiagnosticThresholds": cm_diagnostic_thresholds
        },
        "_class": ("ModuleSpecifications", "CohortMethodModuleSpecifications")
    }


def create_characterization_module_specifications(
    target_ids: list[int],
    outcome_ids: list[int],
    outcome_washout_days: list[int] = None,
    min_prior_observation: int = 365,
    dechallenge_stop_interval: int = 30,
    dechallenge_evaluation_window: int = 30,
    risk_window_start: list[int] = None,
    start_anchor: list[str] = None,
    risk_window_end: list[int] = None,
    end_anchor: list[str] = None,
    min_characterization_mean: float = 0.01,
    covariate_settings: Optional[dict] = None,
    case_covariate_settings: Optional[dict] = None
) -> dict:
    """Create Characterization module specifications."""
    if outcome_washout_days is None:
        outcome_washout_days = [365]
    if risk_window_start is None:
        risk_window_start = [1, 1]
    if start_anchor is None:
        start_anchor = ["cohort start", "cohort start"]
    if risk_window_end is None:
        risk_window_end = [0, 365]
    if end_anchor is None:
        end_anchor = ["cohort end", "cohort end"]
    if covariate_settings is None:
        covariate_settings = _get_default_characterization_covariate_settings()
    if case_covariate_settings is None:
        case_covariate_settings = _get_default_case_covariate_settings()

    return {
        "module": "CharacterizationModule",
        "settings": {
            "targetIds": target_ids,
            "outcomeIds": outcome_ids,
            "outcomeWashoutDays": outcome_washout_days,
            "minPriorObservation": min_prior_observation,
            "dechallengeStopInterval": dechallenge_stop_interval,
            "dechallengeEvaluationWindow": dechallenge_evaluation_window,
            "riskWindowStart": risk_window_start,
            "startAnchor": start_anchor,
            "riskWindowEnd": risk_window_end,
            "endAnchor": end_anchor,
            "minCharacterizationMean": min_characterization_mean,
            "covariateSettings": covariate_settings,
            "caseCovariateSettings": case_covariate_settings
        },
        "_class": ("ModuleSpecifications", "CharacterizationModuleSpecifications")
    }


def create_patient_level_prediction_module_specifications(
    model_design_list: list,
    skip_diagnostics: bool = False
) -> dict:
    """Create PatientLevelPrediction module specifications."""
    return {
        "module": "PatientLevelPredictionModule",
        "settings": {
            "modelDesignList": model_design_list,
            "skipDiagnostics": skip_diagnostics
        },
        "_class": ("ModuleSpecifications", "PatientLevelPredictionModuleSpecifications")
    }


def create_patient_level_prediction_validation_module_specifications(
    validation_list: list
) -> dict:
    """Create PatientLevelPrediction Validation module specifications."""
    return {
        "module": "PatientLevelPredictionValidationModule",
        "settings": {
            "validationList": validation_list
        },
        "_class": ("ModuleSpecifications", "PatientLevelPredictionValidationModuleSpecifications")
    }


def create_self_controlled_case_series_module_specifications(
    sccs_analyses_specifications: dict
) -> dict:
    """Create SelfControlledCaseSeries module specifications."""
    return {
        "module": "SelfControlledCaseSeriesModule",
        "settings": {
            "sccsAnalysesSpecifications": sccs_analyses_specifications
        },
        "_class": ("ModuleSpecifications", "SelfControlledCaseSeriesModuleSpecifications")
    }


def create_evidence_synthesis_module_specifications(
    evidence_synthesis_analysis_list: list,
    es_diagnostic_thresholds: Optional[dict] = None
) -> dict:
    """Create EvidenceSynthesis module specifications."""
    if es_diagnostic_thresholds is None:
        es_diagnostic_thresholds = _create_default_es_diagnostic_thresholds()

    return {
        "module": "EvidenceSynthesisModule",
        "settings": {
            "evidenceSynthesisAnalysisList": evidence_synthesis_analysis_list,
            "esDiagnosticThresholds": es_diagnostic_thresholds
        },
        "_class": ("ModuleSpecifications", "EvidenceSynthesisModuleSpecifications")
    }


def create_treatment_patterns_module_specifications(
    cohorts: list[dict],
    include_treatments: Optional[list] = None,
    index_date_offset: Optional[int] = None,
    min_era_duration: int = 0,
    split_event_cohorts: Optional[list] = None,
    split_time: Optional[int] = None,
    era_collapse_size: int = 30,
    combination_window: int = 30,
    min_post_combination_duration: int = 30,
    filter_treatments: str = "First",
    max_path_length: int = 5,
    age_window: int = 5,
    min_cell_count: int = 1,
    censor_type: str = "minCellCount",
    overlap_method: str = "truncate",
    concat_targets: bool = True
) -> dict:
    """Create TreatmentPatterns module specifications."""
    return {
        "module": "TreatmentPatternsModule",
        "settings": {
            "cohorts": cohorts,
            "includeTreatments": include_treatments,
            "indexDateOffset": index_date_offset,
            "minEraDuration": min_era_duration,
            "splitEventCohorts": split_event_cohorts,
            "splitTime": split_time,
            "eraCollapseSize": era_collapse_size,
            "combinationWindow": combination_window,
            "minPostCombinationDuration": min_post_combination_duration,
            "filterTreatments": filter_treatments,
            "maxPathLength": max_path_length,
            "ageWindow": age_window,
            "minCellCount": min_cell_count,
            "censorType": censor_type,
            "overlapMethod": overlap_method,
            "concatTargets": concat_targets
        },
        "_class": ("ModuleSpecifications", "TreatmentPatternsModuleSpecifications")
    }


# =============================================================================
# Convenience Functions
# =============================================================================

def to_json(analysis_specifications: AnalysisSpecifications, pretty: bool = True) -> str:
    """
    Serialize analysis specifications to JSON.

    Args:
        analysis_specifications: The specifications to serialize.
        pretty: Whether to format with indentation.

    Returns:
        JSON string.
    """
    return analysis_specifications.to_json(pretty=pretty)


def save_to_json(analysis_specifications: AnalysisSpecifications, filepath: str) -> None:
    """
    Save analysis specifications to a JSON file.

    Args:
        analysis_specifications: The specifications to save.
        filepath: Path to the output file.
    """
    with open(filepath, "w") as f:
        f.write(analysis_specifications.to_json(pretty=True))


# =============================================================================
# Example Usage
# =============================================================================

if __name__ == "__main__":
    # Example: Create a complete analysis specification

    # Step 1: Create empty specification
    spec = create_empty_analysis_specifications()

    # Step 2: Add cohort definitions
    cohort_definition_set = [
        {"cohortId": 1, "cohortName": "Type 2 Diabetes", "sql": "-- SQL", "json": "{}"},
        {"cohortId": 2, "cohortName": "Metformin Users", "sql": "-- SQL", "json": "{}"},
        {"cohortId": 3, "cohortName": "GI Bleed", "sql": "-- SQL", "json": "{}"}
    ]
    cohort_shared = create_cohort_shared_resource_specifications(cohort_definition_set)
    spec = add_shared_resources(spec, cohort_shared)

    # Step 3: Add modules
    spec = add_module_specifications(
        spec,
        create_cohort_generator_module_specifications(generate_stats=True)
    )
    spec = add_module_specifications(
        spec,
        create_cohort_diagnostics_module_specifications(
            run_inclusion_statistics=True,
            run_incidence_rate=True
        )
    )
    spec = add_module_specifications(
        spec,
        create_characterization_module_specifications(
            target_ids=[1, 2],
            outcome_ids=[3]
        )
    )

    # Step 4: Serialize to JSON
    print(spec.to_json())
