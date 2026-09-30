# Apply Progress: Configuración — Catalog CRUD (Story 2.1, Change 2/6)

## Mode

Strict TDD (RED → GREEN → REFACTOR) — resolved from `openspec/config.yaml` (`strict_tdd: true`) + test runner `vitest run`.

## Slice Boundary

PR 2 (auto-chain, work-unit 2 of 5) — **Phase 2 only**: `require-catalog-admin.ts` + `catalog-queries.ts` + 4 plain actions + integration tests. No submit wrappers (PR 3), no UI (PR 4), no routes/nav/e2e (PR 5).

---

## Phase 1 (PR 1 — completed in prior slice, preserved verbatim)

### Completed Tasks (Phase 1)

- [x] 1.1 RED — `registry.test.ts`
- [x] 1.2 RED — `schemas.test.ts`
- [x] 1.3 GREEN — `registry.ts`
- [x] 1.4 GREEN — `schemas.ts`
- [x] 1.5 REFACTOR — full catalog suite green + no server-only/shared-db/Prisma leak

### TDD Cycle Evidence (Phase 1)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/modules/catalog/registry.test.ts` | Unit | N/A (new file) | ✅ Written (fails: `Cannot find module './registry'`) | ✅ Passed | ✅ 8 cases (5 keys, canonical slugs, labels, field counts, slug==key, shape, entity/prefix, href) | ✅ Clean |
| 1.2 | `src/modules/catalog/schemas.test.ts` | Unit | N/A (new file) | ✅ Written (fails: `Cannot find module './schemas'`) | ✅ Passed | ✅ 10 cases (uniform accept, empty-name reject, equipos require, `""`→null, `null`→null, date→Date, unknown kind reject, create no-id, update requires-id, equipos update requires) | ✅ Clean |
| 1.3 | `src/modules/catalog/registry.ts` | — | N/A | — (GREEN step) | ✅ Passed | — (structural: one canonical shape) | ✅ Clean (zero imports) |
| 1.4 | `src/modules/catalog/schemas.ts` | — | N/A | — (GREEN step) | ✅ Passed | — (contract from design, one discriminated union per op) | ✅ Clean (only `zod` import) |
| 1.5 | full catalog suite | Unit | — | — | ✅ `npx vitest run src/modules/catalog` → 2 files / 18 tests passed | — | ✅ Grep confirms no `server-only`, `@/shared/db`, or Prisma import |

### Test Summary (Phase 1)

- **Total tests written**: 18 (8 registry + 10 schemas)
- **Total tests passing**: 18
- **Layers used**: Unit (18)
- **Approval tests** (refactoring): None — no refactoring tasks, all new files
- **Pure functions created**: 1 (`catalogHref`) + 2 pure schema constants

### Work Unit Evidence (Phase 1)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run src/modules/catalog` → `Test Files 2 passed (2)` / `Tests 18 passed (18)` (exit 0) |
| Runtime harness command/scenario and exact result | `N/A` — pure client-safe modules with no server/DB/UI runtime boundary; unit assertions are the complete verification surface |
| Rollback boundary | Delete `src/modules/catalog/registry.ts`, `src/modules/catalog/schemas.ts`, `src/modules/catalog/registry.test.ts`, `src/modules/catalog/schemas.test.ts` — nothing depends on them yet |

---

## Phase 2 (PR 2 — this slice: implemented AND verified GREEN)

### Completed Tasks (Phase 2)

- [x] 2.1 RED → GREEN — `tests/integration/catalog/catalog-crud.test.ts` (17 integration tests, full contract). GREEN: `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-crud.test.ts` → `Test Files 1 passed (1)` / `Tests 17 passed (17)` (exit 0, 93.62s).
- [x] 2.2 GREEN — `src/modules/catalog/server/require-catalog-admin.ts` (thin `requireRole([admin])` wrapper, `entity` param, `CATALOG_ADMIN_ACTION_DENIED`, `attemptedAction` union, optional `entityId`). Verified by 2.1's denial scenarios.
- [x] 2.3 GREEN — `src/modules/catalog/server/catalog-queries.ts` (`listCatalogRows` / `countActive` / `getCatalogStats`, explicit typed `switch (kind)`, `SerializedCatalogRow`). Verified by 2.1 ordering + RLS-isolation + stats tests.
- [x] 2.4 GREEN — `src/modules/catalog/server/create-catalog.action.ts` (Zod 400, guard, `transaction` + typed `switch` + `{ENTITY}_CREATED` audit in same tx, 409 on P2002). Verified.
- [x] 2.5 GREEN — `src/modules/catalog/server/update-catalog.action.ts` (404 on missing row, `{ENTITY}_UPDATED` with before/after snapshots incl. equipment full snapshot, 409 on P2002; **always writes audit — no before≡after no-op**, per resolved open question). Verified.
- [x] 2.6 GREEN — `src/modules/catalog/server/deactivate-catalog.action.ts` (exports `catalogIdSchema` + `CatalogIdInput`; no-op guard skips mutation AND audit; `{ENTITY}_DEACTIVATED` in same tx). Verified.
- [x] 2.7 GREEN — `src/modules/catalog/server/reactivate-catalog.action.ts` (mirror of deactivate; `{ENTITY}_REACTIVATED`). Verified.
- [x] 2.8 REFACTOR — full Phase 2 surface verified: integration 17/17 green, `tsc --noEmit` exit 0, Phase 1 unit 18/18 still green, grep confirms no dynamic delegate access and all `writeAuditLog` calls inside `transaction()` callbacks.

