# Supporting Catalogs Specification

## Purpose

Schema substrate for the five supporting-catalog models (`Method`, `Technique`, `Equipment`, `Container`, `SampleType`) that Study (Story 2.2) references by FK. Ships models, one migration, RLS, and integration tests only — no UI, CRUD actions, nav entry, or seed data. Catalog UI lives under hub `/configuracion` (nav ships in the first UI change, 2/6). Traces to: BMad Story 2.1 ACs 1–2; AD-2, AD-3, AD-6, AD-8; FR-5, FR-9.

## Requirements

### Requirement: Five Catalog Models Follow the Locked Field Contract

The system MUST define models `Method`, `Technique`, `Equipment`, `Container`, `SampleType`, each with `id String @id @default(cuid(2))`, bare `tenantId String` (no FK relation to `Tenant` — AuditLog precedent), `name String`, `isActive Boolean @default(true)`, `createdAt`/`updatedAt`, `@@map` snake_case, `@@index([tenantId])`, `@@unique([tenantId, name])`. `Equipment` MUST additionally carry required `model`/`serialNumber` (descriptive, not unique) and nullable `calibrationDate DateTime?` (FR-9). No fields beyond this contract MAY be added.

#### Scenario: All five tables match the locked schema

- GIVEN migration `catalog_supporting_models` applied
- WHEN the schema is inspected
- THEN `method`, `technique`, `equipment`, `container`, `sample_type` exist with the exact fields above

#### Scenario: Duplicate name within a tenant rejected

- GIVEN tenant A has `Method` "QUIMICA SANGUINEA"
- WHEN tenant A creates another `Method` with the same name
- THEN creation fails with a `(tenantId, name)` uniqueness violation

#### Scenario: Same name across tenants allowed

- GIVEN tenant A has `Method` "QUIMICA SANGUINEA"
- WHEN tenant B creates a `Method` with the same name
- THEN tenant B's row is created — uniqueness is per tenant (AD-8)

#### Scenario: Equipment stores calibration data

- GIVEN a new `Equipment` row
- WHEN created with `model`, `serialNumber`, no `calibrationDate`
- THEN `calibrationDate` is NULL — uncalibrated equipment is valid

### Requirement: RLS Is Enforced on Every Catalog Table (AD-2/AD-3)

Each table MUST have `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy on `current_setting('app.tenant_id', true)`, applied by the owner/migration role via `DIRECT_DATABASE_URL` (never `quimia_app`). `quimia_app` MUST receive `GRANT SELECT, INSERT, UPDATE, DELETE` (User precedent; deactivate-not-delete is an app rule, not a grant revocation). Per AD-2/AD-3: these are tenant-owned tables; every runtime query must be scoped, and the non-owner app role prevents owner-bypass.

#### Scenario: Migration enables FORCE RLS per table

- GIVEN the migration applied via the owner role
- WHEN policies are listed per table
- THEN each of the five tables has RLS ENABLED + FORCE with a `tenant_isolation` policy

#### Scenario: Unscoped query is fail-closed

- GIVEN no `app.tenant_id` is set
- WHEN `quimia_app` selects from `method`
- THEN zero rows return — `tenantId = NULL` is NULL, never all rows

#### Scenario: Cross-tenant access is impossible

- GIVEN tenant A's scoped session and tenant B rows exist
- WHEN tenant A queries any catalog table
- THEN zero tenant-B rows appear

#### Scenario: Owner cannot bypass isolation

- GIVEN `FORCE ROW LEVEL SECURITY` is set
- WHEN the owner role queries without a tenant setting
- THEN it also sees zero rows — FORCE subjects the owner to RLS; missing FORCE is forbidden

### Requirement: Deactivate-Not-Delete Is the Lifecycle Contract

The app MUST deactivate catalog rows via `isActive = false` and MUST NOT hard-delete them; Study (Story 2.2) references these rows by FK. Full-CRUD grants remain; the no-delete rule is the semantic contract app code honors.

#### Scenario: Deactivated entry remains for FK reference

- GIVEN `Method` "ELISA" is deactivated
- WHEN a Study later references it
- THEN the row still exists with `isActive = false` — no hard delete occurred

### Requirement: Container Is a Catalog Lookup, Not Order Identity (AD-6)

The `Container` model MUST represent container types a Study can reference (e.g., "tubo lila EDTA") — same role as Method/Technique. It MUST NOT model per-tube Sample/Container order identity, the entity AD-6 forbids (barcode identical across every tube of one order; tube color is a phlebotomy draw-guide).

#### Scenario: Container row is a lookup value

- GIVEN `Container` "tubo lila EDTA" exists
- WHEN a Study references it by `containerId`
- THEN it resolves to the catalog row — no order/tube identity is modeled

### Requirement: No Seed Data

The migration SHOULD NOT insert seed rows; the lab configures its own catalogs.

#### Scenario: Fresh branch starts empty

- GIVEN a new ephemeral Neon branch after migration
- WHEN any catalog table is queried
- THEN it contains zero rows

### Requirement: AuditLog Mutation Actions Are Deferred to CRUD Changes

This change MUST NOT implement AuditLog write paths. Mutation actions (`METHOD_CREATED/UPDATED/DEACTIVATED/REACTIVATED` and per-entity variants) are a recorded commitment: CRUD changes 2–6 MUST write them via `writeAuditLog` in the same transaction as the mutation (AD-10).

#### Scenario: No audit writes ship in this change

- GIVEN this change is applied
- WHEN the diff is inspected
- THEN no AuditLog write path or action constant exists — the commitment is recorded for changes 2–6

### Requirement: Integration Tests Verify RLS and Constraints on a Real Neon Branch

Integration tests (`vitest.integration.config.ts`, `fileParallelism: false`) MUST run against a real ephemeral Neon branch and MUST prove: unscoped queries return zero rows; tenant A cannot read tenant B rows; `quimia_app` can SELECT/INSERT/UPDATE/DELETE; FORCE RLS blocks owner bypass; ids are cuid2, unique per row; `(tenantId, name)` uniqueness is per tenant. A mocked Prisma client MUST NOT be accepted as RLS evidence.

#### Scenario: Full grant surface works as app role

- GIVEN a scoped `quimia_app` connection on a Neon branch
- WHEN SELECT/INSERT/UPDATE/DELETE run against a catalog table
- THEN each succeeds within the tenant's own rows

#### Scenario: cuid2 ids are generated per row

- GIVEN rows inserted across the five tables
- WHEN ids are inspected
- THEN each is a cuid2 id, unique per row