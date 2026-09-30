# Proposal: Configuración — Catalog CRUD (Story 2.1, Change 2/6)

## Intent

The five supporting catalog models (Method, Technique, Equipment, Container, SampleType) exist in the schema with RLS but have zero UI, zero CRUD actions, and zero navigation. Lab admins cannot populate their catalogs — every catalog table is empty. This change ships the complete "Configuración" experience: a nav entry, a hub page listing all catalog kinds, and full CRUD (create, edit, deactivate, reactivate) for every catalog entity, with every mutation writing an audit log entry atomically in the same transaction.

## Scope

### In Scope

- Sidebar `NAV_ITEMS` entry: "Configuración" → `/configuracion`, admin-only
- Hub page `/configuracion`: card grid linking to each catalog kind (Métodos, Técnicas, Equipos, Recipientes, Tipos de Muestra)
- Per-catalog CRUD page `/configuracion/[catalog]`: table with row-level edit, deactivate, reactivate actions; create/edit via modal dialogs
- Generic catalog engine: a config-driven `CATALOGS` registry maps kind → Prisma model, label, href, form fields; one set of UI components and server actions powers all 5 catalogs (Equipment is a superset with `model`/`serialNumber`/`calibrationDate?` extra fields — handled via conditional form fields in the same engine)
- Server actions (two-file split: `xxx.action.ts` + `submit-xxx.action.ts`): create, update, deactivate, reactivate — each wraps mutations in `transaction()` + `writeAuditLog()`
- Audit actions: `METHOD_CREATED`, `METHOD_UPDATED`, `METHOD_DEACTIVATED`, `METHOD_REACTIVATED` (and per-entity variants for Technique, Equipment, Container, SampleType)
- Sidebar active-state: switch from exact-match (`pathname === item.href`) to prefix-match (`pathname.startsWith(item.href)`) so `/configuracion/metodos` highlights the "Configuración" nav item
- Unit tests for all server actions, integration tests verifying audit writes, and E2E tests for the full flow

### Out of Scope

- Study CRUD (Story 2.2, next change)
- Analyte CRUD (Story 2.3)
- Batch, results, or any Epic 3–11 functionality
- Seed data — empty catalogs are acceptable
- Hard delete — deactivate/reactivate only (isActive flag)
- Role-based access beyond admin-only — all catalog management is admin-only per locked decision 1
- Icon-collapsed tablet sidebar variant (EXPERIENCE.md three-tier, explicitly deferred)
- Pagination, search, or sorting beyond name-based ordering — catalogs are small lookup tables

## Locked Decisions (context from predecessor change; do not re-open)

1. Single hub route `/configuracion`; sidebar nav label "Configuración" (NOT "Catálogos"); admin-only (role "admin"). From catalog-schema-supporting proposal, locked decision #1.
2. UI via modals + reusable primitives — follow `src/modules/auth/ui/` (create-user-dialog, create-user-form, users-table). From exploration findings.
3. Deactivate/reactivate via `isActive` flag — never hard delete (Story 2.2 references catalogs via FK). From catalog-schema-supporting proposal, locked decision #2.
4. Equipment carries `model`, `serialNumber`, `calibrationDate?`; the other four carry `name` only. From catalog-schema-supporting proposal, locked decision #4.
5. No seed data — empty state is acceptable. From catalog-schema-supporting proposal, locked decision #5.
6. Audit actions per entity: `<ENTITY>_CREATED/UPDATED/DEACTIVATED/REACTIVATED` via `writeAuditLog` inside `transaction()`. The audit write-path lands in THIS change. From catalog-schema-supporting proposal, locked decision #6 and audit requirement (lines 95-103).
7. New vertical slice `src/modules/catalog/` (mirroring `src/modules/auth/`), NOT spread across shared. From exploration findings, locked decision #7.

## Design Decisions (settled in this proposal)

8. **Generic engine, not 5 hand-written slices.** Four catalogs share the identical shape (`name` only). Equipment adds three extra fields. A single `CATALOGS` registry const drives one set of create-form, edit-form, table, and server action modules — the form conditionally renders Equipment's extra fields when `kind === "equipos"`. This avoids 4× code duplication and keeps the maintenance surface small. The registry is the single source of truth for label, href, Prisma model name, and field definitions.

9. **Edit via modal dialog, reusing the create form.** The create form component accepts an optional `initialValues` prop — when present, it becomes an edit form (pre-fills fields, calls `updateCatalog` instead of `createCatalog`). The edit modal lives on the per-catalog CRUD page inside a row-level "Editar" ghost button. This mirrors `create-user-dialog.tsx`'s pattern extended with edit support.

