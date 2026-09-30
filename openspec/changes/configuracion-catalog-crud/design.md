# Design: Configuración — Catalog CRUD (Story 2.1, Change 2/6)

## Technical Approach

Ship the "Configuración" admin experience as a new vertical slice `src/modules/catalog/` (mirroring `src/modules/auth/`, AD-1), powered by a single client-safe `CATALOGS` registry that drives one generic form, one generic table, and one set of four server actions across all five catalog models (`Method`, `Technique`, `Equipment`, `Container`, `SampleType`). Every mutation wraps its row write and its `writeAuditLog` entry in the same `transaction()` call (AD-4/AD-10), through the tenant-scoped wrapper (AD-2/AD-3). Equipment is the only superset (`model`, `serialNumber`, `calibrationDate?`); the registry's `fields` map drives the form and table dynamically so no per-kind UI branching leaks into the shared components.

This maps directly to the proposal's locked decision #8 (generic engine) and the `catalog-administration` + `supporting-catalogs` delta specs. The design resolves the proposal's flagged risk #3 (type-unsafe dynamic Prisma access) by requiring an explicit `switch (kind)` in every server mutation/read that calls the correct typed delegate (`tx.method`, `tx.equipment`, `tx.sampleType`, …) per branch — never `scoped()[kind.prismaModel]`. It also corrects the proposal's risk #4 assumption: Next.js `revalidatePath` on a literal path invalidates a single page, so each submit wrapper calls it twice (hub + specific per-kind page), not once relying on a "layout cascade" that the current App Router docs do not guarantee for sibling pages.

## Architecture Decisions

### Decision: Registry key IS the canonical kebab-case slug (no separate slug→key map)

**Choice**: `CATALOGS` is typed `Record<CatalogSlug, CatalogKindDef>` where `CatalogSlug = "metodos" | "tecnicas" | "equipos" | "recipientes" | "tipos-de-muestra"`. The `[catalog]` segment is looked up directly as `CATALOGS[params.catalog]`. The `SampleType` catalog is keyed `"tipos-de-muestra"` only.

**Alternatives considered**: (a) Keep the proposal's `tiposDeMuestra` camelCase key plus a separate `slug → key` mapping; (b) a numeric/internal enum key with a slug map.

**Rationale**: The spec (`Canonical Catalog Slug Contract`) makes kebab-case slugs canonical and requires `tipos-de-muestra` to be the *only* reachable spelling. Making the registry key *equal* the slug eliminates the `tiposDeMuestra` vs `tipos-de-muestra` inconsistency definitively and removes an entire mapping table that could drift. `Object.keys(CATALOGS)` then *is* the canonical slug list, and `catalogHref(slug)` is trivially `` `/configuracion/${slug}` ``. Non-canonical slugs (`tiposDeMuestra`, `inexistente`) fail the `CATALOGS[params.catalog]` lookup and return 404 (AD-6 binding: `Container` is a catalog lookup, not order identity — unchanged). The proposal's `prismaModel: "method"` string is subsumed by `entity` (see next decision) to avoid two strings that must stay in sync.

### Decision: Type-safe model access via explicit `switch (kind)` — registry `entity` string is documentation/audit, never a delegate key

**Choice**: A server-only read helper (`catalog-queries.ts`) and the four plain actions each `switch` on the validated `kind` literal and call the concrete typed delegate per branch (`tx.method`, `tx.technique`, `tx.equipment`, `tx.container`, `tx.sampleType`). The registry carries `entity` (the Prisma model name, e.g. `"SampleType"`) and `actionPrefix` (the uppercase snake audit prefix, e.g. `"SAMPLE_TYPE"`) as plain strings used only for `writeAuditLog` and as documentation in the switch comments. No `scoped()[string]` dynamic access exists anywhere.

**Alternatives considered**: (a) Dynamic delegate access `scoped()[kind.prismaModel]` (proposal risk #3) — rejected, type-unsafe: `findMany`/`create`/`update` signatures differ per model and TS cannot unify the union; (b) five hand-written slices — rejected, 4× duplication.

**Rationale**: `Prisma` exposes the five delegates at `method`, `technique`, `equipment`, `container`, `sampleType` (camelCase) — `SampleType` is the model name but its delegate is `sampleType` and its table `sample_type`. A `switch` on the string-literal union narrows each branch to one concrete delegate, so Prisma's per-model `create`/`update` argument types are checked exactly (Equipment's extra fields are validated where they are written). This is the proposal's own risk-#3 mitigation made explicit. `entity`/`actionPrefix` are the single source for audit metadata (AD-10), matching the spec's `{ENTITY} ∈ {METHOD, TECHNIQUE, EQUIPMENT, CONTAINER, SAMPLE_TYPE}`.