### TDD Cycle Evidence (Phase 2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `tests/integration/catalog/catalog-crud.test.ts` | Integration | N/A (new file) | ✅ Written (17 tests; imports referenced non-existent `server/` modules → failed by construction) | ✅ **Passed — 17/17** (real ephemeral Neon branch) | ✅ 17 cases (create+audit per kind, equipos null/date calibration, dup 409 + no row, cross-tenant allowed, update before/after, equipment update snapshot, update-dup 409, deactivate no-delete, reactivate, deactivate-inactive no-op, reactivate-active no-op, quimico/recepcionista 403 + `CATALOG_ADMIN_ACTION_DENIED`, list ordering + RLS isolation, stats counts) | ✅ Clean |
| 2.2 | `src/modules/catalog/server/require-catalog-admin.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 denial scenarios) | ✅ Passed | — (single thin wrapper, contract from design) | ✅ Clean (grep: no dynamic access) |
| 2.3 | `src/modules/catalog/server/catalog-queries.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 list/stats scenarios) | ✅ Passed | — (typed switch per kind) | ✅ Clean (grep: no dynamic access) |
| 2.4 | `src/modules/catalog/server/create-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 create scenarios) | ✅ Passed | — (5-kind switch triangulated in 2.1) | ✅ Clean |
| 2.5 | `src/modules/catalog/server/update-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 update scenarios) | ✅ Passed | — (name-only + equipment full snapshot) | ✅ Clean |
| 2.6 | `src/modules/catalog/server/deactivate-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 deactivate/no-op scenarios) | ✅ Passed | — (no-op guard triangulated) | ✅ Clean |
| 2.7 | `src/modules/catalog/server/reactivate-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 reactivate/no-op scenarios) | ✅ Passed | — (mirror of deactivate) | ✅ Clean |
| 2.8 | full Phase 2 surface | Integration + static | ✅ 18/18 unit (Phase 1) | — | ✅ Integration 17/17 | — | ✅ `tsc --noEmit` exit 0; Phase 1 unit 18/18; grep: zero `scoped()[string]` dynamic keys, `writeAuditLog` only inside `transaction()` callbacks |

### Test Summary (Phase 2)

- **Total tests written**: 17 (integration, `catalog-crud.test.ts`)
- **Total tests passing**: 17/17 (integration) + 18/18 (Phase 1 unit regression)
- **Layers used**: Integration (17)
- **Approval tests** (refactoring): None — all new files
- **Pure functions created**: 0 new (queries/actions are IO-bound; `catalogHref` from Phase 1 reused)

### Work Unit Evidence (Phase 2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-crud.test.ts` → `Test Files 1 passed (1)` / `Tests 17 passed (17)` (exit 0; 93.62s) |
| Runtime harness command/scenario and exact result | Real ephemeral Neon branch created off the parent, `prisma migrate deploy` → "No pending migrations to apply", `provision-app-role.ts` minted a fresh `quimia_app` password, all 17 tests drove real Prisma/RLS/audit paths |
| Rollback boundary | Delete `src/modules/catalog/server/` (`require-catalog-admin.ts`, `catalog-queries.ts`, `create-catalog.action.ts`, `update-catalog.action.ts`, `deactivate-catalog.action.ts`, `reactivate-catalog.action.ts`) + `tests/integration/catalog/catalog-crud.test.ts` — registry/schemas (PR 1) remain and their tests still pass |

## Cumulative State

- Phase 1: 5/5 complete
- Phase 2: 8/8 complete (verified GREEN)
- Phase 3: 0/5
- Phase 4: 0/5
- Phase 5: 0/7

## Infrastructure Remediation Performed (orchestrator-authorized)