10. **Hub route `/configuracion` + dynamic `[catalog]` segment.** The hub renders a card grid (one card per registry entry showing Spanish label + item count). Each card links to `/configuracion/[catalog]` where `[catalog]` is the registry key (`metodos`, `tecnicas`, `equipos`, `recipientes`, `tipos-de-muestra`). The CRUD page reads `params.catalog`, looks up the registry entry, and renders the per-kind table + create/edit dialogs.

11. **Sidebar active-state switches to `startsWith`.** Currently `pathname === item.href` — only highlights "Configuración" when exactly on `/configuracion`. Switching to `pathname.startsWith(item.href)` keeps "Configuración" highlighted when on any sub-route like `/configuracion/metodos`. "Usuarios y Roles" already has no sub-routes, so the behavior change is harmless there. If future sub-routes appear under `/usuarios`, this same logic correctly highlights the parent.

## Capabilities

> This section is the CONTRACT between proposal and specs phases. The `supporting-catalogs` capability was created by change 1/6 (catalog-schema-supporting) but has NOT been archived to `openspec/specs/` yet — its spec lives at `openspec/changes/catalog-schema-supporting/specs/supporting-catalogs/spec.md`. This change builds the UI/CRUD layer ON TOP of that schema contract.

### New Capabilities

- `catalog-administration`: Admin-only CRUD UI for the five supporting catalogs, including a hub page, per-kind CRUD pages with modal-based create/edit, deactivate/reactivate lifecycle, audit-logged mutations via `writeAuditLog`, and a generic `CATALOGS` registry const driving form, table, and server action behavior. Covers nav entry, route structure, client-side form validation, server-side Zod validation, and the deactivate-not-delete contract.

### Modified Capabilities

- `supporting-catalogs`: The schema-only requirement from change 1/6 that mandates the five models exists. This change adds a new requirement: the system MUST implement full CRUD operations on those models with audit logging. The existing schema requirements (model fields, RLS, uniqueness, no-seed-data) are unchanged — only the operational scope expands to include UI and server actions.

## Approach

### Architecture: Vertical slice under `src/modules/catalog/`

```
src/modules/catalog/
├── registry.ts                  # CATALOGS const (client-safe, no Prisma import)
├── server/
│   ├── create-catalog.action.ts
│   ├── submit-create-catalog.action.ts
│   ├── update-catalog.action.ts
│   ├── submit-update-catalog.action.ts
│   ├── deactivate-catalog.action.ts
│   ├── submit-deactivate-catalog.action.ts
│   ├── reactivate-catalog.action.ts
│   └── submit-reactivate-catalog.action.ts
└── ui/
    ├── catalog-form.tsx          # Generic form (create + edit), conditional Equipment fields
    ├── catalog-create-dialog.tsx # Trigger button + ModalDialog + CatalogForm
    ├── catalog-edit-dialog.tsx   # Row-level trigger + ModalDialog + CatalogForm (pre-filled)
    └── catalog-table.tsx         # Card + count + table + StatusBadge + per-row actions + empty state
```

### Route structure

```
src/app/(app)/configuracion/
├── page.tsx                      # Hub: card grid from CATALOGS registry
└── [catalog]/
    └── page.tsx                  # Per-kind CRUD: resolves registry, loads rows, renders table + dialogs
```

### Generic engine: `CATALOGS` registry

```typescript
// registry.ts — client-safe, no Prisma imports
export const CATALOGS = {
  metodos:       { kind: "metodos",       href: "/configuracion/metodos",         label: "Métodos",          prismaModel: "method",       fields: { name:     { label: "Nombre", type: "text", required: true } } },
  tecnicas:      { kind: "tecnicas",      href: "/configuracion/tecnicas",        label: "Técnicas",         prismaModel: "technique",    fields: { name:     { label: "Nombre", type: "text", required: true } } },
  equipos:       { kind: "equipos",       href: "/configuracion/equipos",         label: "Equipos",          prismaModel: "equipment",    fields: { name:     { label: "Nombre", type: "text", required: true }, model: { label: "Modelo", type: "text", required: true }, serialNumber: { label: "N.º de Serie", type: "text", required: true }, calibrationDate: { label: "Fecha de Calibración", type: "date", required: false } } },
  recipientes:   { kind: "recipientes",   href: "/configuracion/recipientes",     label: "Recipientes",      prismaModel: "container",    fields: { name:     { label: "Nombre", type: "text", required: true } } },
  tiposDeMuestra:{ kind: "tiposDeMuestra",href: "/configuracion/tipos-de-muestra", label: "Tipos de Muestra", prismaModel: "sampleType",   fields: { name:     { label: "Nombre", type: "text", required: true } } },
} as const satisfies Record<string, CatalogKind>;

export type CatalogKindKey = keyof typeof CATALOGS;
export type CatalogKind = typeof CATALOGS[CatalogKindKey];
```

