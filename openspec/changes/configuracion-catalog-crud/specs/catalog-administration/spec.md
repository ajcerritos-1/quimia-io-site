# catalog-administration Specification

## Purpose

Defines the admin-only "Configuración" experience for the five supporting catalogs (`Method`, `Technique`, `Equipment`, `Container`, `SampleType`). Covers the navigation entry, the hub page, per-catalog CRUD pages, the create/edit/update/deactivate/reactivate lifecycle, atomic audit logging for every mutation, client- and server-side validation, and the deactivate-not-delete contract. All catalog data flows are tenant-scoped (AD-2/AD-3). This spec describes observable behavior; the generic catalog engine and file layout are design concerns.

## Requirements

### Requirement: Configuración Navigation Entry Is Admin-Only

The system MUST render a "Configuración" navigation entry linking to `/configuracion`, and this entry MUST be visible only to users with the `admin` role. Users with any other authenticated role MUST NOT see the entry. An authenticated non-admin MUST NOT access `/configuracion` or any `/configuracion/*` sub-route by direct URL: the system MUST return a 404 response (not merely hide the link). An unauthenticated request to any of these routes MUST be redirected to sign-in.

#### Scenario: Admin sees the entry

- GIVEN an authenticated user with role `admin`
- WHEN the navigation is rendered
- THEN a "Configuración" entry linking to `/configuracion` is visible

#### Scenario: Non-admin does not see the entry

- GIVEN an authenticated user with role `quimico` or `recepcionista`
- WHEN the navigation is rendered
- THEN no "Configuración" entry is visible

#### Scenario: Non-admin direct navigation returns 404

- GIVEN an authenticated user with role `quimico`
- WHEN the user requests `/configuracion` directly
- THEN the system returns a 404 response

#### Scenario: Non-admin cannot reach a sub-route

- GIVEN an authenticated user with role `quimico`
- WHEN the user requests `/configuracion/metodos` directly
- THEN the system returns a 404 response

#### Scenario: Unauthenticated user is redirected

- GIVEN no authenticated session
- WHEN the user requests `/configuracion` or any `/configuracion/*` route
- THEN the system redirects to sign-in

### Requirement: Sidebar Highlights Configuración On Sub-Routes

The sidebar MUST mark the "Configuración" navigation item as active when the current path is `/configuracion` OR begins with `/configuracion/`. Navigation items that have no sub-routes MUST continue to highlight exactly as before.

#### Scenario: Highlight on the hub route

- GIVEN an admin on `/configuracion`
- WHEN the sidebar is rendered
- THEN "Configuración" is marked active

#### Scenario: Highlight on a sub-route

- GIVEN an admin on `/configuracion/metodos`
- WHEN the sidebar is rendered
- THEN "Configuración" is marked active

#### Scenario: Existing items unaffected

- GIVEN an admin on `/usuarios`
- WHEN the sidebar is rendered
- THEN "Usuarios y Roles" is marked active and "Configuración" is not

### Requirement: Hub Page Lists All Five Catalog Kinds With Active Counts

The `/configuracion` hub page MUST render exactly five cards, one per catalog kind, each showing its Spanish label and the count of active items. The labels MUST be "Métodos", "Técnicas", "Equipos", "Recipientes", and "Tipos de Muestra". Each card MUST link to the corresponding per-catalog CRUD page. When a catalog has zero active items, the card MUST show "0 elementos".

#### Scenario: Hub renders five labeled cards

- GIVEN an admin on `/configuracion`
- WHEN the page is rendered
- THEN five cards appear with labels "Métodos", "Técnicas", "Equipos", "Recipientes", "Tipos de Muestra"

#### Scenario: Card links to its catalog page

- GIVEN the hub page rendered
- WHEN the "Métodos" card is activated
- THEN navigation goes to `/configuracion/metodos`

#### Scenario: Active count is shown per catalog

- GIVEN the `Method` catalog has 3 active rows
- WHEN the hub page is rendered
- THEN the "Métodos" card shows the count 3

#### Scenario: Empty catalog shows zero

- GIVEN the `Equipment` catalog has no active rows
- WHEN the hub page is rendered
- THEN the "Equipos" card shows "0 elementos"

### Requirement: Canonical Catalog Slug Contract

