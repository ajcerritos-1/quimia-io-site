# Study Catalog Specification

## Purpose

Schema substrate for the `Study` model — the lab's definition of a billable test (the hinge entity, AD-4) — and for the `Study` ↔ `Container` many-to-many join (`StudyContainer`, AD-21). This capability ships models, one migration, RLS, and integration tests only: no UI, CRUD actions, route, registry wiring, audit writes, or seed data (those ship in the sibling slice `configuracion-study-crud`). `Study` selects its sample type, method, technique, equipment, and container(s) from the five Story 2.1 catalogs (`supporting-catalogs` capability) by foreign key — never free text. Traces to: BMad Story 2.2 ACs; AD-2, AD-3, AD-4, AD-6, AD-8, AD-21; FR-5, FR-8, FR-19; NFR-9.

## Requirements

### Requirement: Study Model Follows the Locked Field Contract

The system MUST define model `Study` with: `id String @id @default(cuid(2))`; bare `tenantId String` (no FK relation to `Tenant` — `AuditLog` precedent, AD-2/AD-3); `code String`; `name String`; `area String`; `sampleTypeId String` (FK → `SampleType`); `methodId String` (FK → `Method`); `techniqueId String` (FK → `Technique`); `equipmentId String?` (nullable FK → `Equipment`); `patientConditions String?`; `processDays Int @default(1)`; `price Decimal @db.Decimal(10,2)`; `tax Boolean @default(false)`; `printMethod Boolean @default(false)`; `printTechnique Boolean @default(false)`; `printEquipment Boolean @default(false)`; `printSample Boolean @default(false)`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt`. The model MUST declare `@@map("study")`, `@@index([tenantId])`, and `@@unique([tenantId, code])`. `code`, `name`, `area`, `price`, and the three required FK columns (`sampleTypeId`, `methodId`, `techniqueId`) MUST be required; `equipmentId` and `patientConditions` MUST be nullable. `name` MUST NOT be unique.

#### Scenario: All columns match the locked schema

- GIVEN migration for this change is applied
- WHEN the `study` table is inspected
- THEN it has exactly the fields above, with `@@unique([tenantId, code])`, `@@index([tenantId])`, and snake_case `@@map`
- AND the required/nullable split matches the contract (`equipmentId` and `patientConditions` nullable; the rest required)

#### Scenario: Same name within a tenant is allowed

- GIVEN tenant A has a `Study` named "QUIMICA SANGUINEA 6 ELEMENTOS"
- WHEN tenant A creates another `Study` with the same `name` and a different `code`
- THEN the row is created — `name` is not unique (D7)

#### Scenario: Defaults apply on create

- GIVEN a `Study` created without explicit optional values
- WHEN the row is read back
- THEN `processDays` is 1, `isActive` is true, `tax` is false, and `printMethod`/`printTechnique`/`printEquipment`/`printSample` are each false

#### Scenario: equipmentId may be NULL

- GIVEN a `Study` that runs on no instrument
- WHEN it is created with `equipmentId` NULL
- THEN the row is created — a study without equipment is valid (D8)

#### Scenario: Decimal(10,2) round-trips a price

- GIVEN a `Study` created with `price` `1234.56`
- WHEN the row is read back
- THEN `price` equals `1234.56` with two-decimal `Decimal(10,2)` fidelity (NFR-9, MXN)

### Requirement: Study Selects Its Catalogs by Foreign Key, Never Free Text

The system MUST model `sampleTypeId`, `methodId`, `techniqueId`, and `equipmentId` as foreign keys into the five Story 2.1 catalogs, and a `Study`'s catalog-backed attributes MUST resolve to catalog rows — the system MUST NOT accept free-text values for sample type, method, technique, or equipment (Story 2.2 AC; AD-6). `equipmentId` MAY be NULL because many studies run on no instrument (D8). A `Study` insert MUST carry the scoped `tenantId`, enforced by the RLS `WITH CHECK` policy (AD-2/AD-3). A `Study` MUST NOT reference a catalog row from another tenant, and this MUST be made structurally impossible by composite tenant-scoped foreign keys — each catalog FK MUST carry `tenantId` into the referenced table: `(sampleTypeId, tenantId) → sample_type(id, tenantId)`, `(methodId, tenantId) → method(id, tenantId)`, `(techniqueId, tenantId) → technique(id, tenantId)`, and `(equipmentId, tenantId) → equipment(id, tenantId)` — so the referenced row MUST share the `Study`'s `tenantId`. RLS MUST NOT be relied on for this guarantee: PostgreSQL referential-integrity checks always bypass row-level security, so a plain single-column FK would resolve a `tenantId = A` study to tenant B's catalog row even though that row is RLS-hidden. To supply the composite target, each referenced catalog model (`SampleType`, `Method`, `Technique`, `Equipment`) MUST expose `@@unique([id, tenantId])` (index-only; adds no persisted column). Every runtime read or write of `Study` MUST go through `src/shared/db` (`scoped()`/`transaction()`), never a bare `prisma.study` call (AD-3).

#### Scenario: Study resolves against its catalog rows

- GIVEN the five catalog rows for tenant A exist
- WHEN a `Study` is created referencing them by `sampleTypeId`/`methodId`/`techniqueId`/`equipmentId`
- THEN each attribute resolves to its catalog row — no free text is stored

#### Scenario: FK to a non-existent catalog row is rejected

- GIVEN no `SampleType` row with id `st_missing`
- WHEN a `Study` is created with `sampleTypeId = "st_missing"`
- THEN creation fails with a foreign-key violation

#### Scenario: Study cannot reference another tenant's catalog row

- GIVEN tenant B owns `Method` "ELISA" (seedable by the owner role so the referential-integrity check can see it) and tenant A is scoped
- WHEN tenant A's `Study` attempts to reference tenant B's `Method` by `methodId`
- THEN the insert is rejected with a composite foreign-key violation (23503)
- AND a plain single-column `methodId` FK would have accepted the insert, because PostgreSQL RI checks bypass RLS, so the composite `(methodId, tenantId) → method(id, tenantId)` key is the mechanism that makes the cross-tenant reference structurally impossible

### Requirement: FK onDelete Restrict Enforces Deactivate-Not-Delete

Every catalog relation on `Study` MUST declare `onDelete: Restrict`, so the database enforces the deactivate-not-delete contract and MUST NOT orphan or cascade-delete a catalog row that a `Study` references. Deleting a catalog row referenced by any `Study` MUST fail; deactivating it (`isActive = false`) MUST keep it referenceable.

#### Scenario: Deleting a referenced catalog row fails

- GIVEN a `Study` references `Method` "ELISA"
- WHEN the owner attempts to `DELETE` that `Method` row
- THEN the delete fails with a foreign-key `Restrict` violation

#### Scenario: No cascade delete of a referenced catalog row

- GIVEN a `Study` references `Container` "tubo lila EDTA"
- WHEN the referenced `Container` row is targeted for deletion
- THEN the row is not cascade-deleted and the `Study` FK is not orphaned

#### Scenario: A deactivated catalog row remains referenceable

- GIVEN `Method` "ELISA" is deactivated (`isActive = false`)
- WHEN a `Study` references it
- THEN the row still exists and the FK resolves

### Requirement: code Uniqueness Is Per Tenant (AD-8)

The system MUST enforce `@@unique([tenantId, code])` on `Study`: `code` MUST be unique within a tenant and MUST NOT be globally unique. The same `code` MAY exist in different tenants (AD-8). `name` MUST NOT be constrained unique.

#### Scenario: Duplicate code within a tenant rejected

- GIVEN tenant A has a `Study` with `code` "QS6"
- WHEN tenant A creates another `Study` with `code` "QS6"
- THEN creation fails with a `(tenantId, code)` uniqueness violation

#### Scenario: Same code across tenants allowed

- GIVEN tenant A has a `Study` with `code` "QS6"
- WHEN tenant B creates a `Study` with `code` "QS6"
- THEN tenant B's row is created — uniqueness is per tenant (AD-8)

#### Scenario: Duplicate name within a tenant allowed

- GIVEN tenant A has a `Study` with `name` "PERFIL LIPIDICO"
- WHEN tenant A creates another `Study` with the same `name` and a different `code`
- THEN the row is created — `name` carries no uniqueness constraint

### Requirement: Study ↔ Container Is an Explicit Tenant-Scoped Many-to-Many

The `Study` ↔ `Container` relation MUST be an explicit join model `StudyContainer` (`@@map("study_container")`), NOT Prisma's implicit many-to-many. `StudyContainer` MUST own `id String @id @default(cuid(2))`, `tenantId String`, `studyId String` (FK → `Study`), `containerId String` (FK → `Container`), `@@unique([studyId, containerId])`, and `@@index([tenantId])`. Because a Prisma implicit `_StudyToContainer` join table has no `tenantId` column, it cannot carry RLS; the explicit model is required so join rows are tenant-scoped and RLS-protectable (AD-2/AD-21) — a study may require more than one tube (e.g. serum + EDTA). Each distinct container MUST be linked at most once per study. Linking a `Study` in one tenant to a `Container` in another tenant MUST be structurally impossible, made so by composite tenant-scoped foreign keys: both join FKs MUST be composite — `(studyId, tenantId) → study(id, tenantId)` and `(containerId, tenantId) → container(id, tenantId)` — so the join row's `tenantId` MUST equal both the referenced study's tenant and the referenced container's tenant; linking tenant A's study to tenant B's container would require the join row's `tenantId` to be A and B at once. RLS MUST NOT be relied on for this guarantee: PostgreSQL referential-integrity checks always bypass row-level security, so a plain single-column join FK would resolve to the other tenant's row even though that row is RLS-hidden. To supply the composite targets, `Study` MUST expose `@@unique([id, tenantId])` and `Container` MUST expose `@@unique([id, tenantId])` (index-only; adds no persisted column). Because the join table carries its own `tenantId`, it MUST be RLS-protected (`tenant_isolation` on `current_setting('app.tenant_id', true)`), and every runtime query MUST be scoped through `src/shared/db` (`scoped()`/`transaction()`), never a bare `prisma.studyContainer` call (AD-2/AD-3). The application layer SHOULD require at least one container per study; this minimum is an app-level rule, not a database constraint.

#### Scenario: Two distinct containers yield two join rows

- GIVEN a `Study` requires a serum tube and an EDTA tube
- WHEN both distinct containers are linked to the study
- THEN `study_container` holds exactly two rows, one per distinct container

#### Scenario: Duplicate link rejected

- GIVEN a `Study` is already linked to `Container` C1
- WHEN the same `(studyId, containerId)` pair is inserted again
- THEN creation fails with a `(studyId, containerId)` uniqueness violation

#### Scenario: Implicit join table is not used

- GIVEN the schema and migration for this change are applied
- WHEN relationships are inspected
- THEN the join is the explicit `study_container` table and no implicit `_StudyToContainer` table exists

#### Scenario: Cross-tenant link is impossible

- GIVEN a `Study` owned by tenant A and a `Container` owned by tenant B (the container seedable by the owner role so the referential-integrity check can see it)
- WHEN an attempt is made to link them through a `study_container` row scoped to tenant A
- THEN the insert is rejected with a composite foreign-key violation (23503)
- AND a plain single-column `containerId` join FK would have accepted the insert, because PostgreSQL RI checks bypass RLS, so the composite `(containerId, tenantId) → container(id, tenantId)` key is the mechanism that makes the cross-tenant link structurally impossible

### Requirement: Container Exposes a Nullable Color for Label Printing (AD-21)

The `Container` catalog model MUST carry a nullable `color String?` column — the tube color (e.g., "amarillo"/"lila"/"rojo") that drives Epic 6 container-label printing. The column MUST be nullable because non-tube containers (e.g., "Frasco", "Laminilla") have no tube colour. Adding the column to the already-shipped `container` table MUST NOT require a new `GRANT` or a new RLS policy (the existing table-level `GRANT ... ON "container"` covers new columns). The column format (color name vs hex value) remains open and MUST be settled during design; this requirement does not fix the format.

#### Scenario: Container stores a color value

- GIVEN the `container` table has the `color` column
- WHEN a `Container` "tubo lila EDTA" is created with `color` "lila"
- THEN the row persists `color` "lila"

#### Scenario: Color is NULL for non-tube containers

- GIVEN a `Container` representing a non-tube container (e.g. "Frasco")
- WHEN it is created without a `color`
- THEN `color` is NULL — a non-tube container is valid

#### Scenario: Color addition needs no new grant

- GIVEN the existing table-level `GRANT ... ON "container" TO quimia_app`
- WHEN `color` is added as a new column
- THEN `quimia_app` can read and write `color` with no additional `GRANT` and no new RLS policy

### Requirement: Study Lifecycle Uses Active Deactivate-Not-Delete

`Study` MUST default `isActive` to `true`. Deactivation MUST set `isActive = false` without deleting the row, and reactivation MUST set `isActive = true`. Hard delete of `Study` rows MUST NOT occur. This mirrors the `supporting-catalogs` lifecycle contract.

#### Scenario: isActive defaults true

- GIVEN a newly created `Study`
- WHEN the row is read back
- THEN `isActive` is `true`

#### Scenario: Deactivate flips the flag without deleting

- GIVEN an active `Study` row
- WHEN it is deactivated
- THEN `isActive` is `false` and the row still exists

#### Scenario: Reactivate restores the flag

- GIVEN an inactive `Study` row
- WHEN it is reactivated
- THEN `isActive` is `true`

### Requirement: RLS Is Enforced on Study and StudyContainer (AD-2/AD-3)

Both `study` and `study_container` MUST have `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy on `current_setting('app.tenant_id', true)`, applied by the owner/migration role via `DIRECT_DATABASE_URL` (never `quimia_app`). `quimia_app` MUST receive `GRANT SELECT, INSERT, UPDATE, DELETE` on both new tables. `Study` and `StudyContainer` are tenant-owned tables (bare `tenantId`, AD-2/AD-3): every runtime query MUST be scoped through `src/shared/db` (`scoped()`/`transaction()`), with no `prisma.<model>` call (AD-3). An unscoped query MUST be fail-closed (zero rows — `tenantId = NULL` is NULL, never all rows); cross-tenant reads MUST return zero rows; `FORCE ROW LEVEL SECURITY` MUST subject the owner role to the policy (owner-bypass forbidden).