### Server actions (two-file split, following `create-user.action.ts` / `submit-create-user.action.ts` pattern)

Each plain action (`create-catalog.action.ts`, etc.):
1. Zod `safeParse` → `AppError("VALIDATION_ERROR", ..., {status:400, details: z.flattenError()})`
2. `requireAdmin(request, async (actor) => { transaction({...}, async (tx) => { ... writeAuditLog(tx, ...) }) })`
3. For create/update: catch `isUniqueConstraintViolation` → translated 409 `AppError`
4. For update/deactivate/reactivate: fetch existing row, guard no-op (already inactive when deactivating → skip)

Each submit wrapper (`submit-xxx.action.ts`):
1. File-level `"use server"` — separate file to avoid Turbopack pulling Prisma/pg into client bundle
2. Resolves `headers()` → tenantId/requestId
3. Maps `FormData` → input, catches `AppError` → `{ ok, message, fieldErrors }`
4. `revalidatePath("/configuracion")`

### UI components

- **`catalog-form.tsx`**: Generic form driven by `CatalogKind`. Renders `Field` + `Input` per field definition; `type="date"` for `calibrationDate`. Accepts optional `initialValues` for edit mode. Client-side Zod validation before calling the server action.
- **`catalog-create-dialog.tsx`**: `Button` trigger → `ModalDialog` → `CatalogForm`; auto-close on success. Following `create-user-dialog.tsx` pattern.
- **`catalog-edit-dialog.tsx`**: Row-level ghost "Editar" button → `ModalDialog` → `CatalogForm` with `initialValues`.
- **`catalog-table.tsx`**: `Card` + count header + thead band + row hover + `StatusBadge` + "Editar" ghost button + "Desactivar"/"Reactivar" ghost button + empty state. Following `users-table.tsx` pattern exactly.

### Nav/sidebar changes

- `nav-items.ts`: Add `{ label: "Configuración", href: "/configuracion", allowedRoles: ["admin"] }` to `NAV_ITEMS`.
- `nav-items.test.ts`: Update `toHaveLength(1)` → `toHaveLength(2)`. Add test: "includes 'Configuración' for admin" and "hides 'Configuración' for quimico/recepcionista".
- `sidebar.tsx`: Change `const isActive = pathname === item.href` → `const isActive = pathname.startsWith(item.href)`.

### Hub page

A server component rendering a `<PageHeader>` ("Configuración") + card grid. Each card shows the catalog label, a count of active items, and links to `[catalog]`. Empty state: each card shows "0 elementos".

### Per-catalog CRUD page

