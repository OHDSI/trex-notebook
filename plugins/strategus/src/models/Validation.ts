export type ValidationStatus = 'valid' | 'warning' | 'error' | 'neutral';

export interface ValidationResult {
  status: ValidationStatus;
  message: string;
}

export type SidebarSection =
  | 'overview'
  | 'study'          // study design page (5 design sections)
  | 'modules'        // modules page (9 modules)
  | 'setup'
  | 'cohorts'
  | 'comparisons'
  | 'outcomes'
  | 'tar'
  | 'export';

export type SidebarModule =
  | 'cohortDiagnostics'
  | 'characterization'
  | 'cohortIncidence'
  | 'cohortMethod'
  | 'sccs'
  | 'plp'
  | 'plpValidation'
  | 'treatmentPatterns'
  | 'evidenceSynthesis';

export type SidebarItem = SidebarSection | SidebarModule;