### Decision: Shared client-safe Zod schemas — one discriminated union per operation

**Choice**: `src/modules/catalog/schemas.ts` (no `server-only`, no Prisma) exports `catalogCreateSchema` and `catalogUpdateSchema` as `z.discriminatedUnion("kind", [...])` with a `z.literal(slug)` per kind. Equipment's branch adds `model` (required), `serialNumber` (required), `calibrationDate` (optional, empty→null). The client form and the plain actions both import these — the server's `safeParse` remains authoritative.

**Alternatives considered**: (a) One generic `{ name }` schema with Equipment fields validated ad-hoc — rejected, no type safety for Equipment; (b) per-kind schema files — rejected, five near-identical files.

**Rationale**: Mirrors the codebase's established shared-schema precedent (`password-policy.ts` imported by both `create-user-form.tsx` and `create-user.action.ts`, AD-8 "no divergent check"). The discriminated union gives the `switch` a narrowed, typed payload. `calibrationDate` normalizes `""` → `null` via a preprocess at both the FormData boundary (client + submit wrapper), so the HTML `<input type="date">` `"yyyy-MM-dd"` string coerces to a `Date` for Prisma and `null` for "uncalibrated equipment" (FR-9).

### Decision: Two-file action split — 4 plain + 4 submit wrappers (proposal layout, extended)

**Choice**: `create`/`update`/`deactivate`/`reactivate` each get a plain, directly-testable `*.action.ts` (`server-only`) plus a file-level `"use server"` `submit-*.action.ts` wrapper. Added beyond the proposal's 8-file skeleton: `require-catalog-admin.ts` (thin guard) and `catalog-queries.ts` (typed reads).

**Alternatives considered**: (a) A single consolidated generic action with a `mode` field — rejected: loses the discriminated per-kind typing and diverges from the codebase's established action naming/test conventions; (b) inline `"use server"` directives co-located with the plain functions — rejected, the codebase already documents why that leaks Prisma/`pg` into the client bundle under Turbopack (see `submit-create-user.action.ts` header).

**Rationale**: Identical shape to `create-user.action.ts` / `submit-create-user.action.ts`, so the existing integration-test pattern (import the plain action, call it with a `CurrentActorRequest`) applies unchanged. The two additions are forced by the audit-semantics and type-safety decisions: `require-catalog-admin.ts` because `require-admin.ts` hardcodes `entity: "User"` / `USER_ADMIN_ACTION_DENIED` (wrong for catalog attempts); `catalog-queries.ts` because the hub and per-kind pages both need typed `list`/`count` reads that must switch on `kind`.

### Decision: Catalog-scoped admin guard instead of reusing `requireAdmin`

**Choice**: `src/modules/catalog/server/require-catalog-admin.ts` is a thin wrapper over `requireRole(request, [UserRole.admin], fn, { entity: <kind entity>, action: "CATALOG_ADMIN_ACTION_DENIED", attemptedAction: "CATALOG_CREATE" | "CATALOG_UPDATE" | "CATALOG_DEACTIVATE" | "CATALOG_REACTIVATE", entityId?: <target row id> })`.

**Alternatives considered**: (a) Reuse `requireAdmin` as-is — rejected: it hardcodes `entity: "User"` and `action: "USER_ADMIN_ACTION_DENIED"`, writing a misleading denial row for catalog mutations; (b) inline `requireRole` calls in every action — works but duplicates the `CATALOG_ADMIN_ACTION_DENIED` action name four times.