Server component: reads `params.catalog`, looks up `CATALOGS[params.catalog]` → 404 if invalid. `requireAdmin()` gate. Queries `scoped()` for the matching Prisma model (`findMany`, ordered by `name asc`). Renders `PageHeader` (title = catalog label) + `CatalogTable` + `CatalogCreateDialog`. Table receives rows + viewer actor id (for potential future self-action guards).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/shell/nav-items.ts` | Modified | Add "Configuración" entry to `NAV_ITEMS` |
| `src/components/shell/nav-items.test.ts` | Modified | Update length assertion; add admin visibility + non-admin hiding tests |
| `src/components/shell/sidebar.tsx` | Modified | Switch active-state from `===` to `startsWith` |
| `src/modules/catalog/registry.ts` | New | `CATALOGS` const — single source of truth for kind → model/label/fields |
| `src/modules/catalog/server/` | New | 8 server action files (4 plain + 4 submit wrappers) |
| `src/modules/catalog/ui/` | New | 4 UI components: form, create-dialog, edit-dialog, table |
| `src/app/(app)/configuracion/page.tsx` | New | Hub page — card grid from registry |
| `src/app/(app)/configuracion/[catalog]/page.tsx` | New | Per-kind CRUD page — resolves registry, loads rows, renders table + dialogs |
| `src/shared/db/audit.ts` | None | Reused as-is — no changes to `writeAuditLog` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Generic engine over-generalizes — Equipment's extra fields create conditional complexity that leaks into every shared component | Med | Equipment is the only superset; the registry's `fields` definition drives the form dynamically. `catalog-form.tsx` iterates `Object.entries(kind.fields)` — no per-kind branching. If a second superset appears later (e.g., Container gains `capacity`), the registry absorbs it without component changes. |
| `startsWith` sidebar change causes "Usuarios y Roles" to highlight for a future `/usuarios/perfil` route (false positive) | Low | No `/usuarios` sub-route exists today or in any planned story. If one materializes, the prefix-match behavior is still correct UX (sub-route IS under the parent nav section). |
| Dynamic Prisma model access (`scoped()[kind.prismaModel]`) is type-unsafe — `findMany`/`create`/`update` signatures differ per model | Med | The plain action files switch on `kind` to call the correct model method with typed args. The registry's `prismaModel` string is used ONLY in the action's switch statement, not as a dynamic key. Each action imports all 5 models and branches explicitly — type-safe, just not dynamic. |
| `revalidatePath("/configuracion")` in submit wrappers revalidates the hub but the per-kind page at `/configuracion/[catalog]` needs separate revalidation | Med | Each submit wrapper calls `revalidatePath("/configuracion")` (layout segment revalidation cascades to children in Next.js App Router). Verified: Next.js `revalidatePath` on a layout segment revalidates all nested pages. |
| Audit log writes inside transaction add latency — 2 extra DB round-trips per mutation (audit row insert + write) | Low | `writeAuditLog` is a single `tx.auditLog.create()` call inside the existing transaction — no extra round-trip. Catalog mutations are low-frequency admin operations; latency is not a concern. |

## Rollback Plan

1. **Revert the commit** (`git revert`) — this is a pure addition with no schema migration. No database changes to unwind.
2. **If audit log rows need cleanup**: delete audit entries with `entity` in `{Method, Technique, Equipment, Container, SampleType}` and `action` matching the 20 audit action constants (5 entities × 4 actions). These rows are append-only and harmless if left — cleanup is optional.
3. **Sidebar regression test**: verify `nav-items.test.ts` still passes and "Usuarios y Roles" still highlights correctly at `/usuarios` (the `startsWith` change could theoretically break it, but since `/usuarios` has no sub-routes, `startsWith("/usuarios")` is equivalent to `=== "/usuarios"` for all existing URLs).

## Dependencies

- Predecessor change `catalog-schema-supporting` (1/6) MUST be complete and committed — all 5 Prisma models + RLS + migration applied. **Status: DONE** (commit 032e432 on `dev`).
- `requireAdmin` from `src/modules/auth/server/require-admin.ts` — already exists and is tested.
- `writeAuditLog` from `src/shared/db/audit.ts` — already exists and is tested.
- `ModalDialog`, `Card*`, `PageHeader`, `Select`, `StatusBadge`, `Field*`, `Button`, `Input` — all exist in `src/components/ui/`.

## Success Criteria

- [ ] `NAV_ITEMS` includes "Configuración" → `/configuracion`, visible only to admin role
- [ ] Sidebar highlights "Configuración" when visiting `/configuracion` or any `/configuracion/[catalog]` sub-route
- [ ] `/configuracion` renders a card grid with 5 cards (one per catalog kind), each showing the Spanish label
- [ ] `/configuracion/[catalog]` is gated by `requireAdmin()` — non-admin gets 404, unauthenticated redirects to sign-in
- [ ] Invalid `[catalog]` values (e.g., `/configuracion/inexistente`) return 404
- [ ] Create dialog: opens via "Crear {label}" button, validates client-side, submits via server action, auto-closes on success, shows field errors on failure
- [ ] Edit dialog: opens via row-level "Editar" ghost button, pre-fills existing values, updates on submit, auto-closes on success
- [ ] Deactivate: row-level "Desactivar" ghost button sets `isActive = false`, writes `{ENTITY}_DEACTIVATED` audit entry, row shows "Inactivo" badge
- [ ] Reactivate: row-level "Reactivar" ghost button sets `isActive = true`, writes `{ENTITY}_REACTIVATED` audit entry, row shows "Activo" badge
- [ ] Create writes `{ENTITY}_CREATED` audit entry in the same transaction
- [ ] Update writes `{ENTITY}_UPDATED` audit entry with `before`/`after` snapshots in the same transaction
- [ ] Duplicate name within tenant returns a user-visible error (409 via `isUniqueConstraintViolation`)
- [ ] Equipment form includes `model`, `serialNumber` (required) and `calibrationDate` (optional, date picker)
- [ ] All 4 uniform catalogs share the same form/table/action code — Equipment conditionally adds fields
- [ ] Empty state: table shows "No hay {label} todavía" when catalog has zero rows
- [ ] `vitest run` passes for all unit + integration tests
- [ ] `next build` succeeds (no Turbopack errors from Prisma/pg leaking into client bundle)
