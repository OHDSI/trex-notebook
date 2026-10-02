# Follow-up: CohortMethod analysis-spec class names & list shapes diverge from Strategus

**Status:** RESOLVED (2026-08-26) in `src/kernels/webr/StrategusSpecBuilder.R`.
CohortMethod + SCCS argument objects now use class `"args"`; CohortMethod
`cmAnalysis`/`outcome`/`targetComparatorOutcomes` are lowercase; `cmAnalysisList`,
`targetComparatorOutcomesList`, and `outcomes` are `unname()`d so they serialize
as JSON arrays. Covered by `tests/StrategusSpecBuilder-cohortmethod-classes.test.R`
(and end-to-end with the rD2E serializer). SCCS list-shape was **not** changed —
`createSelfControlledCaseSeriesModuleSpecifications` wraps a pre-built opaque
spec object; revisit if SCCS specs are ever assembled from these builders.
**Found:** 2026-08-26, while hand-patching a generated CohortMethod spec
(`mario_forest_plot_study_spec.json`) so it would validate on the execution side.
**Related:** builds on the `attr_class` serialization fix (serializer now emits
`attr_<name>`; module class order corrected to specific-first).

## Summary

Once the rD2E serializer emits `attr_class`, CohortMethod specifications produced
by the notebook builder still won't match what Strategus expects on execution,
for two independent reasons:

1. **Wrong S3 class names** on CohortMethod (and likely SCCS) sub-objects.
2. **`cmAnalysisList` serializes as a JSON object, not an array**, when the
   analyses are collected into a *named* R list.

Evidence is the canonical Strategus spec used as execution-side test data:
`plugins/ui/alp-libs/python/pystrategus/pystrategus/cohort_definition_set/testdata/analysisSpecification.json`
(paths below are from that file).

## Issue 1 — class names

The builder assigns specific, capitalized class names; real Strategus/CohortMethod
uses a generic lowercase `"args"` for every argument object, and lowercase names
for the analysis/outcome/tco wrappers. `.rD2E_to_json` emits the class verbatim,
so the wrong names reach the JSON.

| Object (spec key) | Builder sets (`StrategusSpecBuilder.R`) | Strategus/reference expects |
|---|---|---|
| `getDbCohortMethodDataArgs` | `"GetDbCohortMethodDataArgs"` (L557) | `"args"` |
| `createStudyPopArgs` | `"CreateStudyPopulationArgs"` (L581) | `"args"` |
| `createPsArgs` | `"CreatePsArgs"` (L611) | `"args"` |
| `trimByPsArgs` | `"TrimByPsArgs"` (L625) | `"args"` |
| `truncateIptwArgs` | `"TruncateIptwArgs"` (L631) | `"args"` |
| `matchOnPsArgs` | `"MatchOnPsArgs"` (L649) | `"args"` |
| `stratifyByPsArgs` | `"StratifyByPsArgs"` (L663) | `"args"` |
| `computeCovariateBalanceArgs` / `computeSharedCovariateBalanceArgs` | `"ComputeCovariateBalanceArgs"` (L679) | `"args"` |
| `fitOutcomeModelArgs` | `"FitOutcomeModelArgs"` (L715) | `"args"` |
| cmAnalysis element | `"CmAnalysis"` (L745) | `"cmAnalysis"` |
| outcome element | `"Outcome"` (L767) | `"outcome"` |
| targetComparatorOutcomes element | `"TargetComparatorOutcomes"` (L785) | `"targetComparatorOutcomes"` |

Already correct (leave as-is): `prior` → `"cyclopsPrior"` (L214),
`control` → `"cyclopsControl"` (L250), `covariateSettings` → `"covariateSettings"`
+ `attr(,"fun")` (L405), `cmDiagnosticThresholds` → `"CmDiagnosticThresholds"`
(L803, capitalized here **is** what the reference uses).

**Likely also affected — SCCS builders** (verify against a SelfControlledCaseSeries
reference before changing): `GetDbSccsDataArgs` (L913),
`CreateStudyPopulationArgs` (L932), `CreateSccsIntervalDataArgs` (L952),
`CreateScriIntervalDataArgs` (L962) — real SCCS also uses `"args"`.

### Reference paths (proof)
```
$.moduleSpecifications[4].settings.cmAnalysisList[0]                         -> "cmAnalysis"
$.moduleSpecifications[4].settings.cmAnalysisList[0].getDbCohortMethodDataArgs -> "args"
$   …getDbCohortMethodDataArgs.covariateSettings -> "covariateSettings" +attr_fun="getDbDefaultCovariateData"
$   …createStudyPopArgs / createPsArgs / matchOnPsArgs / computeCovariateBalanceArgs / fitOutcomeModelArgs -> "args"
$   …createPsArgs.prior -> "cyclopsPrior" ; …control -> "cyclopsControl"
$.moduleSpecifications[4].settings.targetComparatorOutcomesList[0]           -> "targetComparatorOutcomes"
$   …outcomes[j]                                                             -> "outcome"
$.moduleSpecifications[4].settings.cmDiagnosticThresholds                    -> "CmDiagnosticThresholds"
```

## Issue 2 — `cmAnalysisList` shape (object vs array)

A generated spec had:
```json
"cmAnalysisList": { "cmAnalysis1": { … }, "cmAnalysis2": { … } }
```
but Strategus expects an **array**:
```json
"cmAnalysisList": [ { … }, { … } ]
```
Root cause: `.rD2E_to_json` renders a *named* R list as a JSON object and an
*unnamed* list as an array. `createCohortMethodModuleSpecifications(cmAnalysisList, …)`
(L2102) passes `cmAnalysisList` straight through, so whatever assembles the
analyses must build an **unnamed** list (e.g. `list(a1, a2)`, not
`list(cmAnalysis1 = a1, cmAnalysis2 = a2)`). The same applies to any list that
should be a JSON array (`targetComparatorOutcomesList`, `outcomes`, …).

## Recommended fix

1. In `StrategusSpecBuilder.R`, change the CohortMethod (and, after verifying a
   reference, SCCS) arg/analysis/outcome/tco `class(...)` assignments to the
   Strategus names in the table above (`"args"`, `"cmAnalysis"`, `"outcome"`,
   `"targetComparatorOutcomes"`).
2. Ensure `cmAnalysisList` / other array-valued containers are assembled as
   **unnamed** R lists (or strip names before serialization) so they serialize
   to JSON arrays.
3. Add Rscript regression coverage (mirroring
   `tests/StrategusSpecBuilder-class-order.test.R`): build a CohortMethod module
   via the public wrappers, serialize with `.rD2E_to_json`, and assert the
   `attr_class` values and array shapes match the reference.

## Verification note

Class expectations here are derived from the pystrategus execution-side fixture.
Confirm against the exact Strategus/CohortMethod version the target environment
runs before merging, in case class conventions differ by version.
