# Minor Findings — deferred to final review

## I-3: 3-arg CONVERT format code not handled

**Finding:** `CONVERT(type, expr, style)` (3-arg form, e.g. `CONVERT(VARCHAR, dt, 120)`)
is not translated. The current `.translateConvert` helper reads `args$parts[2]` as the
expression and silently ignores any third argument (the style code). The resulting
`CAST(expr AS type)` is structurally correct but loses the format code, which may produce
different output for date/time formatting.

**Evidence:** No occurrence of the 3-arg CONVERT form was found in the OhdsiShinyModules
SQL that reaches the results-viewer. Audit row listed the pattern as "possible" rather
than observed.

**Recommendation for final review:**
- Confirm whether any OhdsiShinyModules query uses `CONVERT(type, expr, style)`.
- If found: add a mapping from common MSSQL style codes (e.g. 120 → `strftime`) to a
  DuckDB-compatible equivalent, or emit a warning and drop the style argument.
- If not found: close as not-applicable.

**Status:** Deferred (no evidence of use in scope)
