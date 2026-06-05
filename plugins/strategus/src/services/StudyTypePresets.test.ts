import { describe, it, expect } from 'vitest'
import { STUDY_TYPE_PRESETS, getPreset, ALL_MODULE_KEYS, applyStudyTypePreset } from './StudyTypePresets'

describe('STUDY_TYPE_PRESETS', () => {
  it('defines exactly the 8 agreed study types', () => {
    expect(STUDY_TYPE_PRESETS.map(p => p.id)).toEqual([
      'diseaseNaturalHistory', 'treatmentUtilization', 'outcomeIncidence',
      'safetySurveillance', 'comparativeEffectiveness',
      'diseaseOnsetProgression', 'treatmentResponse', 'treatmentSafety',
    ])
  })
  it('every preset enables CohortDiagnostics and uses only known module keys', () => {
    for (const p of STUDY_TYPE_PRESETS) {
      expect(p.enabledModules.CohortDiagnostics).toBe(true)
      for (const k of Object.keys(p.enabledModules)) expect(ALL_MODULE_KEYS).toContain(k)
    }
  })
  it('enables the right primary module per type', () => {
    expect(getPreset('comparativeEffectiveness')!.enabledModules.CohortMethod).toBe(true)
    expect(getPreset('safetySurveillance')!.enabledModules.SCCS).toBe(true)
    expect(getPreset('treatmentUtilization')!.enabledModules.TreatmentPatterns).toBe(true)
    expect(getPreset('outcomeIncidence')!.enabledModules.CohortIncidence).toBe(true)
    expect(getPreset('diseaseOnsetProgression')!.enabledModules.PLP).toBe(true)
  })
  it('each preset has a question, example, group, and required roles', () => {
    for (const p of STUDY_TYPE_PRESETS) {
      expect(p.question.length).toBeGreaterThan(0)
      expect(p.example.length).toBeGreaterThan(0)
      expect(['Characterization', 'Estimation', 'Prediction']).toContain(p.group)
      expect(p.requiredRoles.length).toBeGreaterThan(0)
    }
  })
  it('applyStudyTypePreset sets enabledModules + studyType', () => {
    const store: any = {
      enabledModules: { CohortDiagnostics: true, Characterization: true, CohortIncidence: true,
        CohortMethod: true, SCCS: true, PLP: false, PLPValidation: false,
        TreatmentPatterns: false, EvidenceSynthesis: false },
      studyType: null, timeAtRisk: [],
    }
    applyStudyTypePreset(store, 'comparativeEffectiveness')
    expect(store.enabledModules.CohortMethod).toBe(true)
    expect(store.enabledModules.SCCS).toBe(false)
    expect(store.enabledModules.PLP).toBe(false)
    expect(store.studyType).toBe('comparativeEffectiveness')
  })
})
