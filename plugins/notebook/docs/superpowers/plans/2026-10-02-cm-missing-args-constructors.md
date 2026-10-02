# Plan: add the missing CohortMethod 5.5.2 `*Args` constructors

Base: `cd0bb86` (slot guard by constructor field shape, with 5 "set by hand" slots).
Goal: every `createCmAnalysis()` slot has a constructor, mirroring CohortMethod 5.5.2, in both
the R (`src/kernels/webr/StrategusSpecBuilder.R`) and Python
(`src/kernels/pyodide/strategus_spec_builder.py`) builders. The hand-set path goes away.

## Ground truth (read from installed CohortMethod 5.5.2 in `alp-dataflow-gen-worker`, 2026-10-02)

Each constructor stores every formal as a field (`analysis[[name]] <- get(name)`), class `"args"`.

| Slot | Constructor (5.5.2 signature) | Fields (default call) |
|---|---|---|
| `trimByPsToEquipoiseArgs` | `createTrimByPsToEquipoiseArgs(bounds = c(0.3, 0.7))` | `bounds` |
| `trimByIptwArgs` | `createTrimByIptwArgs(maxWeight = 10)` | `maxWeight` |
| `matchOnPsAndCovariatesArgs` | `createMatchOnPsAndCovariatesArgs(caliper = 0.2, caliperScale = "standardized logit", maxRatio = 1, allowReverseMatch = FALSE, covariateIds)` | `caliper, caliperScale, maxRatio, allowReverseMatch, covariateIds` (`covariateIds` required, no default) |
| `stratifyByPsAndCovariatesArgs` | `createStratifyByPsAndCovariatesArgs(numberOfStrata = 5, baseSelection = "all", covariateIds)` | `numberOfStrata, baseSelection, covariateIds` (`covariateIds` required) |
| `computeSharedCovariateBalanceArgs` | none of its own; 5.5.2 docs: args for `computeCovariateBalance()` → `createComputeCovariateBalanceArgs()` | (existing) |

## Design decisions

1. All 14 slots map to a constructor in `.cmArgsSlotConstructors` / `_CM_ARGS_SLOT_CONSTRUCTORS`
   (`computeSharedCovariateBalanceArgs` → `createComputeCovariateBalanceArgs`). Delete the
   hand-set branch of `.assertArgsSlot` / `_assert_args_slot` (plain-list stamping, the
   "has no constructor" errors). Every slot requires class `"args"` (R) / `_class == "args"`
   (Python), as CohortMethod's own `checkmate::assertClass` does.
2. `createTrimByIptwArgs()` and `createTruncateIptwArgs()` have identical shapes (`{maxWeight}`).
   So the slot check must be "value matches the EXPECTED constructor's shape", not "first
   matching constructor == expected". On failure, the error names the first *other*
   constructor whose shape matches (or the field list if none). Known, accepted limitation:
   a by-name swap between `trimByIptwArgs` and `truncateIptwArgs` is not detectable. Every
   legacy positional shift still lands on a differently-shaped slot and is caught.
3. Shapes for the two covariates constructors are built from a call with a placeholder
   (`covariateIds = 0` / `covariate_ids=[0]`), since `covariateIds` has no default.
   No optional fields for the 4 new constructors.
4. Python signatures: `create_trim_by_ps_to_equipoise_args(bounds=(0.3, 0.7))` emits
   `bounds` as a list; `create_trim_by_iptw_args(max_weight=10)`;
   `create_match_on_ps_and_covariates_args(caliper=0.2, caliper_scale="standardized logit", max_ratio=1, allow_reverse_match=False, *, covariate_ids)`;
   `create_stratify_by_ps_and_covariates_args(number_of_strata=5, base_selection="all", *, covariate_ids)`.
   Emitted keys are camelCase as for the existing constructors, plus `"_class": "args"`.
   Place each new constructor next to its sibling (after `createTrimByPsArgs`, after
   `createMatchOnPsArgs`, after `createStratifyByPsArgs`), same style as neighbours.