**Rationale**: `require-admin.ts` is itself documented as "a thin wrapper over `requireRole()`". A catalog slice owning its own thin guard is the same pattern, keeps the single role-check path (`roles.ts`'s `isRoleAllowed`, AD-1), and writes accurate denial audit metadata (AD-10). For deactivate/reactivate/update, `entityId` is the target row id (already known from validated input), matching `require-admin.ts`'s own `targetUserId` precedent.

### Decision: `revalidatePath` — two explicit calls (hub + specific per-kind page), not a layout "cascade"

**Choice**: Each submit wrapper calls `revalidatePath("/configuracion")` (hub) AND `revalidatePath(catalogHref(kind))` (the specific `/configuracion/{slug}` page it mutated).

**Alternatives considered**: (a) The proposal's single `revalidatePath("/configuracion")` "layout segment cascade" — rejected; (b) `revalidatePath("/configuracion/[catalog]", "page")` (dynamic pattern) — valid but coarser than needed.

**Rationale**: Verified against current Next.js `revalidatePath` docs: a *literal* path invalidates a single page; revalidating all pages under a *dynamic* segment requires the route pattern + `type`. The hub (`/configuracion/page.tsx`) and per-kind page (`/configuracion/[catalog]/page.tsx`) are sibling routes sharing only the `(app)` layout, so `/configuracion` revalidation does not inherently refresh `/configuracion/metodos`. Two explicit calls are precise, dependency-free, and keep the hub's active counts and the target table in sync. (`revalidatePath` must be called after the action succeeds, matching `submit-create-user.action.ts`.)

### Decision: `CatalogForm` reuses the create form for edit via `initialValues`

**Choice**: `CatalogForm` accepts optional `initialValues?: SerializedCatalogRow`. When absent → create mode (calls `submitCreateCatalog`); when present → edit mode (pre-fills fields, renders a hidden `id`, calls `submitUpdateCatalog`). Field rendering iterates `CATALOGS[kind].fields` (no per-kind branching); `type: "date"` renders `<Input type="date">`.

**Alternatives considered**: (a) Two separate form components — rejected, duplicates field rendering; (b) separate `editCatalog` prop flag plus `initialValues` — redundant with `initialValues` presence.

**Rationale**: Direct extension of `create-user-form.tsx`'s `useActionState` + `Field`/`FieldError` pattern, per locked decision #2/#9. Uncontrolled `defaultValue` pre-fill keeps the form's fresh-remount-on-open behavior (the dialog remounts `initialState` each open, same as `create-user-dialog.tsx`).

## Data Flow

```
CREATE FLOW (edit/deactivate variants annotated)
  CatalogCreateDialog (client) ──"Crear {label}"──▶ ModalDialog + CatalogForm
  CatalogForm.useActionState(catalogFormAction, initialState)
    │  1. assemble { kind, name, [equipment: model, serialNumber, calibrationDate] }
    │  2. catalogCreateSchema.safeParse → fieldErrors on failure (client block)
    │  3. submitCreateCatalog(formData)  [kind + id carried by hidden inputs]
    ▼
  submit-create-catalog.action.ts  ("use server", file-level)
    │  headers() → tenantId (guard UNRESOLVED_TENANT) → requestId
    │  map FormData → CreateCatalogInput (calibrationDate ""→null)
    │  catch AppError → { ok:false, message, fieldErrors }
    ▼
  create-catalog.action.ts  (server-only)
    │  createCatalogSchema.safeParse → AppError VALIDATION_ERROR 400 + z.flattenError
    │  requireCatalogAdmin(request, fn, { entity, attemptedAction:"CATALOG_CREATE" })
    │     └─ requireRole → getCurrentActor → 403 + CATALOG_ADMIN_ACTION_DENIED audit if non-admin
    ▼
  transaction({ tenantId, role }, async (tx) =>                       ◀── ONE transaction (AD-4)
    │  switch (kind):
    │    case "metodos":   row = tx.method.create({ data:{ tenantId, name } })
    │                      writeAuditLog(tx, { entity:"Method", entityId:row.id,
    │                                        action:"METHOD_CREATED", before:null, after:{ name } })
    │    case "equipos":   row = tx.equipment.create({ data:{ tenantId, name, model,
    │                                        serialNumber, calibrationDate } })
    │                      writeAuditLog(tx, { entity:"Equipment", action:"EQUIPMENT_CREATED",
    │                                        before:null, after:{ name, model, serialNumber,
    │                                        calibrationDate: row.calibrationDate?.toISOString() ?? null } })
    │    case "tecnicas" / "recipientes" / "tipos-de-muestra": …analogous…
    │  catch isUniqueConstraintViolation → AppError NAME_IN_USE 409 (no partial write)
    ▼
  revalidatePath("/configuracion"); revalidatePath(catalogHref(kind))
  return { ok:true }  →  CatalogForm useEffect(state.ok) → onSuccess → dialog closes
```

```
EDIT FLOW — identical up to the action; inside the transaction:
    switch (kind):
      existing = tx.method.findUnique({ where:{ id } })   → AppError NOT_FOUND 404 if null
      updated  = tx.method.update({ where:{ id }, data:{ name } })
      writeAuditLog(tx, { action:"METHOD_UPDATED",
                          before:{ name: existing.name },
                          after: { name } })
      (equipment before/after include model, serialNumber, calibrationDate)
    catch isUniqueConstraintViolation → 409

DEACTIVATE / REACTIVATE FLOW (uniform across kinds — only delegate + entity/action differ):
    switch (kind):
      existing = tx.method.findUnique({ where:{ id } })   → NOT_FOUND 404 if null
      if (!existing.isActive) return { id }               → NO-OP: skip mutation AND audit write
      tx.method.update({ where:{ id }, data:{ isActive:false } })
      writeAuditLog(tx, { action:"METHOD_DEACTIVATED",
                          before:{ isActive:true }, after:{ isActive:false } })
    (reactivate mirrors: if (existing.isActive) return; isActive:true; _REACTIVATED)
```

Hub page: `resolveActor` → `getCatalogStats()` (`switch` per kind → `scoped({...}).<delegate>.count({ where:{ isActive:true } })`) → card grid. Per-kind page: `CATALOGS[params.catalog]` (404 if unknown) → `requireCatalogAdmin` gate (403→404, 401→redirect) → `listCatalogRows(kind)` (`findMany({ orderBy:{ name:"asc" } })` → serialized rows).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/catalog/registry.ts` | Create | `CATALOGS: Record<CatalogSlug, CatalogKindDef>` — client-safe source of truth for slug/label/entity/actionPrefix/fields. No Prisma import. |
| `src/modules/catalog/schemas.ts` | Create | Shared `catalogCreateSchema` / `catalogUpdateSchema` (discriminated union by `kind`) + input types. Client-safe. |
| `src/modules/catalog/server/catalog-queries.ts` | Create | `listCatalogRows(kind, ctx)` / `countActive(kind, ctx)` / `getCatalogStats(ctx)` — typed `switch (kind)` reads returning serialized rows. Server-only. |
| `src/modules/catalog/server/require-catalog-admin.ts` | Create | Thin `requireRole([admin])` wrapper writing `CATALOG_ADMIN_ACTION_DENIED` with catalog entity. Server-only. |
| `src/modules/catalog/server/create-catalog.action.ts` | Create | `createCatalog(input, request)` — validate → guard → `transaction` → `switch` → typed create + `{ENTITY}_CREATED` audit → 409 on unique. |
| `src/modules/catalog/server/submit-create-catalog.action.ts` | Create | `"use server"` wrapper: tenant resolve, FormData→input, `AppError`→result, `revalidatePath` ×2. |
| `src/modules/catalog/server/update-catalog.action.ts` | Create | `updateCatalog(input, request)` — validate → guard → `switch` → findUnique(404) → typed update + `{ENTITY}_UPDATED` before/after → 409. |
| `src/modules/catalog/server/submit-update-catalog.action.ts` | Create | `"use server"` wrapper for update. |
| `src/modules/catalog/server/deactivate-catalog.action.ts` | Create | `deactivateCatalog({ kind, id }, request)` — no-op guard → `isActive:false` + `{ENTITY}_DEACTIVATED`. |
| `src/modules/catalog/server/submit-deactivate-catalog.action.ts` | Create | `"use server"` wrapper for deactivate. |
| `src/modules/catalog/server/reactivate-catalog.action.ts` | Create | `reactivateCatalog({ kind, id }, request)` — no-op guard → `isActive:true` + `{ENTITY}_REACTIVATED`. |
| `src/modules/catalog/server/submit-reactivate-catalog.action.ts` | Create | `"use server"` wrapper for reactivate. |
| `src/modules/catalog/ui/catalog-form.tsx` | Create | Generic create/edit form driven by `kind.fields`; `initialValues` → edit mode; client Zod + `useActionState`. |
| `src/modules/catalog/ui/catalog-create-dialog.tsx` | Create | Header `Button` trigger + `ModalDialog` + `CatalogForm` (no `initialValues`). |
| `src/modules/catalog/ui/catalog-edit-dialog.tsx` | Create | Row-level ghost `Editar` trigger + `ModalDialog` + `CatalogForm` (pre-filled). |
| `src/modules/catalog/ui/catalog-table.tsx` | Create | `Card` + count + thead + `StatusBadge` + per-row `Editar`/`Desactivar`/`Reactivar` + empty state "No hay {label} todavía"; columns driven by `kind.fields`. |
| `src/app/(app)/configuracion/page.tsx` | Create | Hub server component: `PageHeader` "Configuración" + 5-card grid (label + active count) from `getCatalogStats`. |
| `src/app/(app)/configuracion/[catalog]/page.tsx` | Create | Per-kind server component: resolve slug (404), admin gate, `listCatalogRows`, render `PageHeader` + `CatalogTable` + `CatalogCreateDialog`. |
| `src/components/shell/nav-items.ts` | Modify | Add `{ label: "Configuración", href: "/configuracion", allowedRoles: ["admin"] }`. |
| `src/components/shell/nav-items.test.ts` | Modify | `toHaveLength(1)`→`toHaveLength(2)`; add admin-visible + non-admin-hidden cases. |
| `src/components/shell/sidebar.tsx` | Modify | `const isActive = pathname === item.href` → `pathname.startsWith(item.href)`. |

Tests (new): `src/modules/catalog/registry.test.ts`, `src/modules/catalog/schemas.test.ts` (unit); `tests/integration/catalog/catalog-crud.test.ts`; `tests/e2e/configuracion.spec.ts`.

## Interfaces / Contracts

### Registry (client-safe)

```typescript
// src/modules/catalog/registry.ts
export type CatalogSlug =
  | "metodos" | "tecnicas" | "equipos" | "recipientes" | "tipos-de-muestra";

export interface CatalogFieldDef {
  label: string;
  type: "text" | "date";
  required: boolean;
}

export interface CatalogKindDef {
  slug: CatalogSlug;
  label: string;
  /** Prisma model name — used as writeAuditLog `entity` and as the doc reference
   *  in the server `switch`. Never used as a dynamic delegate key. */
  entity: "Method" | "Technique" | "Equipment" | "Container" | "SampleType";
  /** Uppercase snake audit prefix: action = `${actionPrefix}_CREATED|_UPDATED|...`. */
  actionPrefix: "METHOD" | "TECHNIQUE" | "EQUIPMENT" | "CONTAINER" | "SAMPLE_TYPE";
  fields: Record<string, CatalogFieldDef>;
}

export const CATALOGS: Record<CatalogSlug, CatalogKindDef> = {
  metodos:    { slug: "metodos", label: "Métodos", entity: "Method",
                actionPrefix: "METHOD", fields: { name: { label: "Nombre", type: "text", required: true } } },
  tecnicas:   { slug: "tecnicas", label: "Técnicas", entity: "Technique",
                actionPrefix: "TECHNIQUE", fields: { name: { label: "Nombre", type: "text", required: true } } },
  equipos:    { slug: "equipos", label: "Equipos", entity: "Equipment",
                actionPrefix: "EQUIPMENT",
                fields: {
                  name:            { label: "Nombre",              type: "text", required: true },
                  model:           { label: "Modelo",              type: "text", required: true },
                  serialNumber:    { label: "N.º de Serie",        type: "text", required: true },
                  calibrationDate: { label: "Fecha de Calibración", type: "date", required: false },
                } },
  recipientes: { slug: "recipientes", label: "Recipientes", entity: "Container",
                actionPrefix: "CONTAINER", fields: { name: { label: "Nombre", type: "text", required: true } } },
  "tipos-de-muestra": { slug: "tipos-de-muestra", label: "Tipos de Muestra", entity: "SampleType",
                actionPrefix: "SAMPLE_TYPE", fields: { name: { label: "Nombre", type: "text", required: true } } },
};

export const catalogHref = (slug: CatalogSlug) => `/configuracion/${slug}` as const;
```

### Shared schemas (client-safe)

```typescript
// src/modules/catalog/schemas.ts
const name = z.string().min(1, "Ingresa un nombre.");
const calibrationDate = z
  .preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable())
  .optional();

