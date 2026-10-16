# Design: Supporting Catalogs Schema (Story 2.1, Change 1/6)

## Technical Approach

Schema-first substrate for the five catalog lookup tables Study (Story 2.2) needs by FK. Ships **5 Prisma models + 1 hand-appended migration + 2 integration test files**. No UI, no server actions, no nav, no seed, no `Study`/`Analyte`. The wrapper (`src/shared/db`) needs **zero changes** — it is model-agnostic.

**Key fact — wrapper is untouched (AD-3):** `scoped.ts` hooks `$allModels.$allOperations`, so the 5 new models are covered automatically once `prisma generate` regenerates the client. `index.ts`/`bootstrap.ts`/`errors.ts` reference no specific catalog model. The only prerequisite is regenerating the client (`prisma migrate dev` does this) so `db.method`, `db.equipment`, etc. exist for the tests.

## Architecture Decisions

| # | Decision | AD | Choice | Tradeoff / rationale |
|---|---|---|---|---|
| 1 | Bare `tenantId`, no FK to `Tenant` | AD-2, AD-4 | Mirror `AuditLog` | Keeps `Tenant` untouched; RLS is the boundary, not FK. Proposal locked it. |
| 2 | `FORCE ROW LEVEL SECURITY` per table | AD-2 | `ENABLE` + `FORCE` + `tenant_isolation` policy + full `GRANT` | Without `FORCE` the table owner silently bypasses RLS (silent leak). Owner/migration role applies it, never `quimia_app`. |
| 3 | `@@unique([tenantId, name])` | AD-8 | Composite, per-tenant | Name unique **per tenant**, not global (AD-8 multi-tenant uniqueness principle). |
| 4 | Full-CRUD `GRANT SELECT, INSERT, UPDATE, DELETE` | AD-2, AD-10 | Full grant | "Deactivate, never delete" is an app-layer `isActive` rule, not a grant revocation (User precedent; unlike `audit_log`'s SELECT+INSERT). |
| 5 | `Container` = catalog **lookup**, not order identity | AD-6 | Lookup table | **The Container catalog model does NOT violate AD-6, because AD-6 forbids per-tube order-identity entities, not catalog lookups.** AD-6 kills a per-tube Sample/Container identity model (barcode identical across every tube of an order; tube color is a phlebotomy draw-guide). `Container` here is the list of container *types* a Study references ("tubo lila EDTA") — the same role as Method/Technique. No order/tube identity is modeled. |
| 6 | No wrapper change | AD-3 | Regenerate client only | `$allModels` auto-covers new models; no third mode invented. |
| 7 | Single migration `catalog_supporting_models` | AD-4 | One file | All 5 tables are the same atomic substrate; splitting buys nothing and inflates review surface. |
| 8 | No `AuditLog` write path | AD-10 | Deferred to CRUD 2–6 | Schema-only change; mutation actions (`*_CREATED/UPDATED/DEACTIVATED/REACTIVATED`) are a recorded commitment, implemented per CRUD change in the same transaction as the mutation. |

## File Plan

### 1. `prisma/schema.prisma` — MODIFY (append 5 models after `AuditLog`)

Final-form blocks (identical for Method/Technique/Container/SampleType; Equipment adds 3 fields):

```prisma
// ---- Supporting catalogs (Story 2.1) ----
// Catalog lookup tables Study (Story 2.2) references by FK. Tenant-owned
// (AD-2/AD-3): bare tenantId (AuditLog precedent), isActive
// (deactivate-never-delete), @@unique([tenantId, name]) (AD-8), RLS + FORCE
// via the catalog_supporting_models migration. Full CRUD grant to quimia_app.

model Method {
  id        String   @id @default(cuid(2))
  tenantId  String
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId])
  // RLS + FORCE ROW LEVEL SECURITY (D5): tenant_isolation policy on
  // current_setting('app.tenant_id'). See catalog_supporting_models migration.
  @@map("method")
}

model Technique { /* … same shape … @@map("technique") */ }

model Equipment {
  id              String    @id @default(cuid(2))
  tenantId        String
  name            String
  model           String
  serialNumber    String     // descriptive, not unique (locked decision #4)
  calibrationDate DateTime?  // nullable (FR-9: equipment may be uncalibrated)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId])
  // RLS + FORCE ROW LEVEL SECURITY (D5): tenant_isolation policy on
  // current_setting('app.tenant_id'). See catalog_supporting_models migration.
  @@map("equipment")
}

model Container { /* … same shape … @@map("container") */ }
model SampleType { /* … same shape … @@map("sample_type") */ }
```

`@@map` targets: `method`, `technique`, `equipment`, `container`, `sample_type`. Each carries exactly: `id`, `tenantId`, `name`, `isActive`, `createdAt`, `updatedAt` (+ Equipment's `model`/`serialNumber`/`calibrationDate`). No field beyond the proposal contract (FR-9 cap).

### 2. `prisma/migrations/<ts>_catalog_supporting_models/migration.sql` — NEW

Generated via `prisma migrate dev --create-only --name catalog_supporting_models`, then hand-appended. Prisma emits per table (`method` shown; repeat for all five, `equipment` adds `model`/`serialNumber`/`calibrationDate`):

```sql
-- CreateTable
CREATE TABLE "method" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "method_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "method_tenantId_idx" ON "method"("tenantId");
-- CreateIndex
CREATE UNIQUE INDEX "method_tenantId_name_key" ON "method"("tenantId", "name");
```

Hand-append (owner-role header copied from `rls_roles`, then ×5):

```sql
-- Hand-appended (Story 2.1, AD-2). Applied by the schema OWNER/migration role
-- only (never quimia_app) -- FORCE RLS subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "method" TO quimia_app;
ALTER TABLE "method" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "method" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "method"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
```

Repeat for `technique`, `equipment`, `container`, `sample_type`.

### 3–4. Integration test files — NEW (`tests/integration/catalog/`)

`vitest.integration.config.ts` `include: ["tests/integration/**/*.test.ts"]` already covers the subdirectory; same Neon harness as `db-rls-fail-closed.test.ts` / `audit-log-immutable.test.ts` (`inject("ownerDatabaseUrl")` / `inject("appDatabaseUrl")` + `set_config('app.tenant_id', …)`), `fileParallelism: false`, real branch, **no mocks**.

## Sequence Diagrams

### Migration apply flow (owner role)

```
dev shell
  └─ prisma migrate dev --create-only --name catalog_supporting_models
       ├─ Prisma reads prisma.config.ts → DIRECT_DATABASE_URL (owner role, never quimia_app)
       └─ writes 5× CreateTable + CreateIndex into migration.sql
dev hand-appends RLS block per table (GRANT → ENABLE → FORCE → POLICY)
  └─ prisma migrate dev   (or `prisma migrate deploy` in CI / neon-global-setup)
       └─ owner role applies: CREATE TABLE → GRANT quimia_app → ENABLE+FORCE RLS → CREATE POLICY
```

### Runtime tenant-scoped query (fail-closed)

```
request → middleware resolves tenant → runWithContext({tenantId, role})
  └─ module calls scoped({tenantId, role}).method.findMany()
       └─ $allOperations: base.$transaction([
            set_config('app.tenant_id', tenantId, TRUE),
            set_config('app.role', role, TRUE),
            SELECT … FROM "method"
          ])
  └─ Postgres:
       quimia_app has no SELECT grant?            → P4034 (permission denied)
       policy USING tenantId = current_setting(…):
         tenant matches  → row visible
         no tenant set   → tenantId = NULL = NULL → zero rows  (FAIL-CLOSED)
         wrong tenant    → filtered out                        (ISOLATION)
       FORCE RLS present → owner cannot silently bypass (production safety)
```

## Testing Design (per-scenario mapping)

Strict TDD `vitest run` via `npm run test:integration`. Red/green applies to the test *assertions* (migration ships first, tests prove it). Raw `pg` for RLS/constraint assertions; the **cuid2 test is the only one going through `scoped()`** (cuid2 is generated client-side by Prisma — the DB column has no default, so raw SQL cannot exercise it).

| File | Test name | Scenario satisfied |
|---|---|---|
| `catalog/catalog-rls.test.ts` | each catalog table has `ENABLE` + `FORCE` RLS and a `tenant_isolation` policy | R2 "Migration enables FORCE RLS per table" |
| | an unscoped app-role `SELECT` returns zero rows | R2 "Unscoped query is fail-closed" |
| | a tenant-A scoped query returns zero tenant-B rows | R2 "Cross-tenant access is impossible" |
| | `relforcerowsecurity` is true on all five tables | R2 "Owner cannot bypass isolation" (see note) |
| | `quimia_app` can SELECT/INSERT/UPDATE/DELETE within its own tenant | R7 "Full grant surface works as app role" |
| `catalog/catalog-schema.test.ts` | five tables exist with the locked column set | R1 "All five tables match the locked schema" |
| | duplicate name within a tenant rejected (code `23505`) | R1 "Duplicate name within a tenant rejected" |
| | same name across two tenants allowed | R1 "Same name across tenants allowed" |
| | `Equipment` without `calibrationDate` stores `NULL` | R1 "Equipment stores calibration data" |
| | `Container` carries catalog columns only — no order/tube identity | R4 "Container row is a lookup value" |
| | a fresh branch has zero catalog rows (no seed) | R5 "Fresh branch starts empty" |
| | `isActive` defaults true; deactivated row persists | R3 "Deactivated entry remains for FK reference" |
| | ids are cuid2, unique per row (via `scoped().<model>.create()`) | R7 "cuid2 ids are generated per row" |

Requirement 6 (AuditLog deferred) is **not a test** — verified by diff review: no `writeAuditLog` call or action constant ships.

**Owner-bypass note (scenario deviation):** the spec's literal "owner SELECT → zero rows" is not reproducible in this harness — Neon's branch-owner role demonstrably bypasses RLS (every existing test seeds via owner with no tenant context; `db-scoped-isolation.test.ts` header confirms this). The deterministic proof that "missing FORCE is forbidden" is the structural `pg_class.relforcerowsecurity = true` check per table (identical to `harness-smoke.test.ts` lines 62–79), which asserts the exact Postgres property that removes the owner's implicit bypass. Flagged as an open question, not silently skipped.

## Rollback Plan

Greenfield, zero consumers, zero rows. Revert the single migration (`prisma migrate resolve --rolled-back <ts>_catalog_supporting_models`, or drop the 5 tables via owner role) and `git revert`. Simplest path for a failed test run: delete the ephemeral Neon branch (teardown + `docs/neon-branch-cleanup.md`). No data-loss concern.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Missing `FORCE` in hand-edit → owner bypass (silent leak) | Med | Test asserts `relforcerowsecurity`; copy `rls_roles` block verbatim. |
| Missing `GRANT` → app gets P4034 | Med | Full-grant-surface test covers app-role SELECT/INSERT/UPDATE/DELETE. |
| Future `migrate dev` generates `DROP POLICY`/`REVOKE` for hand-edited objects (invisible to `schema.prisma`) | Med | `--create-only` + manual review, discard any RLS/grants drop — `user_lockout_columns` migration precedent (verify via `prisma migrate diff`). |
| AD-6 misread → someone deletes `Container` catalog model | Low | Explicit clarification (decision #5). |
| Test harness flakiness (Neon cold-start, free-tier branch cap from killed runs) | Med | `TRANSACTION_OPTIONS` widened (10s/20s), `fileParallelism: false`, `docs/neon-branch-cleanup.md`. |
| Spec scenario "owner SELECT → zero rows" not literally reproducible | — | Structural `relforcerowsecurity` assertion instead (documented above). |

**Estimated changed lines: ~300–350** (schema ~90, migration ~140, tests the bulk). **Risk: Low.** `sdd-tasks` should forecast the two test files against the 400-line review budget; if tight, the schema+migration ships first and the test files can follow as a chained PR slice.

## Open Questions

- [ ] Confirm `sdd-tasks` slices: ship schema+migration and the two test files in one PR vs. a chained tests-PR (line-budget dependent).