The system MUST use kebab-case URL slugs as the canonical route keys for the `[catalog]` segment. The canonical slugs MUST be `metodos`, `tecnicas`, `equipos`, `recipientes`, and `tipos-de-muestra`. The SampleType catalog MUST be reachable only through the slug `tipos-de-muestra` (not `tiposDeMuestra` or any other spelling). Internal kind identifiers MAY differ in casing (for example camelCase) but MUST map to the canonical kebab-case slug; the `[catalog]` segment MUST match a canonical slug and nothing else. This contract MUST make the `[catalog]` segment resolve unambiguously for every catalog.

#### Scenario: Every canonical slug resolves

- GIVEN an admin
- WHEN the user requests `/configuracion/metodos`, `/configuracion/tecnicas`, `/configuracion/equipos`, `/configuracion/recipientes`, or `/configuracion/tipos-de-muestra`
- THEN the corresponding catalog page renders

#### Scenario: SampleType uses the kebab-case slug

- GIVEN an admin
- WHEN the user requests `/configuracion/tipos-de-muestra`
- THEN the SampleType ("Tipos de Muestra") catalog page renders

#### Scenario: Non-canonical slug resolves to 404

- GIVEN an admin
- WHEN the user requests `/configuracion/tiposDeMuestra`
- THEN the system returns 404

### Requirement: Per-Catalog Page Enforces Admin Gate And Resolves The Slug

The `/configuracion/[catalog]` page MUST be admin-gated: a non-admin authenticated user MUST receive 404 and an unauthenticated user MUST be redirected to sign-in. An unknown `[catalog]` value (one that does not match a canonical slug) MUST return 404. For a valid slug, the page MUST list that catalog's rows ordered by name ascending, and MUST expose create, edit, deactivate, and reactivate actions.

#### Scenario: Valid slug lists rows ordered by name

- GIVEN an admin on `/configuracion/metodos`
- WHEN the page is rendered
- THEN the catalog's rows are listed ordered by name ascending

#### Scenario: Unknown slug returns 404

- GIVEN an admin
- WHEN the user requests `/configuracion/inexistente`
- THEN the system returns 404

#### Scenario: Non-admin returns 404

- GIVEN an authenticated user with role `quimico`
- WHEN the user requests `/configuracion/metodos`
- THEN the system returns 404

#### Scenario: Unauthenticated redirected

- GIVEN no authenticated session
- WHEN the user requests `/configuracion/metodos`
- THEN the system redirects to sign-in

### Requirement: Create Writes Audit Entry Atomically

Creating a catalog entry MUST persist the new row and MUST write a `{ENTITY}_CREATED` audit log entry in the same transaction as the insert, where `{ENTITY}` is the catalog entity (`METHOD`, `TECHNIQUE`, `EQUIPMENT`, `CONTAINER`, or `SAMPLE_TYPE`). When the name already exists within the tenant, the system MUST return a user-visible error (a 409 via the unique-constraint violation), not a raw database error. The same name in a different tenant MUST be allowed.

#### Scenario: Create persists and audits

- GIVEN an admin creating `Method` "QUIMICA SANGUINEA"
- WHEN the create succeeds
- THEN the row is persisted AND a `METHOD_CREATED` audit entry is written in the same transaction

#### Scenario: Duplicate name within tenant is rejected

- GIVEN tenant A already has `Method` "QUIMICA SANGUINEA"
- WHEN an admin creates another `Method` "QUIMICA SANGUINEA" in tenant A
- THEN the system returns a user-visible 409 error and no row is created

#### Scenario: Same name across tenants is allowed

- GIVEN tenant A has `Method` "QUIMICA SANGUINEA"
- WHEN an admin in tenant B creates `Method` "QUIMICA SANGUINEA"
- THEN the row is created — uniqueness is per tenant

### Requirement: Update Writes Audit Entry With Before/After Snapshots

Updating a catalog entry MUST persist the changes and MUST write a `{ENTITY}_UPDATED` audit log entry in the same transaction, including `before` and `after` snapshots of the changed fields. A name collision with another row in the same tenant MUST return the same user-visible 409 error as create.

#### Scenario: Update persists and audits with snapshots

- GIVEN `Method` "ELISA" exists in tenant A
- WHEN an admin renames it to "ELISA 3GEN"
- THEN the row is updated AND a `METHOD_UPDATED` audit entry with `before`/`after` snapshots is written in the same transaction

#### Scenario: Update to a duplicate name is rejected

- GIVEN tenant A has `Method` "ELISA" and "PCR"
- WHEN an admin renames "PCR" to "ELISA"
- THEN the system returns a user-visible 409 error and the row is unchanged

### Requirement: Deactivate And Reactivate Lifecycle Without Hard Delete

