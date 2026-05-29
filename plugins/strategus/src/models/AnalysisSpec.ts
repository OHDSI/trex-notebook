export interface AnalysisSpecification {
  sharedResources: SharedResource[];
  moduleSpecifications: ModuleSpecification[];
  attr_class: 'AnalysisSpecifications';
}

export type SharedResource =
  | CohortDefinitionSharedResources
  | NegativeControlOutcomeSharedResources;

export interface CohortDefinitionSharedResources {
  cohortDefinitions: CohortDefinitionEntry[];
  subsetDefs?: unknown[];
  cohortSubsets?: CohortSubset[];
  attr_class: ['CohortDefinitionSharedResources', 'SharedResources'];
}

export interface CohortDefinitionEntry {
  cohortId: number;
  cohortName: string;
  cohortDefinition: string;
}

export interface CohortSubset {
  cohortId: number;
  subsetId: number;
  targetCohortId: number;
}

export interface NegativeControlOutcomeSharedResources {
  negativeControlOutcomes: {
    negativeControlOutcomeCohortSet: NegativeControlEntry[];
    occurrenceType: 'first' | 'all';
    detectOnDescendants: boolean;
  };
  attr_class: ['NegativeControlOutcomeSharedResources', 'SharedResources'];
}

export interface NegativeControlEntry {
  cohortId: number;
  cohortName: string;
  outcomeConceptId: number;
}

export interface ModuleSpecification {
  module: ModuleName;
  settings: Record<string, unknown>;
  attr_class: [string, 'ModuleSpecifications'];
}

export type ModuleName =
  | 'CohortGeneratorModule'
  | 'CohortDiagnosticsModule'
  | 'CharacterizationModule'
  | 'CohortIncidenceModule'
  | 'CohortMethodModule'
  | 'SelfControlledCaseSeriesModule'
  | 'PatientLevelPredictionModule'
  | 'PatientLevelPredictionValidationModule'
  | 'TreatmentPatternsModule'
  | 'EvidenceSynthesisModule';
