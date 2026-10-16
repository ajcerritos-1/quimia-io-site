# Tasks: Supporting Catalogs Schema (Story 2.1, Change 1/6)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~320–380 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema + migration + 2 test files + verification | PR 1 (main) | Single PR; sdd-apply re-checks the 400 guard if the diff balloons. |

## Phase 1: Schema Foundation

- [x] 1.1 Append `Method`, `Technique`, `Container`, `SampleType` to `prisma/schema.prisma` after `AuditLog` (cuid2 `id`, bare `tenantId`, `name`, `isActive` default true, `createdAt`/`updatedAt`, `@@unique([tenantId,name])`, `@@index([tenantId])`, RLS comment, `@@map` `method`/`technique`/`container`/`sample_type`). Mirror `AuditLog` conventions.
- [x] 1.2 Append `Equipment` (same shape + required `model`, `serialNumber` not unique, nullable `calibrationDate`), `@@map("equipment")`.
- [x] 1.3 Run `prisma generate`; verify `npx prisma validate` passes and `db.method`/`db.equipment` exist.

## Phase 2: Migration + Dev-Branch Apply

- [x] 2.1 `prisma migrate dev --create-only --name catalog_supporting_models` (owner role, `DIRECT_DATABASE_URL`); confirm `<ts>_catalog_supporting_models/migration.sql` writes 5× `CreateTable` + `CreateIndex`.
      DEVIATION: `migrate dev` blocked by pre-existing drift on the dev DB (missing `audit_log_entityId_idx`); same SQL generated via `prisma migrate diff` over the clean migration history. See apply-progress.
- [x] 2.2 Hand-append per table (`method`,`technique`,`equipment`,`container`,`sample_type`) the `rls_roles`-verbatim block: `GRANT SELECT,INSERT,UPDATE,DELETE` to `quimia_app`, `ENABLE` + `FORCE RLS`, `CREATE POLICY tenant_isolation` on `current_setting('app.tenant_id',true)`; keep owner-role header.
- [x] 2.3 `prisma migrate diff`: confirm hand-edit added only RLS/grants; discard any generated `DROP POLICY`/`REVOKE`. — applied to a scratch ephemeral branch; diff back to schema = zero drift for the 5 tables (only pre-existing parent drift `audit_log_entityId_idx` surfaced).
- [x] 2.4 Apply to a real dev Neon branch via `prisma migrate dev`/`deploy`. Test: `_prisma_migrations` lists `catalog_supporting_models`. — covered by the integration harness (`migrate deploy`) + assertion in catalog-schema.test.ts.

## Phase 3: Integration Tests

- [x] 3.1 `tests/integration/catalog/catalog-schema.test.ts` (raw `pg`, `inject` urls, real branch): five tables match locked schema (R1); duplicate `(tenantId,name)` rejected `23505`; same name across tenants allowed; `Equipment` w/o `calibrationDate` stores NULL; `Container` is catalog-only lookup (R4); migration seeds no rows (R5, static — see deviation); `isActive` default + deactivated persists (R3).
- [x] 3.2 `tests/integration/catalog/catalog-rls.test.ts`: each table `ENABLE`+`FORCE` RLS + `tenant_isolation` policy (R2); unscoped app SELECT zero rows (fail-closed); tenant-A scoped query zero tenant-B rows; `pg_class.relforcerowsecurity` true on all five (owner-bypass guard, `harness-smoke` pattern); `quimia_app` SELECT/INSERT/UPDATE/DELETE in tenant (R7).
- [x] 3.3 cuid2 test (only via `scoped()`): `scoped({tenantId,role}).<model>.create()` returns unique cuid2 per row (R7). No mocked client. — implemented inside catalog-schema.test.ts (design maps it there).

## Phase 4: Verification

- [x] 4.1 `npm run test:integration` — new + existing green (22 files / 102 tests, `fileParallelism: false`).
- [x] 4.2 `npm run test` (50/50), `npx tsc --noEmit` (0), `npm run lint` (0), `npm run build` (0) — clean.
- [x] 4.3 Confirm NON-goals by diff: no UI, CRUD actions, nav, seed, `Study`/`Analyte`, or AuditLog write path/action constant (R6). — confirmed; pattern hits are comments only.
- [x] 4.4 Final diff: only `schema.prisma`, the new migration, `tests/integration/catalog/`; wrapper (`src/shared/db`) untouched.

> **DELIVERY GUARD TRIP**: actual diff = 771 changed lines (685 code + 86 apply-progress.md), forecast was 320-380.
> STOPPED per prompt rule ("if it exceeds 400, STOP and report") — review guard must re-evaluate
> (recommended: size:exception single PR — the change is atomic, tests are the migration's only proof;
> or chained slice schema+migration first). All 13 tasks are DONE; only the delivery decision is open.