Deactivating a catalog entry MUST set `isActive` to `false` and MUST NOT delete the row, writing a `{ENTITY}_DEACTIVATED` audit log entry atomically in the same transaction. Reactivating MUST set `isActive` to `true` and MUST write a `{ENTITY}_REACTIVATED` audit log entry atomically. The row MUST remain present in both states; hard delete MUST NOT occur. Attempting to deactivate an already-inactive row (or reactivate an already-active row) MUST be a no-op.

#### Scenario: Deactivate sets inactive and audits

- GIVEN `Method` "ELISA" is active
- WHEN an admin deactivates it
- THEN `isActive` becomes `false`, the row is NOT deleted, and a `METHOD_DEACTIVATED` audit entry is written in the same transaction

#### Scenario: Reactivate sets active and audits

- GIVEN `Method` "ELISA" is inactive
- WHEN an admin reactivates it
- THEN `isActive` becomes `true` and a `METHOD_REACTIVATED` audit entry is written in the same transaction

#### Scenario: Deactivating an inactive row is a no-op

- GIVEN `Method` "ELISA" is already inactive
- WHEN an admin deactivates it again
- THEN no change occurs and no audit entry is written

### Requirement: Equipment Form Field Contract

The Equipment catalog form MUST require `name`, `model`, and `serialNumber`, and MUST render `calibrationDate` as an optional date picker. The four other catalogs MUST require `name` only and MUST NOT expose `model`, `serialNumber`, or `calibrationDate`.

#### Scenario: Equipment requires the full field set

- GIVEN an admin on `/configuracion/equipos`
- WHEN the create form is rendered
- THEN `name`, `model`, and `serialNumber` are required and `calibrationDate` is an optional date picker

#### Scenario: Uniform catalogs expose name only

- GIVEN an admin on `/configuracion/metodos`
- WHEN the create form is rendered
- THEN only the `name` field is exposed

### Requirement: Client And Server Validation

The system MUST validate catalog form input on the client before submission and on the server as the authoritative source of truth. Server-side validation MUST reject invalid input and return field-level errors to the client, which MUST display them to the user.

#### Scenario: Client blocks invalid input

- GIVEN an admin submits the create form with a required field empty
- WHEN the form is submitted
- THEN the client-side validation blocks submission and shows the field error

#### Scenario: Server rejects invalid input authoritatively

- GIVEN input that bypasses or passes client validation but is invalid
- WHEN the server action runs
- THEN the server-side validation rejects it and returns field errors

#### Scenario: Field errors are displayed

- GIVEN a failed submit with field errors
- WHEN the response reaches the client
- THEN the field-level errors are displayed to the user

### Requirement: Catalog Data Flows Through Tenant-Scoped Access (AD-2/AD-3)

Every catalog read and write MUST go through the tenant-scoped database wrapper (`src/shared/db`, AD-3) so that `app.tenant_id` is set and row-level security (AD-2) applies. A request scoped to tenant A MUST NOT read or write tenant B's catalog rows. No unscoped or owner-bypass access path MAY exist for catalog operations.

#### Scenario: Scoped read returns only own rows

- GIVEN tenant A has `Method` "X" and tenant B has `Method` "Y"
- WHEN tenant A's admin lists `Method`
- THEN only "X" appears — "Y" is never returned

#### Scenario: Cross-tenant write is impossible

- GIVEN a request scoped to tenant A
- WHEN it attempts to modify a tenant B catalog row
- THEN the write has no effect on tenant B's data

#### Scenario: Unscoped access returns zero rows

- GIVEN no `app.tenant_id` is set
- WHEN a catalog table is queried
- THEN zero rows return (fail-closed)

### Requirement: Empty And Status States

When a catalog has zero rows, the table MUST render an empty state reading "No hay {label} todavía" where `{label}` is the catalog's Spanish label. Each row MUST display an "Activo" badge when `isActive` is `true` and an "Inactivo" badge when `isActive` is `false`.

#### Scenario: Empty catalog shows empty state

- GIVEN the `Container` catalog has zero rows
- WHEN an admin opens `/configuracion/recipientes`
- THEN the table shows "No hay Recipientes todavía"

#### Scenario: Active row shows Activo badge

- GIVEN `Method` "ELISA" with `isActive` `true`
- WHEN the catalog table is rendered
- THEN the row shows an "Activo" badge

#### Scenario: Inactive row shows Inactivo badge

- GIVEN `Method` "ELISA" with `isActive` `false`
- WHEN the catalog table is rendered
- THEN the row shows an "Inactivo" badge
