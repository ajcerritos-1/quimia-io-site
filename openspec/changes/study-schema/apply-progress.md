# Apply Progress: Study Catalog Schema (Story 2.2, slice 1/2)

Mode: Strict TDD. Artifact store: hybrid (OpenSpec file + Engram). Delivery: auto-chain; PR 1 merged into `dev`, PR 2 is the test-only behavioral slice recorded here.

## Phase Status

| Phase | Status |
|-------|--------|
| 1 - Preflight and RED tests | Done (on `feat/study-schema-pr1`, merged to `dev` in `9abea82`) |
| 2 - Schema and migration GREEN | Done (merged) |
| 3 - AD-21 spine and PR 1 close | Done (merged) |
| 4 - PR 2 behavioral proofs | Done (14/14 green on the real branch; 5 mutants failed as designed) |
| 5 - Close | Done |

## Phase 4 - Files

| File | Lines |
|------|-------|
| `tests/integration/catalog/study-fixtures.ts` | 147 |
| `tests/integration/catalog/study-fk.test.ts` | 154 |
| `tests/integration/catalog/study-m2m.test.ts` | 62 |
| `tests/integration/catalog/study-rls.test.ts` | 216 |
| **Total** | **579** |

Focused command (task 4.6), against an unmodified ephemeral branch created from the parent:

```
npx vitest run --config vitest.integration.config.ts \
  tests/integration/catalog/study-rls.test.ts \
  tests/integration/catalog/study-fk.test.ts \
  tests/integration/catalog/study-m2m.test.ts
```

Result: **3 files passed, 14 tests passed**. `npx tsc --noEmit` clean.

## Mutation Evidence (RED by mutation)

Each mutant ran on its own ephemeral branch cut from the parent; the branch was deleted after the run.

| Task | Mutant | Branch (deleted) | Expected failure | Observed |
|------|--------|------------------|------------------|----------|
| 4.2 | `study_method_fkey` and `study_container_container_fkey` made single-column | `br-old-paper-axoqt49o` | Cross-tenant references accepted | 2 failed / 5 passed: "tenant A's study cannot reference tenant B's Method (23503)" and "... cannot link tenant B's Container" |
| 4.3 | `study_method_fkey` changed to `ON DELETE CASCADE` | `br-super-hill-axt25usb` | Delete of a referenced Method succeeds | 1 failed / 6 passed: "deleting a Method referenced by a Study is refused with 23001" |
| 4.4 | `DROP INDEX study_container_studyId_containerId_key` | `br-wild-forest-axcgs8u7` | Duplicate link accepted | 1 failed / 1 passed: "a duplicate (studyId, containerId) link is rejected with 23505" |
| 4.5 (i) | `ALTER TABLE study NO FORCE ROW LEVEL SECURITY` | `br-silent-dream-axj99ttq` | Force assertion fails | 1 failed / 4 passed: `AssertionError: study FORCE RLS: expected false to be true` |
| 4.5 (ii) | `study_container` policy keep `USING`, `WITH CHECK (true)` | `br-mute-meadow-axr7o83r` | Structural WITH CHECK assertion and cross-tenant insert both fail | 2 failed / 3 passed: structural policy test and "tenant A's scoped session cannot insert a tenant-B study_container row (WITH CHECK)" |

## Deviations / Learnings

1. **`ON DELETE RESTRICT` raises SQLSTATE `23001`, not `23503`.** PostgreSQL defers `NO ACTION` to statement end (`23503`), but `RESTRICT` fails immediately with `restrict_violation` (`23001`). The task text and coverage map named `23503`; the tests assert `23001` (the correct code for the shipped constraint) and document the reason inline.
2. **Omitting `WITH CHECK` does not remove write enforcement.** Per PostgreSQL, when `WITH CHECK` is omitted the `USING` expression is also used as the check. The first 4.5 (ii) mutant (`br-fragrant-tooth-ax4l98rc`, `USING` only) therefore left writes enforced and only the structural assertion failed. The mutant was rebuilt as `USING (...) WITH CHECK (true)`, which is what actually disables the write path; the behavioral test then failed as intended.
3. **Neon cold-start `P1001`.** Freshly created branches occasionally reject the first connection. Mutant creation retried `migrate deploy` up to 5 times; test runs were retried once when the harness log contained `P1001`. No code change was needed (harness hardening is out of this slice's scope).
4. **No cascade-delete proof** uses the container FK (unchanged in 4.3), so the restrictive Method mutant does not mask it.

## Phase 5 - Close

- **5.1 Branch reaping.** Final branch list after all mutant runs and test teardowns: `dev`, `preview/feat/study-schema-pr1`, `production`, `preview/main`, `vercel-dev` (5 total, under the cap of 10). Zero `test-*`, zero `pr2-mutant-*` branches remain.
- **5.2 Non-goals (diff review).** Working-tree changes are exactly the four `tests/integration/catalog/` files. No `src/` change, no `/configuracion` route, no `"use server"`, no `STUDY_*` audit action, no Zod schema, no seed `INSERT` in the migration, no e2e file.
- **5.3 Line counts.** PR 1 actual: 602 additions / 4 deletions across schema + migration + spine + 3 test files (inside the ~580 forecast, above the per-PR 400 budget). PR 2 actual: **579 additions** vs the ~260 forecast and the 400-line review budget -> **over by 179 lines (+123%)**. Cause: the behavioral slice needed four proved contracts (FK resolution/cross-tenant/restrict, M2M, RLS + FORCE + fail-closed + CRUD, and the WITH CHECK write path) plus a shared fixture module; the forecast assumed two thin files. Recommendation: `size:exception` for PR 2 (test-only, no production code).
- **5.4 Evidence.** Recorded above with exact failure names, branch identities, and pass counts.

## Notes

- `_bmad-output/implementation-artifacts/sprint-status.yaml` remains stale (last updated 2026-08-24; `epic-2` still listed as `backlog`). Updating it was outside this change's task list.