#### Scenario: Migration enables FORCE RLS on both new tables

- GIVEN the migration applied via the owner role
- WHEN policies are listed for `study` and `study_container`
- THEN each table has RLS ENABLED + FORCE with a `tenant_isolation` policy

#### Scenario: Unscoped query is fail-closed

- GIVEN no `app.tenant_id` is set
- WHEN `quimia_app` selects from `study`
- THEN zero rows return — the policy matches no rows rather than all rows

#### Scenario: Cross-tenant access is impossible

- GIVEN tenant A's scoped session and tenant B `study` rows exist
- WHEN tenant A queried `study` or `study_container`
- THEN zero tenant-B rows appear

#### Scenario: Owner cannot bypass isolation

- GIVEN `FORCE ROW LEVEL SECURITY` is set on `study`
- WHEN the owner role queries without a tenant setting
- THEN it also sees zero rows — FORCE subjects the owner to RLS

#### Scenario: quimia_app has full CRUD within its tenant

- GIVEN a scoped `quimia_app` connection on a Neon branch
- WHEN SELECT/INSERT/UPDATE/DELETE run against `study` and `study_container`
- THEN each succeeds within the tenant's own rows

### Requirement: Integration Tests Verify Study RLS, Constraints, and M2M on a Real Neon Branch