5. Removed-arg messages in `createTrimByPsArgs` / `create_trim_by_ps_args` must stop saying
   "set by hand"; point at the real constructors instead, keeping "5.5.2" in the text:
   `equipoiseBounds` → use `createTrimByPsToEquipoiseArgs(bounds = ...)` on
   `trimByPsToEquipoiseArgs`; `maxWeight` → `createTrimByIptwArgs()` on `trimByIptwArgs` or
   `createTruncateIptwArgs()` on `truncateIptwArgs`; `trimMethod` → pick the slot of the
   matching constructor (list the three). Python wording mirrors with snake_case names.
6. Update the "HADES Package Version Tracking" header comment in the R file if it lists
   what is covered, and the comment above `.assertArgsSlot` (no more hand-set slots).

Out of scope (do NOT touch): defaults of existing constructors (handled in a later commit).

## Tasks

### Milestone 1 — R

**T1. R constructors + guard + tests.** Tests first in
`tests/StrategusSpecBuilder-cohortmethod-args.test.R` and
`tests/StrategusSpecBuilder-cohortmethod-classes.test.R`:
- emitted field sets of the 4 new constructors (default call / placeholder covariateIds),
  and `covariateIds` missing → error;
- class `"args"` for each new constructor (classes test);
- each of the 5 formerly hand-set slots accepts its constructor's object (serializes /
  returns a cmAnalysis) and rejects a wrong constructor's object with an error naming the slot;
- `computeSharedCovariateBalanceArgs = createComputeCovariateBalanceArgs()` accepted;
- `trimByIptwArgs = createTruncateIptwArgs()` and `truncateIptwArgs = createTrimByIptwArgs()`
  accepted (documented limitation);
- a plain list in any slot is now rejected (replace the old hand-set "plain list accepted"
  and "constructor object rejected in hand-set slot" tests);
- the existing legacy positional test still fails at `trimByPsToEquipoiseArgs`;
- update any removed-arg message assertions for `createTrimByPsArgs`.
Then implement in `StrategusSpecBuilder.R`. Commit.

Verify (container, never host R):
```
W=/Users/santanmaddi/repos/trex-notebook/.claude/worktrees/internal-3235-develop/plugins/notebook
docker exec alp-dataflow-gen-worker rm -rf /tmp/nb && docker exec alp-dataflow-gen-worker mkdir -p /tmp/nb/src/kernels
docker cp $W/src/kernels/webr alp-dataflow-gen-worker:/tmp/nb/src/kernels/webr
docker cp $W/tests alp-dataflow-gen-worker:/tmp/nb/tests
for t in class-order cohortmethod-classes cohortmethod-args covariate-settings plp; do
  docker exec alp-dataflow-gen-worker /var/lib/d2e-flows/hades-flow/baked/.pixi/envs/default/bin/Rscript /tmp/nb/tests/StrategusSpecBuilder-$t.test.R || echo "FAIL $t"
done
```
Checkpoint: all 5 R suites pass.

### Milestone 2 — Python

**T2. Python mirror.** Same tests in `tests/strategus_spec_builder_args.test.py` and
`tests/strategus_spec_builder_classes.test.py`, then implement in
`strategus_spec_builder.py` (`_cm_args_shapes`, `_CM_ARGS_SLOT_CONSTRUCTORS`,
`_assert_args_slot`, removed-arg messages). Commit.

Verify: `for f in tests/strategus_spec_builder_*.test.py; do python3 $f || echo "FAIL $f"; done`
(from `plugins/notebook`). Checkpoint: all 4 Python suites pass.

### Milestone 3 — docs

**T3.** In `docs/superpowers/specs/2026-09-10-strategus-spec-builder-hades-alignment-design.md`,
rewrite the `createTrimByPsArgs` note (currently: only the first variant is reachable, others
set by hand) to say all 5.5.2 trim/match/stratify variants now have notebook constructors and
`computeSharedCovariateBalanceArgs` takes `createComputeCovariateBalanceArgs()`. Commit.

## Rules

- Commit messages: at most 3 lines, NO author/co-author/Claude lines. One commit per task.
- Do not push. Do not touch files outside those named. Do not use `git stash`.
- R only inside the container as above.
