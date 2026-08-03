# Reconciliation Review — ARCHITECTURE-SPINE.md vs. quimiaio-prompt-maestro.md §9-10

**Reviewed:**
- Source: `C:\Projects\QuimiaIO\quimiaio-prompt-maestro.md` (full read; focus on §9 "SCHEMA PRISMA" lines 489-688 and §10 "ESTRUCTURA DE ARCHIVOS" lines 692-738; skimmed §0-8, §11-12)
- Derived spine: `C:\Projects\QuimiaIO\_bmad-output\planning-artifacts\architecture\architecture-quimiaio-2026-07-28\ARCHITECTURE-SPINE.md` (full read)

Scope note: the spine's own `binds:` frontmatter is narrow (`[FR-74a, FR-74b, FR-22, FR-35, NFR-1]`), but AD-4's text claims a blanket ratification of the *entire* §9 base ERD ("the owner's draft schema ... is the base ERD"), explicitly naming `Tenant, User, Patient, Order, OrderItem, Study, Analyte, AnalyteRef, Result, Payment, StudyAnalyte`. Because that ratification claim is model-by-model and unqualified, every field on those named models is fair game for this reconciliation — not just the fields touching the 5 bound FR/NFRs.

---

## 1. Silent drops / unlogged contradictions

### 1.1 Dangling catalog/lookup foreign keys on `Study` — 4 of 5 silently dropped, 1 handled

Owner's §9 `Study` model (prompt-maestro.md lines 587-608) declares five foreign-key fields pointing at catalog entities that Módulo 9 describes narratively but that are **never defined as Prisma models anywhere in §9's code**:

- `sampleTypeId String` (line 593) → Módulo 9.8 "Tipos de Muestra" (lines 330-331)
- `containerId String` (line 594) → Módulo 9.7 "Recipientes" (lines 327-328)
- `methodId String` (line 595) → Módulo 9.4 "Métodos" (lines 318-319)
- `techniqueId String` (line 596) → Módulo 9.5 "Técnicas" (lines 321-322)
- `equipmentId String` (line 597) → Módulo 9.6 "Equipos" (lines 324-325)

The spine explicitly resolves **one** of these five (`containerId`) via AD-6 (lines 60-64) and the ERD note at line 199 ("`Study` needs a `tubeType`/`tubeColor` catalog attribute ... catalog data, not a new entity") — a deliberate, logged decision to fold container semantics into `Study` rather than model a separate entity.

The other four (`sampleTypeId`, `methodId`, `techniqueId`, `equipmentId`) are **not mentioned anywhere** in the spine: not in AD-4, not in the ERD (`ARCHITECTURE-SPINE.md` lines 179-199), not in the Deferred section (lines 234-241), not in the Capability → Architecture Map. Since `Study` is one of the models AD-4 explicitly names as "ratified," and AD-6 shows the authors *did* notice and resolve the sibling `containerId` gap, the silent absence of the other four reads as an oversight rather than a scoped-out decision — there is no "deferred, needs later SPEC→SCHEMA" note for them the way there is for Doctor/CashSession/AuditLog (see §2 below, where that pattern is done correctly).

### 1.2 `User.roleId` / `role Role` relation — dropped, not modeled, not deferred

Owner's §9 `User` model (lines 506-519) declares `roleId String` and `role Role @relation(fields: [roleId], references: [id])` (line 518), referencing a `Role` model that §9's Prisma code never actually defines. Módulo 12 (lines 402-419) makes clear this is load-bearing: five predefined roles plus a granular per-module permission matrix ("Permisos granulares por módulo").

`Role` does not appear anywhere in the spine (verified via full-text search) — not in the ERD, not in AD-8 (Better Auth, which explicitly "Binds: ... all modules that perform session/role checks" without saying where role/permission data lives), not in the Deferred list. `User` itself is one of the models AD-4 names as ratified, so this is a field silently dropped from a model the spine claims to have carried forward whole.

### 1.3 `User.branchId` / `Order.branchId` — dropped, not modeled, not deferred

Owner's §9 declares `branchId String?` on `User` (line 515) and `branchId String` (required) on `Order` (line 546). Branch/sucursal is load-bearing elsewhere in the source: pricing tiers gate it (§5 line 103, Plan Red "Hasta 5" sucursales), Módulo 11 has a dedicated "Dashboard multi-sucursal" (lines 396-398), and Caja tracks "Usuario y sucursal" (Módulo 10, line 351).

No `Branch` entity, and no mention of `branchId` at all, appears anywhere in the spine (verified via full-text search) — not in the ERD, not in the Deferred section, not in the Capability map. Both `User` and `Order` are models AD-4 names as ratified, so this field is silently dropped from two models the spine claims to carry forward.

### 1.4 `OrderItem.status: ItemStatus` — enum referenced, never defined in source, never surfaced in spine

Owner's §9 `OrderItem` model (line 580) declares `status ItemStatus @default(PENDING)`, but no `enum ItemStatus { ... }` block exists anywhere in §9 (contrast with `OrderStatus`, `AnalyteType`, `ResultStatus`, `PaymentMethod`, `Plan`, `Sex`, all of which the owner did spell out). `OrderItem` is one of the models AD-4 names as ratified. The spine never mentions `ItemStatus` (verified via full-text search) — it isn't resolved the way `Result.source` was added (AD-4 correction 2), and it isn't named in the Deferred section either. This is the same "dangling reference the owner sketched but never bodied out" pattern as 1.1-1.3, and it gets the same silent treatment.

