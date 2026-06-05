// The 8 typical OHDSI study types (Book of OHDSI use cases). Each preset is pure
// data: it names the analysis modules to enable and the cohort roles the user
// must define. Applying a preset is a starting point — every module/setting stays
// editable afterward.
export type ModuleKey =
  | 'CohortDiagnostics' | 'Characterization' | 'CohortIncidence' | 'CohortMethod'
  | 'SCCS' | 'PLP' | 'PLPValidation' | 'TreatmentPatterns' | 'EvidenceSynthesis'

export const ALL_MODULE_KEYS: ModuleKey[] = [
  'CohortDiagnostics', 'Characterization', 'CohortIncidence', 'CohortMethod',
  'SCCS', 'PLP', 'PLPValidation', 'TreatmentPatterns', 'EvidenceSynthesis',
]

export type StudyTypeId =
  | 'diseaseNaturalHistory' | 'treatmentUtilization' | 'outcomeIncidence'
  | 'safetySurveillance' | 'comparativeEffectiveness'
  | 'diseaseOnsetProgression' | 'treatmentResponse' | 'treatmentSafety'

export type StudyGroup = 'Characterization' | 'Estimation' | 'Prediction'
export type CohortRole = 'Target' | 'Comparator' | 'Outcome' | 'Treatment' | 'NegativeControl'

export interface StudyStoreLike {
  timeAtRisk: { id: string; label: string; riskWindowStart: number; startAnchor: string;
                riskWindowEnd: number; endAnchor: string }[]
}

export interface StudyTypePreset {
  id: StudyTypeId
  group: StudyGroup
  label: string
  question: string
  example: string
  enabledModules: Partial<Record<ModuleKey, boolean>>
  requiredRoles: CohortRole[]
  applyOverrides?: (store: StudyStoreLike) => void
}

const ALL_OFF: Record<ModuleKey, boolean> = {
  CohortDiagnostics: true, Characterization: false, CohortIncidence: false,
  CohortMethod: false, SCCS: false, PLP: false, PLPValidation: false,
  TreatmentPatterns: false, EvidenceSynthesis: false,
}
const modules = (on: ModuleKey[]): Record<ModuleKey, boolean> => {
  const m = { ...ALL_OFF }
  for (const k of on) m[k] = true
  return m
}

export const STUDY_TYPE_PRESETS: StudyTypePreset[] = [
  { id: 'diseaseNaturalHistory', group: 'Characterization', label: 'Disease Natural History',
    question: 'Among patients diagnosed with <disease>, what are their characteristics from their medical history?',
    example: 'Among patients with rheumatoid arthritis: demographics, prior conditions, medications, utilization.',
    enabledModules: modules(['CohortDiagnostics', 'Characterization']), requiredRoles: ['Target'] },
  { id: 'treatmentUtilization', group: 'Characterization', label: 'Treatment Utilization',
    question: 'Among patients with <disease>, which treatments were they exposed to and in which sequence?',
    example: 'Among patients with depression: SSRI, SNRI, TCA, bupropion, esketamine — and in what order.',
    enabledModules: modules(['CohortDiagnostics', 'TreatmentPatterns']), requiredRoles: ['Target', 'Treatment'] },
  { id: 'outcomeIncidence', group: 'Characterization', label: 'Outcome Incidence',
    question: 'Among new users of <drug>, how many experienced <adverse event> within <time horizon>?',
    example: 'Among new users of methylphenidate, how many experienced psychosis within 1 year?',
    enabledModules: modules(['CohortDiagnostics', 'CohortIncidence', 'Characterization']),
    requiredRoles: ['Target', 'Outcome'],
    applyOverrides: (store) => {
      store.timeAtRisk = [{ id: 'tar-incidence', label: '1–365 days from start',
        riskWindowStart: 1, startAnchor: 'cohort start', riskWindowEnd: 365, endAnchor: 'cohort start' }]
    } },
  { id: 'safetySurveillance', group: 'Estimation', label: 'Safety Surveillance',
    question: 'Does exposure to <drug> increase the risk of <adverse event> within <time horizon>?',
    example: 'Does ACE inhibitor exposure increase the risk of angioedema within 1 month?',
    enabledModules: modules(['CohortDiagnostics', 'SCCS', 'EvidenceSynthesis']),
    requiredRoles: ['Target', 'Outcome', 'NegativeControl'] },
  { id: 'comparativeEffectiveness', group: 'Estimation', label: 'Comparative Effectiveness',
    question: 'Does <drug> have a different risk of <outcome> within <time horizon>, relative to <comparator>?',
    example: 'Does ACE inhibitor differ from thiazide in risk of acute MI while on treatment?',
    enabledModules: modules(['CohortDiagnostics', 'Characterization', 'CohortMethod', 'EvidenceSynthesis']),
    requiredRoles: ['Target', 'Comparator', 'Outcome', 'NegativeControl'] },
  { id: 'diseaseOnsetProgression', group: 'Prediction', label: 'Disease Onset & Progression',
    question: 'For a patient diagnosed with <disease>, what is the probability of <complication> within <time horizon>?',
    example: 'For a patient newly diagnosed with atrial fibrillation, probability of ischemic stroke in 3 years?',
    enabledModules: modules(['CohortDiagnostics', 'Characterization', 'PLP']), requiredRoles: ['Target', 'Outcome'] },
  { id: 'treatmentResponse', group: 'Prediction', label: 'Treatment Response',
    question: 'For a new user of <drug>, what is the probability of <desired effect> within <time window>?',
    example: 'For a T2DM patient starting metformin, probability of maintaining HbA1c < 6.5% after 3 years?',
    enabledModules: modules(['CohortDiagnostics', 'PLP']), requiredRoles: ['Target', 'Outcome'] },
  { id: 'treatmentSafety', group: 'Prediction', label: 'Treatment Safety',
    question: 'For a new user of <drug>, what is the probability of <adverse event> within <time horizon>?',
    example: 'For a new user of warfarin, probability of GI bleed within 1 year?',
    enabledModules: modules(['CohortDiagnostics', 'PLP']), requiredRoles: ['Target', 'Outcome'] },
]

export function getPreset(id: StudyTypeId): StudyTypePreset | undefined {
  return STUDY_TYPE_PRESETS.find(p => p.id === id)
}

// Apply a preset to the live Strategus store. The CALLER must call
// store.resetToDefaults() first; this then flips enabledModules to the preset,
// runs any overrides, and records the type. Everything stays user-editable.
export function applyStudyTypePreset(
  store: { enabledModules: Record<string, boolean>; studyType: StudyTypeId | null } & StudyStoreLike,
  id: StudyTypeId,
): void {
  const preset = getPreset(id)
  if (!preset) return
  for (const key of ALL_MODULE_KEYS) store.enabledModules[key] = preset.enabledModules[key] ?? false
  preset.applyOverrides?.(store)
  store.studyType = id
}