export const catalogCreateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("metodos"), name }),
  z.object({ kind: z.literal("tecnicas"), name }),
  z.object({ kind: z.literal("equipos"), name,
             model: z.string().min(1, "Ingresa el modelo."),
             serialNumber: z.string().min(1, "Ingresa el número de serie."),
             calibrationDate }),
  z.object({ kind: z.literal("recipientes"), name }),
  z.object({ kind: z.literal("tipos-de-muestra"), name }),
]);

export const catalogUpdateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("metodos"), id: z.string().min(1), name }),
  z.object({ kind: z.literal("tecnicas"), id: z.string().min(1), name }),
  z.object({ kind: z.literal("equipos"), id: z.string().min(1), name,
             model: z.string().min(1, "Ingresa el modelo."),
             serialNumber: z.string().min(1, "Ingresa el número de serie."),
             calibrationDate }),
  z.object({ kind: z.literal("recipientes"), id: z.string().min(1), name }),
  z.object({ kind: z.literal("tipos-de-muestra"), id: z.string().min(1), name }),
]);

export type CreateCatalogInput = z.input<typeof catalogCreateSchema>;
export type UpdateCatalogInput = z.input<typeof catalogUpdateSchema>;
```

### Action signatures (server-only)

```typescript
// shared deactivate/reactivate input
export const catalogIdSchema = z.object({
  kind: z.enum(["metodos","tecnicas","equipos","recipientes","tipos-de-muestra"]),
  id: z.string().min(1),
});

