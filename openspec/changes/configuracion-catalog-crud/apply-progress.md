# Apply Progress: Configuración — Catalog CRUD (Story 2.1, Change 2/6)

## Mode

Strict TDD (RED → GREEN → REFACTOR) — resolved from `openspec/config.yaml` (`strict_tdd: true`) + test runner `vitest run`.

## Slice Boundary

PR 5 (auto-chain, work-unit 5 of 5) — **Phase 5 only**: the user-visible routes (`/configuracion` hub + `/configuracion/[catalog]`), the nav/sidebar changes, and the e2e spec. Phases 1–4 (PR 1 + PR 2 + PR 3 + PR 4) are complete and preserved below. One minimal, documented Phase 2 file touch was required (see Phase 5 Notes: `require-catalog-admin.ts` `attemptedAction` made optional so the page-level READ gate can reuse the guard without fabricating a mutation action).

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

---

## Phase 3 (PR 3 — this slice: implemented AND verified GREEN)

### Completed Tasks (Phase 3)

- [x] 3.1 GREEN — `src/modules/catalog/server/submit-create-catalog.action.ts` (file-level `"use server"`; `submitCreateCatalog(formData): Promise<SubmitCatalogResult>`; headers() → `tenantId`/`requestId` with `UNRESOLVED_TENANT` guard; FormData → `CreateCatalogInput` mapping with `calibrationDate` `""`→`null` and `model`/`serialNumber` only for `kind === "equipos"`; `AppError` → `{ ok, message, fieldErrors }`; double `revalidatePath` after success).
- [x] 3.2 GREEN — `src/modules/catalog/server/submit-update-catalog.action.ts` (`submitUpdateCatalog`; same mapping + `id` from a hidden input; calls `updateCatalog`).
- [x] 3.3 GREEN — `src/modules/catalog/server/submit-deactivate-catalog.action.ts` (`submitDeactivateCatalog`; maps hidden `{ kind, id }` → `CatalogIdInput`; calls `deactivateCatalog`).
- [x] 3.4 GREEN — `src/modules/catalog/server/submit-reactivate-catalog.action.ts` (`submitReactivateCatalog`; maps hidden `{ kind, id }`; calls `reactivateCatalog`).
- [x] 3.5 Verify — `npx tsc --noEmit` exit 0; `npx next build` exit 0 (Turbopack, "Compiled successfully in 16.7s", 7/7 static pages) with NO Prisma/`pg`-in-client error.

### TDD Cycle Evidence (Phase 3)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (no isolated unit boundary for file-level glue — NOT a test-first RED; prescribed verification is tsc + next build; wrapper exercised end-to-end by PR 5's e2e) | ✅ `npx tsc --noEmit` exit 0 (FormData→input mapping + AppError→result translation type-checked) | — (mapping cases: equipos full set incl. `""`→null, uniform kinds name-only — covered by tsc narrowing) | ✅ Clean |
| 3.2 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (same glue note as 3.1) | ✅ `npx tsc --noEmit` exit 0 | — (hidden `id` mapping + equipos superset) | ✅ Clean |
| 3.3 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (same glue note as 3.1) | ✅ `npx tsc --noEmit` exit 0 | — (`{ kind, id }` → `CatalogIdInput`) | ✅ Clean |
| 3.4 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (same glue note as 3.1) | ✅ `npx tsc --noEmit` exit 0 | — (mirror of 3.3) | ✅ Clean |
| 3.5 | — (static/build gate) | Build | — | — | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 — no Turbopack error from Prisma/`pg` leaking into the client bundle (the reason these live in their own `"use server"` files) | — | ✅ Grep: wrappers import only next/headers, next/cache, middleware const, shared errors, registry, schemas, and the plain action |

### Test Summary (Phase 3)

- **Total tests written**: 0 (no unit-test boundary for file-level glue — see evidence note)
- **Total tests passing**: N/A (static/build verification instead) — Phase 1 unit 18/18 + Phase 2 integration 17/17 remain the behavioral safety net, untouched by this slice
- **Layers used**: Static type-check (`tsc --noEmit`) + production build (`next build`), per tasks.md 3.5 and the design's Testing Strategy
- **Approval tests** (refactoring): None — all new files
- **Pure functions created**: 0 new (per-wrapper `calibrationDateOrNull` normalization is a private 1-liner; `catalogHref` reused from Phase 1)