### 1.5 §10 file/directory structure superseded without being logged as a correction to §10

The spine's frontmatter (`sources:`, line 16) explicitly cites `quimiaio-prompt-maestro.md (sections 9-10)`, meaning §10 (the flat `app/(dashboard)/{pacientes,ordenes,pipeline,...}` + `components/` + `lib/` Next.js structure, lines 692-738) is claimed as reconciled source material. AD-1 (lines 30-34) and the Source Tree (lines 201-222) replace this wholesale with a `src/modules/<name>/` vertical-slice layout. This is a defensible, well-reasoned architectural decision (AD-1's rationale against a "simple layered architecture" is sound) — but nowhere does the spine state that this decision *supersedes/corrects §10's proposed structure*, the way AD-4 explicitly frames its two schema corrections. Given §10 is named as a reconciled source, this asymmetry (schema corrections are logged as corrections; the structural correction is not) is worth flagging, though it is lower severity than 1.1-1.4 since AD-1 is at least an adopted, rationale-backed decision rather than a bare omission.

---

## 2. Checked and confirmed adequately covered

- **Core ratified entities** (`Tenant, User, Patient, Order, OrderItem, Study, Analyte, AnalyteRef, Result, Payment`) — field-by-field and relation-by-relation comparison against §9 lines 489-688 confirms the spine's mermaid ERD (lines 179-199) and Source Tree (lines 201-222) correctly preserve every relation the owner did fully specify (Tenant→User/Patient/Order, Patient→Order, Order→OrderItem/Payment, OrderItem→Study/Result, Study↔Analyte via StudyAnalyte, Analyte→AnalyteRef, Result→Analyte).
- **`Order.folio` uniqueness correction (AD-4 fix #1)** — already logged as deliberate, not flagged here. Side note for context only: the owner's Prisma code (line 541) never actually declared `folio` as globally `@unique` (no unique attribute was present at all) — the owner's *prose* (Módulo 3, line 155: "Folio (auto, único por tenant)") already specified per-tenant uniqueness. So AD-4's fix lands exactly on what the owner's own module description already intended; this is a correct completion, not a contradiction of anything the owner specified.
- **`Result.source` addition (AD-4 fix #2)** — already logged as deliberate, not flagged here. No `source` field existed in owner's `Result` model at all, so this is a pure addition motivated by FR-35, not an override of any owner-specified value.
- **No separate Sample/Container entity (AD-6)** — correctly matches the owner's own §9 sketch, which likewise has no `Sample`/`Container` model; AD-6's tube-color/barcode reasoning is a deliberate, logged architectural call, and it is the one dangling `Study` FK (`containerId`) that *did* get resolved (contrast with 1.1).
- **`qrToken String @unique` (global, not per-tenant)** — correctly left untouched by the spine. Unlike `folio`, global uniqueness here is actually required (the public portal route `quimiaio.com/r/{token}`, §7 lines 463-472, has no tenant context to disambiguate against), so not applying the same per-tenant-composite treatment as `folio` is correct, not an inconsistency.
- **Payment methods (`CASH/CARD/TRANSFER/CREDIT`)** — matches Módulo 3's "efectivo, tarjeta, transferencia, crédito" (line 150) one-to-one; untouched and uncontradicted.
- **Twilio/WhatsApp and Stripe deferral to Phase 2** — §10's file skeleton includes `lib/twilio.ts` and `api/webhooks/twilio/` as if Phase 1, but the spine's Stack table and Deferred section explicitly and correctly log this as a deliberate Phase-2 push (not silent — it's stated twice).
- **Doctor, CashSession/Caja, AuditLog models** — correctly and explicitly named in the Deferred section (lines 236) as "needed for Phase 1 FRs but not yet drafted in the owner's schema sketch," deferred to each module's own SPEC→SCHEMA time. This is the right pattern — it's exactly what's missing for Role/Branch/ItemStatus/SampleType/Method/Technique/Equipment (see §1).
- **Company, Quotation, Inventory, CFDI models** — correctly and explicitly logged as Phase 2 scope (Deferred section, line 237), matching §5's plan-gating in the source.

---

## Overall verdict

The spine's ratification of the *explicitly-bodied* core entities and their relations (Tenant/User/Patient/Order/OrderItem/Study/Analyte/AnalyteRef/Result/Payment/StudyAnalyte) is accurate and the two logged corrections (folio composite uniqueness, `Result.source`) are well-motivated and consistent with the owner's own intent — but AD-4's claim to ratify those same models "whole" is not fully honest: it silently drops seven owner-specified-but-undrafted relationships/fields embedded in the very models it names as ratified (`User.roleId`/`role`, `User.branchId`, `Order.branchId`, `Study.sampleTypeId`, `Study.methodId`, `Study.techniqueId`, `Study.equipmentId`, `OrderItem.status:ItemStatus`) without modeling them, resolving them (as it correctly did for the sibling `Study.containerId` gap via AD-6), or logging them in the Deferred section the way it correctly did for Doctor/CashSession/AuditLog — so this Finalize pass should not close out AD-4 as complete until those seven items are either modeled or explicitly added to Deferred.