Integration tests (`vitest.integration.config.ts`, `fileParallelism: false`) MUST run against a real ephemeral Neon branch and MUST prove: unscoped queries return zero rows; tenant A cannot read tenant B rows; `quimia_app` can SELECT/INSERT/UPDATE/DELETE; FORCE RLS blocks owner bypass; ids are cuid2 and unique per row; `(tenantId, code)` uniqueness is per tenant; FK resolution against all five catalogs; `equipmentId` NULL allowed; `processDays` default 1; `isActive` default true; `Decimal(10,2)` round-trips; M2M cardinality (a study linked to two distinct containers yields two `study_container` rows, one link per distinct container); and deactivate-not-delete. A mocked Prisma client MUST NOT be accepted as RLS evidence.

#### Scenario: FK resolution against all five catalogs

- GIVEN a `Study` referencing `SampleType`, `Method`, `Technique`, and `Equipment` rows
- WHEN the study is created and read back on a real Neon branch
- THEN every catalog attribute resolves through its FK

#### Scenario: M2M cardinality yields one link per distinct container

- GIVEN a `Study` linked to two distinct `Container` rows
- WHEN `study_container` is queried
- THEN exactly two rows exist, one per distinct container

#### Scenario: Per-tenant code uniqueness is proven

- GIVEN tenant A and tenant B on a real Neon branch
- WHEN both create a `Study` with `code` "QS6"
- THEN both succeed, and a second "QS6" within tenant A fails

#### Scenario: Mocked Prisma client is not accepted as RLS evidence

- GIVEN an RLS assertion backed only by a mocked Prisma client
- WHEN the evidence is reviewed
- THEN it is rejected — RLS MUST be proven against a real branch

### Requirement: No Seed Data

The migration SHOULD NOT insert seed rows; the lab configures its own catalogs and studies.

#### Scenario: Fresh branch starts empty

- GIVEN a new ephemeral Neon branch after the migration
- WHEN `study` and `study_container` are queried
- THEN both contain zero rows