### Work Unit Evidence (Phase 3)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx tsc --noEmit` → exit 0 (clean, ~0 output). `npx next build` → exit 0: `✓ Compiled successfully in 16.7s`, `Finished TypeScript in 25.5s`, `✓ Generating static pages ... (7/7) in 2.7s`. No Turbopack/Prisma-`pg`-in-client error. |
| Runtime harness command/scenario and exact result | `N/A` — no client consumer exists until PR 4 mounts the form; the wrappers are exercised end-to-end by PR 5's e2e (`tests/e2e/configuracion.spec.ts`), per tasks.md Work Unit 3 row. |
| Rollback boundary | Delete the 4 `submit-*.action.ts` files (`submit-create-catalog`, `submit-update-catalog`, `submit-deactivate-catalog`, `submit-reactivate-catalog`) — plain actions (PR 2) remain intact and still tested |

---

## Phase 4 (PR 4 — this slice: implemented AND verified GREEN)

### Completed Tasks (Phase 4)

- [x] 4.1 GREEN — `src/modules/catalog/ui/catalog-form.tsx` — generic `CatalogForm({ kind, initialValues?, firstFieldRef?, onSuccess?, onCancel? })`. Renders one `Field` + `Input` per `CATALOGS[kind].fields` entry (NO per-kind branching; `type: "date"` renders `<Input type="date">` for equipment's `calibrationDate`). `initialValues` present → edit mode (uncontrolled `defaultValue` pre-fill, hidden `id` input, calls `submitUpdateCatalog`); absent → create mode (calls `submitCreateCatalog`). Client-side `catalogCreateSchema`/`catalogUpdateSchema` `safeParse` blocks submit and shows `fieldErrors`; `useActionState` handles the server result; `useEffect(state.ok)` fires `onSuccess`. Exports the client-safe `CatalogRow` interface (structural twin of server `SerializedCatalogRow` — the server file is `server-only`, AD-3). Pattern: `create-user-form.tsx` (read-only).
- [x] 4.2 GREEN — `src/modules/catalog/ui/catalog-create-dialog.tsx` — `Button` "Crear {label}" trigger → `ModalDialog` (title `Crear {label}`) → `CatalogForm` (no `initialValues`); auto-close on success; `firstFieldRef` threaded into both `initialFocus` and the form (Epic 2 form-dialog pattern). Pattern: `create-user-dialog.tsx` (read-only).
- [x] 4.3 GREEN — `src/modules/catalog/ui/catalog-edit-dialog.tsx` — row-level ghost "Editar" trigger → `ModalDialog` (title "Editar elemento") → `CatalogForm` with `initialValues` pre-filled from the row; auto-close on success. One dialog instance per row (popup unmounts while closed, form remounts fresh with the row's current values on every open).
- [x] 4.4 GREEN — `src/modules/catalog/ui/catalog-table.tsx` — `Card` + active-count header (`{n} elementos registrados · {m} activos`) + thead band + row hover + `StatusBadge` ("Activo"/"Inactivo") + per-row "Editar" (`CatalogEditDialog`) / "Desactivar" / "Reactivar" ghost buttons (submit wrappers in a transition) + empty state "No hay {label} todavía"; columns driven by `kind.fields` (first field renders `font-medium`, others muted). Pattern: `users-table.tsx` (read-only). Verified against spec "Empty And Status States" scenarios ("No hay Recipientes todavía", "Activo" badge for `isActive: true`, "Inactivo" badge for `isActive: false`).
- [x] 4.5 Verify — `npx tsc --noEmit` exit 0; `npx next build` exit 0 — client/server boundary clean, no Prisma/`pg` leak into the client bundle.

### TDD Cycle Evidence (Phase 4)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | — (no unit-test boundary) | Client component (`"use client"`) | Phase 1 unit 18/18 + Phase 2 integration 17/17 + Phase 3 tsc/build gates | — (NO unit-test boundary: the component is NOT mounted by any route until PR 5 and has no isolated test harness — NOT a test-first RED; prescribed verification per tasks.md 4.5 and design is `tsc --noEmit` + `next build`; driven end-to-end by PR 5's Playwright e2e `tests/e2e/configuracion.spec.ts`) | ✅ `npx tsc --noEmit` exit 0 (props/schema/action wiring type-checked); `npx next build` exit 0 (component compiles into the client graph with no Prisma/`pg` leak) | — (generic field iteration: equipos 4-field superset + uniform name-only kinds; create vs edit branch; client safeParse block; server fieldErrors mapping — covered by tsc narrowing + e2e later) | ✅ Clean |
| 4.2 | — (no unit-test boundary) | Client component (`"use client"`) | same as 4.1 | — (same unmounted-UI note as 4.1) | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 | — (trigger/dialog/form wiring; auto-close via `onSuccess`) | ✅ Clean |
| 4.3 | — (no unit-test boundary) | Client component (`"use client"`) | same as 4.1 | — (same unmounted-UI note as 4.1) | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 | — (row pre-fill via `initialValues` → `defaultValue`; hidden `id`) | ✅ Clean |
| 4.4 | — (no unit-test boundary) | Client component (`"use client"`) | same as 4.1 | — (same unmounted-UI note as 4.1) | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 | — (empty state + Activo/Inactivo badge + deactivate/reactivate wiring — spec scenarios verified by inspection; e2e owns the rendered assertions) | ✅ Clean |
| 4.5 | — (static/build gate) | Build | — | — | ✅ `npx tsc --noEmit` exit 0 (clean); `npx next build` exit 0: `✓ Compiled successfully in 33.4s`, `Finished TypeScript in 27.0s`, `✓ Generating static pages ... (7/7) in 6.6s`, route table unchanged (no `configuracion` routes yet — PR 5) | — | ✅ Grep: UI files import only react/zod/lucide, `@/components/ui/*` primitives, registry/schemas (client-safe), the four `submit-*.action.ts` wrappers (file-level `"use server"` proxies), and sibling UI files — zero `@/shared/db`/Prisma/`server-only` imports |

### Test Summary (Phase 4)

- **Total tests written**: 0 (no unit-test boundary for unmounted UI — see evidence note; PR 5's e2e owns the rendered behavior)
- **Total tests passing**: N/A (static/build verification instead) — Phase 1 unit 18/18 + Phase 2 integration 17/17 remain the behavioral safety net, untouched by this slice
- **Layers used**: Static type-check (`tsc --noEmit`) + production build (`next build`), per tasks.md 4.5 and the design's Testing Strategy
- **Approval tests** (refactoring): None — all new files
- **Pure functions created**: 0 new (all components; registry/schemas reused from Phase 1)

### Work Unit Evidence (Phase 4)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx tsc --noEmit` → exit 0 (clean, ~0 output). `npx next build` → exit 0: `✓ Compiled successfully in 33.4s`, `Finished TypeScript in 27.0s`, `✓ Generating static pages ... (7/7) in 6.6s`. No Turbopack/Prisma-`pg`-in-client error. Only warning: the pre-existing `middleware` file-convention deprecation (unrelated, noted in the orchestrator brief). |
| Runtime harness command/scenario and exact result | `N/A` — components are not mounted by any route until PR 5 (`next build` route table shows no `configuracion` routes yet); driven by PR 5's e2e (`tests/e2e/configuracion.spec.ts`), per tasks.md Work Unit 4 row. |
| Rollback boundary | Delete `src/modules/catalog/ui/catalog-form.tsx`, `catalog-create-dialog.tsx`, `catalog-edit-dialog.tsx`, `catalog-table.tsx` — server actions + submit wrappers (PR 2/3) remain and their tests/build still pass |

## Phase 5 (PR 5 — this slice: implemented AND verified GREEN)

### Completed Tasks (Phase 5)

- [x] 5.1 GREEN — `src/app/(app)/configuracion/page.tsx` — server component (`"server-only"`) mirroring `(app)/usuarios/page.tsx`: `headers()` → `x-tenant-id` (unresolved → `notFound()`), `requireCatalogAdmin` gate (401→`redirect("/sign-in")`, 403→`notFound()`), `getCatalogStats(ctx)` → `PageHeader` "Configuración" + a registry-driven 5-card grid. Each card renders in `CATALOGS[slug].label` order with the active count ("0 elementos" when zero, else `N elemento(s)`) and is a `<Link>` to `catalogHref(slug)`. Verified against "Hub Page Lists All Five Catalog Kinds With Active Counts".
- [x] 5.2 GREEN — `src/app/(app)/configuracion/[catalog]/page.tsx` — server component: `await params` (Next 16 async params), `resolveCatalog(catalog)` against `CATALOGS` (`notFound()` for unknown/non-canonical slug, incl. `tiposDeMuestra`), `requireCatalogAdmin` gate, `listCatalogRows(kind.slug, ctx)`, renders `PageHeader` (title = catalog label) + `CatalogTable` + `CatalogCreateDialog`. Verified against "Per-Catalog Page Enforces Admin Gate And Resolves The Slug" and "Canonical Catalog Slug Contract".
- [x] 5.3 GREEN — `src/components/shell/nav-items.ts` — added `{ label: "Configuración", href: "/configuracion", allowedRoles: ["admin"] }` after "Usuarios y Roles"; updated the file's scope-boundary comment from one to two real entries.
- [x] 5.4 RED → GREEN — `src/components/shell/nav-items.test.ts` — `toHaveLength(1)`→`toHaveLength(2)` plus "includes 'Configuración' for an admin" and "hides 'Configuración' for quimico and recepcionista". RED: 2 failed / 4 passed; GREEN: 6/6.
- [x] 5.5 GREEN — `src/components/shell/sidebar.tsx` — `pathname === item.href` → `pathname.startsWith(item.href)` with a comment explaining sub-route highlighting and the unchanged `/usuarios` behavior. Verified against "Sidebar Highlights Configuración On Sub-Routes" (e2e asserts `aria-current="page"` on the sub-route).
- [x] 5.6 RED → GREEN — `tests/e2e/configuracion.spec.ts` (4 tests; pattern `usuarios.spec.ts`, `seedTenant`/`seedUser`, sign-in through the real UI): (1) admin sees nav + hub with 5 labeled cards, "0 elementos" ×5, Métodos card → `/configuracion/metodos`, sidebar `aria-current` on the sub-route; (2) create dialog opens via "Crear Métodos" + auto-closes, row + Activo badge, empty state disappears, edit dialog pre-fills/renames, deactivate→Inactivo, reactivate→Activo; (3) non-admin (recepcionista): nav entry absent, 404 on `/configuracion` and `/configuracion/metodos`; (4) admin: 404 on non-canonical `tiposDeMuestra` and `/configuracion/inexistente`. RED (routes absent): tests 1–2 failed ("element(s) not found"); GREEN (routes present): **4/4 passed**.
- [x] 5.7 Final verification — `npx tsc --noEmit` exit 0; `npx next build` exit 0 (route table now lists `ƒ /configuracion` + `ƒ /configuracion/[catalog]`); full unit `npx vitest run` → **12 files / 70 tests passed**; integration `npx vitest run --config vitest.integration.config.ts` → **23 files / 119 tests passed**; `npx playwright test tests/e2e/configuracion.spec.ts` → **4 passed** (2.0m). Every proposal Success Criteria checkbox confirmed (details in Notes).

### TDD Cycle Evidence (Phase 5)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.3 + 5.4 | `src/components/shell/nav-items.test.ts` | Unit | ✅ 4/4 (pre-change baseline) | ✅ Written (2 new tests: admin-visible `/configuracion`, length 2) — observed `2 failed | 4 passed` (item absent, length 1) | ✅ **6/6 passed** (`npx vitest run src/components/shell/nav-items.test.ts`) | ✅ 3 cases (admin-visible, quimico+recepcionista-hidden, registry length 2) | ✅ Clean (no whitespace/dead code) |
| 5.1 + 5.2 + 5.5 + 5.6 | `tests/e2e/configuracion.spec.ts` | E2E (real browser + built server + ephemeral Neon branch) | N/A (new spec); unit 70/70 + integration 119/119 remain green | ✅ Written before routes existed; observed RED: route-dependent tests 1–2 failed (`getByRole('heading'…) element(s) not found`), route-independent tests 3–4 passed | ✅ **4/4 passed** (`npx playwright test tests/e2e/configuracion.spec.ts`) — hub, CRUD lifecycle, non-admin 404, invalid-slug 404 | ✅ 4 tests covering hub+nav+sidebar, create/edit/deactivate/reactivate, non-admin gate, slug contract | ✅ Clean |

### Test Summary (Phase 5)

- **Total tests written**: 6 new (2 nav unit additions + 4 e2e); existing counts: full unit 70, integration 119
- **Total tests passing**: nav unit 6/6; full unit 70/70; integration 119/119; e2e 4/4
- **Layers used**: Unit (nav registry), E2E (routes/sidebar/CRUD), plus existing integration coverage for the action-level behavior
- **Approval tests** (refactoring): None — no refactoring tasks
- **Pure functions created**: 1 (`resolveCatalog` in the `[catalog]` page — pure slug→definition lookup, exercised by the invalid-slug e2e test)

### Work Unit Evidence (Phase 5)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run src/components/shell/nav-items.test.ts` → `Tests 6 passed (6)` (exit 0). `npx playwright test tests/e2e/configuracion.spec.ts` → `4 passed (2.0m)` (exit 0). |
| Runtime harness command/scenario and exact result | `npx playwright test tests/e2e/configuracion.spec.ts` → `scripts/e2e/start-server.ts` created a real ephemeral Neon branch, ran `prisma migrate deploy`, provisioned `quimia_app`, ran a production `next build`, started `next start`; all 4 tests drove the real rendered app (hub → card link → `/configuracion/metodos` → create/edit/deactivate/reactivate through the real modal dialogs, sidebar `aria-current`, non-admin 404, invalid-slug 404). |
| Rollback boundary | Delete `src/app/(app)/configuracion/` (both pages) + `tests/e2e/configuracion.spec.ts`; revert the edits to `src/components/shell/nav-items.ts`, `nav-items.test.ts`, `sidebar.tsx`; revert the one-line `attemptedAction?:` relaxation in `src/modules/catalog/server/require-catalog-admin.ts`. All prior units remain and pass. |

## Cumulative State

- Phase 1: 5/5 complete
- Phase 2: 8/8 complete (verified GREEN)
- Phase 3: 5/5 complete (verified GREEN)
- Phase 4: 5/5 complete (verified GREEN)
- Phase 5: 7/7 complete (verified GREEN)

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

## Phase 3 Notes / Deviations

- **`SubmitCatalogResult` ownership**: the design's Interfaces section lists a single shared `SubmitCatalogResult` type and its File Changes table lists no extra file for it — it is defined once and exported from `submit-create-catalog.action.ts`, then type-only-imported by the other three wrappers. Mirrors Phase 2's `catalogIdSchema` single-ownership precedent (deactivate → reactivate import). No circular import (type-only, erased at compile).
- **Uniform `AppError` → `{ ok, message, fieldErrors }` translation in all four wrappers** (not just create/update): the design's submit-wrapper contract and the Phase 3 task text both describe the shared `SubmitCatalogResult` shape, so deactivate/reactivate translate fieldErrors too (harmless for hidden `{ kind, id }` inputs, keeps the client result shape identical across all four actions).
- **`calibrationDate` normalization lives in each create/update wrapper** as a private 1-line `calibrationDateOrNull` (`""`/missing → `null`, else raw `"yyyy-MM-dd"` string; the shared schema coerces to `Date`) — matches the design's "preprocess at the FormData boundary (client + submit wrapper)" and the Phase 2 integration evidence that the plain actions accept both `null` and `"2026-05-20"`-style strings.
- **No new migrations, no schema changes, no UI/routes/e2e** — Phase 3 is four `"use server"` glue files only.

## Phase 4 Notes / Deviations

- **`CatalogRow` client type (deviation from design's letter, contract unchanged)**: the design's `CatalogFormProps` cites `SerializedCatalogRow`, which lives in `catalog-queries.ts` — a `server-only` module. Importing it from a `"use client"` component would pull Prisma/`pg` into the browser bundle (AD-3, the exact failure Phase 3's file-split exists to prevent). The client-safe structural twin `CatalogRow` is defined and exported from `catalog-form.tsx` (mirrors `users-table.tsx`'s own `UserRow` precedent) and reused by `catalog-table.tsx`/`catalog-edit-dialog.tsx`. TypeScript's structural typing keeps server rows (`SerializedCatalogRow[]`) assignable when PR 5's server page passes them in.
- **Form action is component-scoped (not module-level)**: `catalogFormAction` is defined inside `CatalogForm` so it can close over `kind`, `fields`, `isEdit` and the chosen schema — the create/edit mode split is driven by `initialValues` presence exactly as the design prescribes, with no mode flag in the props. `useActionState` uses the latest action identity (standard Next.js inline-action pattern).
- **Hidden inputs carry `kind` (always) and `id` (edit only)**: matches the design's Data Flow note ("kind + id carried by hidden inputs") and the submit wrappers' FormData contract (`submitUpdateCatalog` reads `id` from the form).
- **Edit dialog title**: "Editar elemento" — neutral/professional Spanish, avoids grammar issues with the plural registry labels ("Editar Métodos") and avoids coupling to `row.values.name`.
- **Submit labels**: create mode "Crear {label}" (shares the trigger label, mirroring the auth trigger/submit parity), edit mode "Guardar cambios"; pending states "Creando..."/"Guardando...".
- **Client-side `safeParse` field-error filtering** filters `issue.path[0]` to `Object.keys(fields)` — the generic equivalent of `create-user-form.tsx`'s fixed field list; `kind`/`id` discriminator errors are unreachable (hidden inputs are controlled by the component) and are never shown as field errors. Server-returned `fieldErrors` are filtered the same way.
- **No new migrations, no schema changes, no routes/nav/e2e** — Phase 4 is four `"use client"` UI files only. `next build`'s route table is unchanged (no `configuracion` routes yet — that is PR 5's slice).

## Phase 5 Notes / Deviations

- **Page-level READ gate reuses `requireCatalogAdmin` with `attemptedAction` made optional (one Phase 2 file touched, boundary documented).** Tasks 5.1/5.2 require a `requireCatalogAdmin` page gate, but the guard's `RequireCatalogAdminOptions.attemptedAction` was required and its union (`CATALOG_CREATE|UPDATE|DEACTIVATE|REACTIVATE`) has no READ member — passing a mutation action for a page GET would fabricate misleading denial-audit data. `attemptedAction` is now optional, mirroring `requireAdmin`'s own optional `attemptedAction` (the established codebase pattern); the four Phase 2 mutation paths still pass it and are behaviorally unchanged (Phase 2 integration 17/17 still green). The hub passes `entity: "Catalog"`, the per-kind page passes `CATALOGS[kind].entity`; a non-admin page denial writes `CATALOG_ADMIN_ACTION_DENIED` with `after: null`. This one-line relaxation extends the PR 5 rollback boundary (see Work Unit Evidence).
- **Unauthenticated redirect is inherited from the shell layout, not re-asserted in the new e2e.** `/configuracion.*` lives under the `(app)` route group whose layout calls `resolveActor()` and redirects any unauthenticated request to `/sign-in` before the page body renders — pre-existing, already-covered shell behavior. The new e2e asserts the spec's admin/non-admin/slug scenarios directly; the unauthenticated-redirect scenario is satisfied by that unchanged layout path (design Data Flow: hub uses `resolveActor`; the page gate's 401→redirect is a second line of defense).
- **`params` is awaited (Next 16).** `src/app/(app)/configuracion/[catalog]/page.tsx` types `params` as `Promise<{ catalog: string }>` and awaits it, matching Next 16's async params.
- **`resolveCatalog` guards the registry lookup at runtime, not via a cast.** `CATALOGS` is typed `Record<CatalogSlug, CatalogKindDef>`, so a blind `CATALOGS[catalog as CatalogSlug]` would type-check but return `undefined` at runtime for an unknown slug; the page indexes through `Record<string, CatalogKindDef | undefined>` and `notFound()`s when absent, so `tiposDeMuestra`/`inexistente` 404 (asserted in e2e test 4).
- **Hub card copy**: zero active rows → the spec's literal "0 elementos"; otherwise `N elemento(s)` (singular/plural). The card's accessible name is the label plus the count, so the e2e `getByRole("link", { name: /métodos/i })` is unambiguous.
- **No new migrations, no schema changes** — Phase 5 is two route files + nav/sidebar + one e2e spec + the one-line guard relaxation.
- **Browser prerequisite**: Playwright's `chromium_headless_shell-1234` was missing on this machine; installed via `npx playwright install chromium-headless-shell` (environment setup, not a test result — the first e2e attempt failed on `browserType.launch` before any assertion ran).

## Resume Re-verification Pass (delivery run — orchestrator relaunch)

> This section preserves every prior section above verbatim and records an independent re-verification performed when the Phase 5 slice was relaunched to complete delivery (its prior implementation was fully written and staged but uncommitted). Only what was re-observed on this machine/run is reported here.

### Commands re-run and exact results

| Command | Result |
|---|---|
| `npx vitest run src/components/shell/nav-items.test.ts` | ✅ `Test Files 1 passed (1)` / `Tests 6 passed (6)` (exit 0, 503ms) |
| `npx vitest run` (full unit) | ✅ `Test Files 12 passed (12)` / `Tests 70 passed (70)` (exit 0, 714ms) |
| `npx tsc --noEmit` | ✅ exit 0 (clean; the previously-noted stale `.next/types/validator.ts` error did not resurface) |
| `npx next build` | ✅ exit 0 (`✓ Compiled successfully in 5.0s`; route table lists `ƒ /configuracion` + `ƒ /configuracion/[catalog]`) |
| `npx playwright test tests/e2e/configuracion.spec.ts` | ✅ `4 passed (1.6m)` — real ephemeral Neon branch + built `next start`; hub+nav+sidebar, full CRUD lifecycle, non-admin 404, invalid-slug 404 |
| `npx vitest run --config vitest.integration.config.ts` (full) | ⚠️ `1 failed \| 22 passed (23) files` / `4 failed \| 115 passed (119) tests` — the 4 failures are all `Error: Client has encountered a connection error and is not queryable` / "Connection terminated unexpectedly" in the UNRELATED `tests/integration/auth-deactivate-user.test.ts` (its first test hung 323s). The catalog file passed within that run. |
| `npx vitest run --config vitest.integration.config.ts tests/integration/auth-deactivate-user.test.ts` (isolated) | ✅ `Test Files 1 passed (1)` / `Tests 5 passed (5)` (41.26s) — proves the full-suite failures were ephemeral-Neon connection loss, not a regression |
| `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-crud.test.ts` | ⚠️ `8 failed \| 9 passed (17)` with `APIError: Failed to get session` / `fetch failed` |
| same catalog command, retry | ❌ `No test files found` — globalSetup threw before collection: `Neon API POST /projects/<id>/branches failed (422): {"code":"BRANCHES_LIMIT_EXCEEDED","message":"branches limit exceeded"}` |

### Classification

The integration-suite failures on this resume are **infrastructure, not code**: the Neon project has reached its plan branch limit (`BRANCHES_LIMIT_EXCEEDED`, HTTP 422), so `tests/setup/neon-global-setup.ts` can no longer create a fresh branch per run. Every symptom (connection termination, "Failed to get session", `fetch failed`) precedes any catalog assertion; the same files pass in isolation when a branch is available, and the **e2e succeeded end-to-end on a real branch moments earlier** (create/edit/deactivate/reactivate). No catalog code path is implicated. The Phase 5 slice's own runtime evidence (e2e 4/4) is green; unit 70/70, `tsc`, and `next build` are green.

### Residual environment risk (not resolved by this slice)

Ephemeral `test-local-*` branches leaked from interrupted runs appear to have exhausted the free-tier branch budget. Until they are pruned (an authorized Neon control-plane mutation, intentionally NOT performed here), the full Vitest integration suite — and the Playwright harness, which also provisions a branch — may fail to provision one. Recommendation: prune leaked test branches, then re-run `npx vitest run --config vitest.integration.config.ts` to reconfirm the full 119/119.
