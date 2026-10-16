# Apply Progress: Supporting Catalogs Schema (Story 2.1, Change 1/6)

Mode: **Strict TDD** (openspec/config.yaml `strict_tdd: true`, runner `vitest run`).
Artifact store: **both** (this file + engram topic `sdd/catalog-schema-supporting/apply-progress`).
Delivery: single PR (forecast ~320-380 lines, low risk).

## Phase 1: Schema Foundation

- [x] 1.1 Append `Method`, `Technique`, `Container`, `SampleType` to `prisma/schema.prisma` after `AuditLog`
- [x] 1.2 Append `Equipment` (same shape + `model`, `serialNumber`, nullable `calibrationDate`)
- [x] 1.3 Run `prisma generate`; verify `prisma validate` passes and `db.method`/`db.equipment` exist
      (verified all 5 delegates in `src/generated/prisma/internal/class.ts`)

## Phase 2: Migration + Dev-Branch Apply

- [x] 2.1 `prisma migrate dev --create-only --name catalog_supporting_models`
      DEVIATION: `migrate dev` was BLOCKED by pre-existing drift on the dev branch
      (`audit_log` missing the `entityId` index — the migration history has it, the
      live dev DB does not; someone dropped it manually). Refusing the destructive
      `migrate reset` it demanded. Generated the identical SQL via
      `prisma migrate diff --from-schema <HEAD schema> --to-schema <new schema> --script`
      (same diff engine, run over the clean migration history). Output matches the
      design's expected snippet exactly.
- [x] 2.2 Hand-append per-table RLS block (GRANT/ENABLE/FORCE/POLICY) — done, `rls_roles`-verbatim shape
- [x] 2.3 `prisma migrate diff`: hand-edit verified — applied the migration to a scratch
      ephemeral branch (script deleted after), diff back to schema reports ZERO drift for
      the 5 tables. Only statement in the diff: pre-existing PARENT-branch drift
      (`CREATE INDEX audit_log_entityId_idx`) — unrelated to this change, flagged to orchestrator.
      `migrate.sql` contains no DROP POLICY / REVOKE / DROP TABLE (grep count 0).
- [x] 2.4 Apply to a real dev Neon branch: `prisma migrate deploy` ran on the ephemeral
      harness branch; `_prisma_migrations` listing asserted in
      `catalog-schema.test.ts` ("_prisma_migrations lists catalog_supporting_models").

## Phase 3: Integration Tests

- [x] 3.1 `tests/integration/catalog/catalog-schema.test.ts` (9 tests: exact column sets,
      23505 duplicate, cross-tenant same-name, equipment NULL calibrationDate, container
      lookup-only columns, isActive default+persist, _prisma_migrations listing, static
      R5 no-seed check, cuid2 via scoped())
- [x] 3.2 `tests/integration/catalog/catalog-rls.test.ts` (5 tests: ENABLE+FORCE+policy per
      table, relforcerowsecurity all five, fail-closed unscoped, cross-tenant isolation,
      full CRUD grant surface)
- [x] 3.3 cuid2 test via `scoped()` — implemented inside catalog-schema.test.ts
      (design.md maps it there; the DB column has no default so raw SQL cannot exercise it)

## Phase 4: Verification

- [x] 4.1 `npm run test:integration` — new + existing green (fileParallelism: false)
- [x] 4.2 `npm run test`, `npx tsc --noEmit`, `npm run lint` — clean
- [x] 4.3 NON-goals confirmed by diff (no UI/CRUD/nav/seed/Study/AuditLog writes)
- [x] 4.4 Final diff scoped to schema + migration + tests/integration/catalog; wrapper untouched

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.2 | catalog-schema.test.ts / catalog-rls.test.ts | Integration | ✅ 50/50 unit | ✅ Written (14/14 failed: 42P01 + missing delegate) | ✅ 14/14 pass on real branch | ✅ 14 spec scenarios across 2 files | ➖ None needed (schema-only) |
| 2.1-2.3 | (migration) | — | N/A (new) | N/A (test-assertion-driven per design) | ✅ migrate diff empty for change | ✅ per-table ×5 RLS blocks | ➖ None |
| 3.1-3.3 | catalog-schema.test.ts / catalog-rls.test.ts | Integration | ✅ 50/50 unit | ✅ RED confirmed (14/14) | ✅ GREEN confirmed (14/14) | ✅ ≥2 cases per behavior (duplicate vs cross-tenant; fail-closed vs isolation; grant INSERT vs UPDATE vs DELETE) | ➖ None needed |

## Deviations / Notes

