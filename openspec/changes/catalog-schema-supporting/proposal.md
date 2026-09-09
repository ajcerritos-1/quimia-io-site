# Proposal: Supporting Catalogs Schema (Story 2.1, Change 1/6)

## Intent

Story 2.2 (Study) needs five catalog FKs (`sampleTypeId`, `methodId`, `techniqueId`, `equipmentId`, `containerId`) to exist before it can be built — none do today. `prisma/schema.prisma` has only Tenant/User/AuditLog/Better-Auth tables; zero catalog models. This change ships the schema substrate **first**, so each follow-up CRUD change stays under the 400-line review budget instead of one combined schema+UI change (~700+ lines, rejected in exploration).

## Scope

### In Scope

- 5 Prisma models: `Method`, `Technique`, `Equipment`, `Container`, `SampleType`
- Single migration with hand-appended RLS blocks (per-table `ENABLE` + `FORCE` + `tenant_isolation` policy + `GRANT` to `quimia_app`)
- Integration tests against a real Neon branch

### Out of Scope

- No UI, no CRUD server actions, no nav entry, no seed data
- No `Study`/`Analyte` models (Stories 2.2–2.5)
- No AuditLog write-path implementation (deferred to CRUD changes 2–6)

## Locked Decisions (context; do not re-open)

1. **Route structure**: single hub `/configuracion` (option A). Nav entry "Configuración" ships in the first UI change, not here. Recorded as context for change 2.
2. **`isActive` on all 5 models** — deactivate, never delete (Story 2.2 references these via FK).
3. **RLS hand-appended per table**, per `rls_roles` precedent.
4. **Equipment** carries `model`, `serialNumber`, `calibrationDate?`; the other four carry `name` + `isActive` only.
5. **No seed data** — lab configures its own catalogs; empty state already in the UI pattern.
6. **AuditLog**: this change ships MODELS + RLS + migrations + integration tests only. Mutation actions (`METHOD_CREATED/UPDATED/DEACTIVATED/REACTIVATED` and per-entity variants) are a design commitment recorded now, implemented with each CRUD change (2–6).

## Model Definitions

All models follow existing conventions: `id String @id @default(cuid(2))`, bare `tenantId String` (no FK relation to `Tenant` — matches `AuditLog`, keeps `Tenant` untouched), `isActive Boolean @default(true)`, `createdAt`/`updatedAt`, `@@map` snake_case, RLS comment.

| Model | @@map | Extra fields | `@@unique` | `@@index` |
|---|---|---|---|---|
| Method | `method` | `name String` | `[tenantId, name]` | `[tenantId]` |
| Technique | `technique` | `name String` | `[tenantId, name]` | `[tenantId]` |
| Equipment | `equipment` | `name String`, `model String`, `serialNumber String`, `calibrationDate DateTime?` | `[tenantId, name]` | `[tenantId]` |
| Container | `container` | `name String` | `[tenantId, name]` | `[tenantId]` |
| SampleType | `sample_type` | `name String` | `[tenantId, name]` | `[tenantId]` |

- `calibrationDate` nullable (FR-9; equipment may not be calibrated yet). `model`/`serialNumber` required (locked decision #4).
- Composite `@@unique([tenantId, name])` mirrors the AD-8 multi-tenant uniqueness override — unique **per tenant**, not global.
- `serialNumber` is descriptive, not an identity key (no unique constraint).

## RLS Design

Repeat this block per table (identical shape to `rls_roles` migration, lines 20–35):

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON "<table>" TO quimia_app;
ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "<table>"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
```

- Full CRUD grant (unlike `audit_log`'s SELECT+INSERT only) — matches the `user` precedent; "deactivate, never delete" is an app-layer rule (isActive), not a grant-level revocation.
- Applied by the owner/migration role via `DIRECT_DATABASE_URL` (`prisma.config.ts`), never `quimia_app`.
- **Fail-closed**: unresolved tenant → `current_setting(..., true)` returns NULL → `tenantId = NULL` is NULL (not TRUE) → zero rows. App role without grant → P4034.

## Migration Strategy

Single migration `catalog_supporting_models` (`prisma migrate dev --name catalog_supporting_models`):
1. Prisma generates `CreateTable` + `CreateIndex` for all 5 tables.
2. Hand-append the RLS block (above) for each of the 5 tables, in the same file, with the `rls_roles`-style owner-role comment header.

## Testing Strategy

Integration tests against a real ephemeral Neon branch (`vitest.integration.config.ts`, `fileParallelism: false`), strict TDD, `vitest run`:

- **RLS fail-closed**: unscoped query returns zero rows.
- **Tenant isolation**: tenant A cannot SELECT tenant B rows.
- **Grants work**: `quimia_app` can SELECT/INSERT/UPDATE/DELETE.
- **FORCE RLS enforced**: owner role cannot bypass isolation.
- **cuid2 generation**: ids are generated, unique per row.

A mocked Prisma client is rejected as RLS evidence (tenant-isolation spec).

## Capabilities

### New Capabilities

- `supporting-catalogs`: schema contract for the five supporting catalog models (Method, Technique, Equipment, Container, SampleType) with tenant isolation via RLS.

### Modified Capabilities

- None — this instantiates the existing `tenant-isolation` contract on new tables without changing its requirements.

## Approach

Schema-first slice. The **AD-6 clarification**: the `Container` CATALOG model does **not** violate AD-6. AD-6 forbids a per-tube Sample/Container entity for *order identity* (the barcode is identical across every tube of one order; tube color is a phlebotomy draw-guide). The `Container` catalog here is a **lookup table** — the list of container types a Study can reference (e.g. "tubo lila EDTA") — the same role as Method/Technique. No order/tube identity is modeled.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `prisma/schema.prisma` | Modified | Add 5 models |
| `prisma/migrations/<ts>_catalog_supporting_models/` | New | CreateTable + hand-appended RLS |
| `tests/integration/catalog/` | New | RLS + isolation + grant tests |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Missing `FORCE` in hand-edit → owner bypasses RLS (silent leak) | Med | Integration test asserts FORCE RLS; copy `rls_roles` block verbatim |
| Missing `GRANT` → app gets P4034 | Med | Integration test covers app-role SELECT/INSERT |
| AD-6 misread: "no Container entity" → someone deletes the catalog model | Low | Explicit clarification above + design section binding note |
| Over-modeling (extra fields not in FR-9) | Low | Locked decision #4 caps fields |
| Planning-doc vs real schema mismatch | Low | None — spine ERD is aspirational; this is the concrete catalog schema |

## Rollback Plan

Greenfield, no consumers. Revert the single migration (`prisma migrate resolve --rolled-back`, or drop the 5 tables with the owner role) and `git revert`. Simplest: delete the ephemeral Neon branch. No data-loss concern — no rows exist yet.

## Dependencies

- Neon project + `DIRECT_DATABASE_URL` (owner role) for migration; `NEON_API_KEY`/`NEON_PROJECT_ID`/`NEON_PARENT_BRANCH_ID` for integration tests.
- `rls_roles` migration already applied (role `quimia_app` exists).

## Success Criteria

- [ ] 5 models in `schema.prisma`, following existing conventions
- [ ] One migration creates 5 tables with hand-appended `FORCE RLS` + `tenant_isolation` + `GRANT quimia_app`
- [ ] Integration tests pass on a real Neon branch (fail-closed, isolation, grants, FORCE, cuid2)
- [ ] `vitest run` green
- [ ] No UI, CRUD actions, seed data, or Study/Analyte models introduced