The integration harness was initially BLOCKED by a pre-existing Neon **production**-branch migration drift (branch `br-nameless-thunder-axmb9b2y` = root/default = `NEON_PARENT_BRANCH_ID`, and the branch local `DATABASE_URL`/`DIRECT_DATABASE_URL` point to). It carried a phantom migration record `20260919190343_supporting_catalogs` (applied 2026-09-19 from another machine, absent from the repo) and an `equipment` table violating the locked contract. Authorized remediation applied to that branch (owner role):

1. `ALTER TABLE "equipment" ALTER COLUMN "serialNumber" SET NOT NULL;` (0 rows → safe)
2. `ALTER TABLE "equipment" ALTER COLUMN "calibrationDate" TYPE timestamp(3) USING "calibrationDate"::timestamp;`
3. `DELETE FROM _prisma_migrations WHERE migration_name = '20260919190343_supporting_catalogs';`
4. `npx prisma migrate resolve --applied 20260907234515_catalog_supporting_models`

Result: `npx prisma migrate status` → **"Database schema is up to date!"**; the harness then created ephemeral branches cleanly. A full read-only audit confirmed every other object (5 tables' columns, indexes, RLS ENABLE+FORCE, `tenant_isolation` USING/WITH CHECK, `quimia_app` grants) already matched the contract.

**Not yet reconciled:** child branches `dev` (`br-round-heart-ax6aukmj`), `preview/main` (`br-royal-heart-axtabp68`) and `vercel-dev` (`br-bold-silence-axz5k42e`) were snapshotted from production *before* the fix, so they retain the drift independently. Ephemeral test branches are cut from production and were therefore fixed by the above.

## Test Defects Found and Fixed During Verification

Getting to GREEN surfaced four defects in the as-written RED test file (which had never executed):

1. **Isolation leak** — a single shared `tenantA` + reused names ("ELISA", "QUIMICA SANGUINEA") across tests made the `(tenantId, name)` unique constraint fire on a later test's first create (cascading 409s). Fixed by giving each test a unique name (`uniqueName()`) on shared tenants.
2. **Fragile date assertion** — `String(pgDate)` is not ISO and `pg` decodes `timestamp(3)` in the server's local zone. Replaced with a deterministic `to_char("calibrationDate", 'YYYY-MM-DD')` read.
3. **Missing audit in expectation** — the deactivate-inactive no-op test asserted only `[METHOD_DEACTIVATED]`, but `entityId` also carries the `METHOD_CREATED` row. Corrected to `[METHOD_CREATED, METHOD_DEACTIVATED]` (still proves no second DEACTIVATED).
4. **Connection-budget exhaustion / false timeouts** — 17 real `signInEmail` calls (each opening transactions on its own pool) plus per-test tenant churn saturated the free-tier branch: "Unable to start a transaction in the given time" and multi-minute hangs. Fixed by signing in once per role in `beforeAll` (3 sign-ins + one shared password hash) and removing per-test tenants; `testTimeout`/`hookTimeout` raised to 120s in `vitest.integration.config.ts`. Runtime dropped from ~620s (stalled) to 93s (green).

## Notes / Deviations

- **Resolved open question (from tasks.md)**: `updateCatalog` does **NOT** no-op when `before` ≡ `after` — an update ALWAYS writes its `{ENTITY}_UPDATED` audit row (only deactivate/reactivate carry the no-op contract). Implemented as resolved; asserted in 2.1's update tests.
- **Minor implementation choice (contract unchanged)**: `writeAuditLog` is called once per switch branch, inside the `transaction()` callback — matches the design's Data Flow literally. For deactivate/reactivate the no-op `return { id }` exits the transaction BEFORE the audit call, which is exactly the no-op semantics.
- **`catalogIdSchema` ownership**: defined and exported from `deactivate-catalog.action.ts`, imported by `reactivate-catalog.action.ts` (design: "shared deactivate/reactivate input"). No circular import (reactivate → deactivate only).
- **`getCatalogStats` return shape**: `Record<CatalogSlug, number>` (slug → active count), built from `Object.keys(CATALOGS)` so the registry stays the single source of truth; the hub (PR 5) maps labels from `CATALOGS`.
- **Test harness session shape**: `signIn(email, tenantId)` signs in once per role in `beforeAll` and shares the resulting cookie headers; tests isolate via unique names rather than unique tenants, to stay inside the free-tier connection budget.
- **No new migrations, no schema changes on the repo side** — Phase 2 is server code + tests only. (The only DB change was the authorized production-branch remediation above.)
- `npx tsc --noEmit` is clean (the previously-noted stale `.next/types/validator.ts` error did not resurface).