export async function createCatalog(input: CreateCatalogInput, request: CurrentActorRequest): Promise<{ id: string }>;
export async function updateCatalog(input: UpdateCatalogInput, request: CurrentActorRequest): Promise<{ id: string }>;
export async function deactivateCatalog(input: CatalogIdInput, request: CurrentActorRequest): Promise<{ id: string }>;
export async function reactivateCatalog(input: CatalogIdInput, request: CurrentActorRequest): Promise<{ id: string }>;
```

### Submit wrappers (`"use server"`)

```typescript
export interface SubmitCatalogResult { ok: boolean; message?: string; fieldErrors?: Record<string, string>; }
export async function submitCreateCatalog(formData: FormData): Promise<SubmitCatalogResult>;
export async function submitUpdateCatalog(formData: FormData): Promise<SubmitCatalogResult>;
export async function submitDeactivateCatalog(formData: FormData): Promise<SubmitCatalogResult>;
export async function submitReactivateCatalog(formData: FormData): Promise<SubmitCatalogResult>;
```

### Serialized row (server → client)

```typescript
export interface SerializedCatalogRow {
  id: string;
  isActive: boolean;
  /** Keyed by the registry field names; equipment's calibrationDate is "yyyy-MM-dd" | null. */
  values: Record<string, string | null>;
}
```

### Form props

```typescript
export interface CatalogFormProps {
  kind: CatalogSlug;
  /** Present → edit mode (pre-fill + submitUpdateCatalog); absent → create. */
  initialValues?: SerializedCatalogRow;
  firstFieldRef?: React.RefObject<HTMLInputElement | null>;
  onSuccess?: () => void;
  onCancel?: () => void;
}
```

## Testing Strategy

Config: `strict_tdd: true`, `test_command: vitest run`, `e2e_command: playwright test`. RED tests are written before production code per work unit; integration tests run against a real ephemeral Neon branch (`fileParallelism: false`) — no mocked Prisma client is accepted as RLS/audit evidence.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (`vitest run`) | Registry slug contract: 5 keys, canonical kebab slugs, `tipos-de-muestra` (not `tiposDeMuestra`), labels match spec, equipment has 4 fields vs name-only elsewhere, `catalogHref`. | `registry.test.ts` — pure assertion over `CATALOGS`. |
| Unit | Schemas: uniform accepts `name` only; equipment requires `model`/`serialNumber`; `calibrationDate` empty→null, invalid `kind` rejected; update requires `id`. | `schemas.test.ts` — `safeParse` success/failure over the shared schema. |
| Unit | Nav registry: `NAV_ITEMS` length 2; "Configuración" visible to `admin`, hidden to `quimico`/`recepcionista`. | Update `nav-items.test.ts`. |
| Integration | Create persists + `{ENTITY}_CREATED` audit atomically (query `audit_log` by `entityId`); duplicate name → 409 no row; cross-tenant same name allowed; equipment create with `calibrationDate: null`; update + `{ENTITY}_UPDATED` before/after; update→duplicate 409; deactivate `isActive:false` + `_DEACTIVATED`, no hard delete; reactivate `_REACTIVATED`; deactivate-inactive and reactivate-active are no-ops (no audit row); non-admin (`quimico`/`recepcionista`) → 403 + `CATALOG_ADMIN_ACTION_DENIED`. | `tests/integration/catalog/catalog-crud.test.ts` — seed tenant/admin via owner client + `auth.api.signInEmail`, call plain action directly (pattern of `auth-create-user.test.ts` / `auth-rbac-denial.test.ts`). |
| E2E (Playwright) | Admin sees nav + hub with 5 labeled cards; card links; create dialog; edit dialog pre-fills; deactivate/reactivate flips badge; empty state "No hay Métodos todavía"; non-admin 404 on `/configuracion` and `/configuracion/metodos`; sidebar highlights on `/configuracion/metodos`. | `tests/e2e/configuracion.spec.ts` — `seedTenant`/`seedUser` helpers, sign in via UI, drive rendered page (pattern of `usuarios.spec.ts`). |

## Threat Matrix

`N/A` — this change adds file-based App Router routes and Server Actions over the existing `src/shared/db` tenant-scoped wrapper, but introduces no routing/shell-command boundary, no subprocess execution, no VCS/PR automation, no executable-file classification, and no process integration. None of the `references/threat-matrix.md` boundaries (documentation-like paths, git repository selection, commit state, push state, PR commands) apply. No threat-matrix rows or RED tests are manufactured for this change. Tenant isolation and audit immutability are covered by AD-2/AD-3/AD-10 through the existing wrapper, not by a new command/routing surface.

## Migration / Rollout

No DB migration required — the five catalog tables and their RLS/grants already exist from the predecessor `catalog-schema-supporting` change (commit `032e432`). Rollback is a pure `git revert` of the addition. Optional audit cleanup on rollback (proposal rollback #2): delete `audit_log` rows where `entity IN ('Method','Technique','Equipment','Container','SampleType')` and `action` matches the 20 constants (`{METHOD,TECHNIQUE,EQUIPMENT,CONTAINER,SAMPLE_TYPE}_{CREATED,UPDATED,DEACTIVATED,REACTIVATED}`); these rows are append-only and harmless if left. Sidebar regression check: `nav-items.test.ts` still passes and `/usuarios` still highlights (since `/usuarios` has no sub-routes, `startsWith("/usuarios")` ≡ `=== "/usuarios"` for every current URL).

## Open Questions

- [ ] None blocking. One minor parity choice for `sdd-tasks`/`sdd-apply`: whether `updateCatalog` should also carry a no-op guard (skip audit when `before` ≡ `after`), mirroring `update-user-role.action.ts`. The spec does not require it (no-op is mandated only for deactivate/reactivate); the design defaults to **no** update no-op to keep the Equipment field-comparison surface out of scope, but this is safe to revisit at task-planning time without changing the contract.

## Delivery Notes (for sdd-tasks)

This is a large addition (~20 authored files + tests) that will exceed the 400-line review budget as a single PR. Natural work-unit slices, in dependency order, for `auto-chain`:
1. Registry + schemas + their unit tests (client-safe, no server/DB).
2. `require-catalog-admin.ts` + `catalog-queries.ts` + the four plain actions + integration tests (server, typed switch + audit).
3. The four submit wrappers (thin `"use server"` glue).
4. `catalog-form.tsx` + `catalog-create-dialog.tsx` + `catalog-edit-dialog.tsx` + `catalog-table.tsx`.
5. Routes (`configuracion/page.tsx`, `[catalog]/page.tsx`) + nav/sidebar changes + their tests + e2e.

Each slice keeps tests with its behavior (work-unit-commits) and lands independently; the final slice wires the user-visible route and e2e.
