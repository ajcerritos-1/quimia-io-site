# Delta for supporting-catalogs

## MODIFIED Requirements

### Requirement: Five Catalog Models Follow the Locked Field Contract

The system MUST define models `Method`, `Technique`, `Equipment`, `Container`, `SampleType`, each with `id String @id @default(cuid(2))`, bare `tenantId String` (no FK relation to `Tenant` — AuditLog precedent), `name String`, `isActive Boolean @default(true)`, `createdAt`/`updatedAt`, `@@map` snake_case, `@@index([tenantId])`, `@@unique([tenantId, name])`. `Equipment` MUST additionally carry required `model`/`serialNumber` (descriptive, not unique) and nullable `calibrationDate DateTime?` (FR-9). `Container` MUST additionally carry nullable `color String?` (AD-21) — the tube color (e.g., "amarillo"/"lila"/"rojo") that drives Epic 6 container-label printing; it is nullable because non-tube containers (e.g., "Frasco", "Laminilla") have no tube colour. Each of the five models MUST expose the Study back-relation required by the relation's other side (e.g. `studies Study[]`, or `studyContainers StudyContainer[]` on `Container`); these back-relations are relation-only and MUST NOT add a persisted column. Each of the five models MUST also expose `@@unique([id, tenantId])` so it can serve as a composite tenant-scoped foreign-key target for the `study-catalog` capability (ADR-3); this key is index-only and MUST NOT add a persisted column. With `Container.color`, the relation-only Study back-references, and the index-only `@@unique([id, tenantId])` keys, the persisted field contract is closed: no further persisted field beyond this contract MAY be added.
(Reason: AD-21 ratifies `Container` as a real admin-managed catalog entity that carries a tube color, so the previously-closed field contract is lifted for `Container` by the nullable `color` column; separately, ADR-3 in `study-schema` requires each of the five models to expose `@@unique([id, tenantId])` as a composite tenant-scoped foreign-key target, which is index-only and adds no persisted column, so the field contract stays closed; the Study back-relations are relation-only and add no column.)
(Previously: the contract was fully closed — `Container` carried only `name`, and no fields beyond the contract could be added.)

#### Scenario: All five tables match the locked schema

- GIVEN migration `catalog_supporting_models` plus the Study-schema migration are applied
- WHEN the schema is inspected
- THEN `method`, `technique`, `equipment`, `container`, `sample_type` exist with the exact fields above
- AND `container` carries the nullable `color` column

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

#### Scenario: Container stores a nullable color

- GIVEN the `container` table after this change is applied
- WHEN a `Container` "tubo lila EDTA" is created with `color` "lila"
- THEN the row persists `color` "lila" — the field contract now admits it (AD-21)

#### Scenario: Color is NULL for non-tube containers

- GIVEN a `Container` representing a non-tube container (e.g. "Frasco")
- WHEN it is created without a `color`
- THEN `color` is NULL — the column is nullable and no tube colour is required

#### Scenario: Study back-relations add no column

- GIVEN the five catalog models after this change is applied
- WHEN their persisted columns are inspected
- THEN each exposes a relation-only Study back-reference (e.g. `studies Study[]`, or `studyContainers StudyContainer[]` on `Container`)
- AND each exposes `@@unique([id, tenantId])` as the composite tenant-scoped foreign-key target (index-only; adds no persisted column)
- AND no new persisted column exists beyond the contract above