1. **`migrate dev` blocked by pre-existing drift** — dev branch (and the Neon parent
   branch) are missing `audit_log_entityId_idx`; migration history has it. Used
   `prisma migrate diff` (same engine) over the clean history instead; refused
   destructive reset. FLAGGED to orchestrator: parent branch + dev DB are drifted.
2. **R5 zero-rows proof (deviated — was order-dependent)**: design mapped R5 to a
   dynamic "fresh branch has zero rows" DB assertion. Vitest's default sequencer
   (`BaseSequencer.sort`) runs LARGER files first and reorders by cached duration
   on later runs — file order is unreliable, and both catalog files seed rows into
   the single shared branch, so a DB-level zero-rows assertion failed when
   catalog-schema ran first (observed: 4 pre-seeded method rows). Replaced with a
   deterministic static assertion: the migration file contains no `INSERT INTO` /
   `COPY` seed statements (the exact R5 requirement — "the migration SHOULD NOT
   insert seed rows"; the only writers on a fresh branch are migrations and
   tests). Lives in catalog-schema.test.ts per the design's R5 mapping.
3. **Owner-bypass scenario** proven structurally (`pg_class.relforcerowsecurity`) per
   design.md deviation note — no literal owner-SELECT-zero-rows test.
4. **cuid2 test** goes through `scoped()` only (design constraint); raw SQL cannot
   exercise client-side cuid2 generation.
5. Migration header documents the diff-engine generation method + drift context so a
   future dev does not "fix" the header thinking it was hand-written.

## Review Fix (adversarial review, R1 — WITH CHECK write-path proof)

Adversarial review (fresh context, R1 risk) found the `tenant_isolation` WITH CHECK
(INSERT/UPDATE branch) was unproven behaviorally. Added a structural assertion to
`tests/integration/catalog/catalog-rls.test.ts` (test "every catalog table has ENABLE +
FORCE RLS and a tenant_isolation policy"):

- Query extended to `SELECT policyname, qual, with_check FROM pg_policies` (same style).
- Assertion: `isolationRows.some(p => p.with_check?.includes("app.tenant_id"))` per table
  — proves the write-path predicate scopes to `app.tenant_id` on all 5 tables.
- Also hardened the existing USING check from `find`+`qual` (fragile: pg_policies expands
  one row per command; the found row may lack `qual`) to `.some()` over all command rows.
- TDD: RED proven — temporarily set method's WITH CHECK to `WITH CHECK (true)`; the new
  assertion failed (expected false→true) with 4/5 passing; reverted → GREEN 5/5.

Verification after fix: catalog-rls.test.ts 5/5 PASS (targeted run), tsc 0, lint 0, unit 50/50.
Full suite not re-run (targeted run sufficient per review-fix instructions).

## Leftover Neon Branches

- None. Scratch verification branch `br-sparkling-unit-axdahe1k` deleted by the script.

## DELIVERY GUARD — STOPPED FOR RE-EVALUATION

Actual changed lines: **771** (762 insertions + 9 deletions; `git diff --stat` with
intent-to-add on the untracked files). Breakdown: schema.prisma 108 (99+9 — the 9
deletions are `prisma format` realignment of the adjacent AuditLog block),
migration.sql 157, catalog-rls.test.ts 203, catalog-schema.test.ts 217,
apply-progress.md 86 (process artifact; 685 without it).

Forecast was 320-380 → **exceeds the 400-line review guard**. Per the apply prompt
("if it exceeds 400, STOP and report — the review guard must re-evaluate"), work is
COMPLETE but delivery is STOPPED for the guard decision. All 13 tasks are done;
verification is fully green (integration 102/102, unit 50/50, tsc/lint/build clean).

Recommended resolution for the guard:
- **Preferred: size:exception, single PR.** The change is atomic — the integration
  tests are the migration's only proof of RLS/FORCE/grants; splitting would ship an
  unverified schema PR. Trimming tests to force <400 would gut the 14-scenario spec
  coverage (bare-minimum estimate is still ~515+ lines).
- Alternative: chained slice (schema+migration PR, then tests PR) — weaker, PR 1
  ships without RLS proof.

Unresolved decisions for the guard:
1. Delivery resolution (above).
2. Pre-existing Neon drift: BOTH the dev DB and the `NEON_PARENT_BRANCH_ID` parent
   branch are missing `audit_log_entityId_idx` (migration history has it). It blocks
   `prisma migrate dev` on the dev DB (drift reset prompt) and surfaced in the
   task-2.3 diff. Not caused by this change; recommend a follow-up to re-apply the
   index (or `migrate resolve`) before the next change runs `migrate dev`.