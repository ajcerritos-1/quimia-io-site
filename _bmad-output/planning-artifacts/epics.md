---
stepsCompleted: [step-01, step-02, step-03]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md
  - _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-quimiaio-2026-07-10/EXPERIENCE.md
---

# Quimia IO - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Quimia IO, decomposing the requirements from the PRD, UX Experience Spine, and Architecture Spine into implementable stories. Scope note: Phase 1 (the first client's 17-week, $32,000 MXN fixed-scope build) is the target for epic/story decomposition — it is the only phase with a finalized Architecture Spine. Phase 2/3 FRs are inventoried below for traceability but are flagged `[PHASE 2]` / `[PHASE 3]` and are not decomposed into stories in this pass.

## Requirements Inventory

### Functional Requirements

**Phase 1 — in scope for this decomposition**

FR-1: Users sign in with nickname/email and password; sessions are tenant-scoped.
FR-2: Admin can create, edit, deactivate users and assign one of the predefined roles (admin, recepcionista, químico in Phase 1).
FR-3: Every screen and API enforces role-based access; unauthorized actions are blocked and logged.
FR-4: Password policy and account controls comply with NOM-024-SSA3 (complexity, no shared accounts).
FR-5: Admin manages the study catalog: code, name, area, sample type, container, method, technique, equipment, patient preconditions, processing days, price, tax flag, and per-study print options for the results PDF.
FR-6: Admin manages the analyte catalog: code, name, result type (numeric, text, calculated, image, document, referenced), unit, decimals, default value, and formula for calculated analytes.
FR-7: Referenced analytes support multiple reference ranges segmented by age range (days/weeks/years) and sex.
FR-8: Admin manages packages/profiles: a named group of studies sold at a package price, with its own preconditions and processing days.
FR-9: Admin manages supporting catalogs: methods, techniques, equipment (model, serial, calibration date), containers, sample types.
FR-10: Admin edits reference ranges inline from the analyte list; every change is recorded in the audit log with author and timestamp.
FR-11: Admin customizes the results PDF header: lab logo, name, address, phone, legal captions, responsible chemist signature.
FR-12: Reception creates patients with full name, birth date (age auto-calculated), sex, phone, email, optional CURP, address, optional photo.
FR-13: Patient search by name, phone, or order folio resolves in real time as the user types.
FR-14: Any field is editable; every edit is captured in the change log.
FR-15: Opening a patient with outstanding debt shows a prominent alert.
FR-16: Patient clinical history lists all results ordered by date, with a trend chart comparing repeated studies of the same type and out-of-range values flagged.
FR-17: A patient can be flagged "sample pending" (e.g., urine to be brought later); receiving the sample triggers the pending charge and routes the order to capture automatically.
FR-18: Reception creates an order by finding or creating the patient inline, assigning a referring doctor (mandatory — corrected 2026-07-31, see prd.md decision log), and adding studies via instant search by code or name.
FR-19: Each order line shows catalog price; the price is editable for that order only — the catalog is never modified from reception.
FR-20: Orders support a percentage discount and per-line price overrides, both audit-logged.
FR-21: An order accepts up to three payment methods (cash, card, transfer, credit) in any combination; partial payment generates a tracked debt.
FR-22: Saving an order generates a unique per-tenant folio, a unique QR token (immutable across edits), and prints three document sets: (1) sample container/tube labels — one per analyte/container required, barcode or QR matching the folio/analyte for later scan-matching against instrument output; (2) payment ticket; (3) work-order template.
FR-23: Orders carry patient observations (fasting, medications) and patient conditions, visible to the chemist during capture.
FR-24: Cash-session gating: no order can be created in a branch without an open cash session (see FR-46).
FR-25: CRUD for referring doctors: name, specialty, professional license (cédula), phone, email, workplace, active flag.
FR-26: Orders can be filtered and listed by referring doctor with a date filter.
FR-27: Chemist finds an order by folio, patient name, or date, and selects a study to capture.
FR-28: Capture supports all analyte types: numeric (with unit and range), text, calculated (formula evaluated automatically from captured analytes), image attachment (renders in PDF), rich-text document (renders in PDF), and referenced (range resolved by patient age/sex).
FR-29: Out-of-range values are highlighted automatically with a Normal/Low/High visual indicator. Values crossing critical (panic) thresholds — configurable per analyte — are flagged distinctly and require explicit acknowledgment by the validating chemist before validation completes.
FR-30: Tab-key navigation moves between analytes for rapid keyboard capture.
FR-31: Validating a study marks it validated, records validator and timestamp, and advances the order in the pipeline when all its studies are validated.
FR-32: A validated result can be invalidated only with a mandatory reason; invalidation and recapture are fully audit-logged.
FR-33: Chemist can preview the results PDF before validating.
FR-34: Study display order in the final PDF is adjustable.
FR-35: The capture list color-codes each study: pending / in progress / validated.
FR-74a: Live unidirectional equipment interfacing: results from the client's confirmed instruments (Mindray BC-5150 hematology, Mindray BS-240Pro chemistry) post automatically into the matching order/analyte via each instrument's native host interface the instant the instrument produces them — no CSV drop, no manual re-entry. Químico only completes analytes the instruments don't report. Scoped to these two named instruments only.
FR-36: A board shows all active orders in five columns: Reception → Sample received → In analysis → Validated → Delivered.
FR-37: Cards move by drag & drop; each card shows folio, patient, study chips, elapsed time, current responsible, and a color state.
FR-38: Time alerts: a card turns yellow after 45 minutes without advancing and red after 90 (thresholds fixed in Phase 1).
FR-39: The board filters by chemist and date and shows a live count per column.
FR-40: Clicking a card opens the full order detail.
FR-41: Delivery screen lists results filtered by date and state (ready, with debt, cancelled), color-coded: green ready, red debt/cancelled.
FR-42: Per result, staff can print the official PDF, email it (only when the patient consented to email delivery at registration — NFR-3), or hand it over — delivery is recorded with timestamp, channel, and user.
FR-43: Debt gating: a result with outstanding balance cannot be printed or delivered until settled, except by explicit admin override (audit-logged). Balance can be settled from the delivery screen with multiple payment methods.
FR-44: Patient portal: each order's QR/token resolves to `quimiaio.com/r/{token}` — a public page (no account) that requires the viewer to confirm the patient's date of birth before rendering patient name, date, studies, and results with indicators, plus PDF download. Token policy is configurable: single-use or time-expiring (24h / 7 days).
FR-45: Delivery history shows the patient's previous comparable results.
FR-46: A cash session must be opened (with initial fund, user, branch) before any order can be created that day in that branch.
FR-47: Every payment registers against the open session; manual in/out movements with a concept are supported.
FR-48: Closing produces a summary by payment method, theoretical vs counted totals, difference (over/short), per-seller detail, and a closing PDF.
FR-49: Historical sessions are queryable and exportable (PDF/Excel).
FR-50: Sales report by period (day/week/month/custom range) with totals by payment method and by seller, exportable to Excel/PDF.
FR-51: Dashboard shows today's KPIs: orders, revenue, pending results, delivered studies, a 7-day revenue chart, top-5 studies, a mini pipeline summary (order counts per Kanban column), and active alerts (debts, pending samples, time-critical orders), with quick actions (new order, capture, delivery).
FR-52: The system immutably records: result invalidations (with reason), order price changes and discounts, user creation/deactivation/deletion, cash session open/close, reference-range edits, admin debt overrides — each with actor, timestamp, and before/after values.
FR-53: Audit log is queryable by admin only, filtered by date and user.

**Phase 2 — inventoried, not decomposed this pass**

FR-60 [PHASE 2]: Tenant provisioning with guided onboarding.
FR-61 [PHASE 2]: Row-level tenant isolation across queries/reports/exports/portal links.
FR-62 [PHASE 2]: Subscription billing via Stripe (Reactivo/Clínico/Red) with enforced plan limits.
FR-63 [PHASE 2]: Public landing + app entry with published tier pricing.
FR-70 [PHASE 2]: Granular per-module permissions and `administracion`/`gerente` roles.
FR-71 [PHASE 2]: Quotations (create, send, retrieve, convert-to-order, auto-archive after 30 days).
FR-72 [PHASE 2]: WhatsApp (Twilio) automated + manual messaging.
FR-73 [PHASE 2]: Companies/convenios (credit, price lists, statements) and doctor commissions/statements.
FR-74b [PHASE 2]: Generalized equipment interfacing (CSV/HL7 fallback, per-brand driver onboarding, bidirectional host-query mode).
FR-75 [PHASE 2]: Attach external equipment PDFs to a result.
FR-76 [PHASE 2]: Full reporting/BI (by study, doctor, company, branch, seller, payment method; charts; multi-branch dashboard).
FR-77 [PHASE 2]: Reagent inventory (Red plan).
FR-78 [PHASE 2]: Altitude-adjusted reference ranges.
FR-79 [PHASE 2]: Configurable Kanban alert thresholds per lab.
FR-80 [PHASE 2]: Push notification when results are ready.
FR-81 [PHASE 2]: Digital received-signature on delivery (touch screen) — note: Phase 1 already ships a signature pad for in-person hand-off per EXPERIENCE.md; this FR extends it further in Phase 2 context (multi-branch/SaaS).
FR-82 [PHASE 2]: CFDI 4.0 invoicing add-on.
FR-83 [PHASE 2]: Critical-value escalation/notification via Phase 2 messaging channels.
FR-84 [PHASE 2]: Send-out (maquila/subrogación) management and Kanban representation.

### NonFunctional Requirements

NFR-1: Tenant isolation — every table carries `tenant_id`, RLS policies active from day one (single tenant in Phase 1; cross-tenant test suite and release-blocking enforcement added in Phase 2).
NFR-2: Compliance (NOM-024-SSA3) — RBAC, full audit traceability, periodic backups, password complexity are mandatory, not optional.
NFR-3: Privacy (LFPDPPP 2025) — privacy notice at registration, explicit consent, ARCO rights support, encryption in transit and at rest; retention-aware deletion handling.
NFR-4: Availability — target 99.5% business-hours availability with graceful offline degradation messaging.
NFR-5: Performance — search results perceived under 300ms; order creation under 2 minutes for a routine 3-study order; Kanban updates reflect within 5 seconds.
NFR-6: Mobile-first PWA — every screen usable on a phone; reception/delivery optimized for tablet/desktop, portal optimized for phone.
NFR-7: Auditability — audit records are append-only and immutable; no admin can edit or delete them.
NFR-8: Data durability — automated daily backups with tested restore; retention per NOM-007/NOM-024.
NFR-9: Language — UI in Spanish (Mexico); all monetary values in MXN.

### Additional Requirements

Extracted from `ARCHITECTURE-SPINE.md` — technical/infrastructure requirements that shape epic and story boundaries:

- **No scaffolding starter template.** Epic 1 Story 1 begins from a greenfield Next.js App Router setup per the Stack table (Next.js `>=16.2.11`, TypeScript 6.x strict, Tailwind v4 + shadcn/ui, Prisma 7.x + `adapter-pg`, Better Auth, Neon), not a pre-built CLI starter.
- **Vertical-slice modular monolith (AD-1).** Every domain module (`auth`, `patients`, `orders`, `catalog`, `results-capture`, `equipment-interfacing`, `cash`, `doctors`, `delivery`, `audit`, `kanban`) is a top-level slice under `src/modules/<name>/`; cross-module access only through an explicit interface — never direct Prisma model access into another module. This is a structural constraint on every epic that touches more than one module.
- **Database access (AD-2, AD-3).** PostgreSQL hosted on Neon with `FORCE ROW LEVEL SECURITY`; app connects as a non-owner role, a separate migration/owner role owns the schema. The *only* DB access path is one Prisma Client Extension wrapper (`src/shared/db`) with two modes — scoped (default, `SET LOCAL app.tenant_id`/`app.role`) and bootstrap (tenant resolution at login, portal-token, or instrument-API-key lookup, immediately followed by a scoped transaction). Direct `prisma.<model>` calls outside the wrapper are forbidden.
- **Core schema corrections (AD-4).** `Order.folio` — composite unique on `(tenantId, folio)`, not global. `Result.source` enum (`MANUAL`/`INSTRUMENT`). `OrderItem.status` — stored `ItemStatus` enum (6 values: recepcion, muestra_recibida, en_analisis, validado, entregado, cancelado); Kanban column = least-advanced value across order items. `Result` is mutable; every mutation writes a paired `AuditLog` entry in the same transaction (one wrapper call, e.g. `updateResult()`).
- **Equipment-interfacing infrastructure (AD-5, AD-7).** A separate on-site Node 24 agent process per instrument (BC-5150, BS-240Pro), installed on the client's existing per-instrument PCs (`agents/mindray-agent/`, not deployed with the Next.js app). Agents authenticate to the cloud ingestion API via per-instrument API key + HMAC request signing (body + timestamp) — never bare bearer tokens or mTLS. The Vercel app never opens or holds a device connection; agents only push outbound HTTPS.
- **Equipment-interfacing integration boundary (AD-6).** `equipment-interfacing` resolves `Order` by `(tenantId from API key, folio)`, validates the analyte against the order's requested `Study`, then calls `results-capture`'s `recordInstrumentResult(orderItemId, analyteId, value)` — it never writes `Result` directly. Per-`(orderItemId, analyteId)` upsert, not batch replace.
- **Auth (AD-8).** Better Auth is the sole session/role provider; no module re-implements password-policy checks.
- **Environments (AD-9).** dev (local) → preview (Vercel preview deploy + ephemeral Neon branch per PR) → production (Vercel prod + Neon main). Equipment agents run only in production against real hardware; dev/preview use simulated HL7/ASTM messages.
- **Audit-log write path (AD-10).** All `AuditLog` writes go through the same wrapper entrypoint as AD-3; the app's DB role holds no UPDATE/DELETE grant on `AuditLog` (enforced at the Postgres privilege level). Minimum shape: `id, tenantId, entity, entityId, action, before, after, actorUserId, createdAt`.
- **Real-time updates (AD-11).** Kanban/dashboard live views use one shared SWR polling hook (4-second interval) — no WebSocket/SSE anywhere in Phase 1.
- **Backup/restore (AD-12).** Rely on Neon's built-in continuous backup/PITR; add a documented quarterly restore-drill as an operational task, not custom tooling. Open question flagged by the spine: Neon's PITR window (days-to-weeks) vs. NOM-007/NOM-024's possible multi-year retention obligation — no long-term archival mechanism decided yet.
- **Catalog attribute needed for FR-22.** `Study` needs a `tubeType`/`tubeColor` catalog attribute (e.g. amarillo/lila/rojo) to drive how many container labels print and in which color — catalog data, not a new entity.
- **Branch is Phase 1.** Exactly one `Branch` row auto-seeded per tenant at signup; `branchId` modeled on `Order`/`User`/`CashSession` from day one (avoids a week-5-vs-week-13 migration collision with Caja/FR-46).
- **Deferred to each module's own SPEC→SCHEMA time (not decided at spine level, but each module owning these needs to draft them during story/schema work):** `Doctor`, `CashSession`/Caja, `AuditLog`, `User.roleId`/`Role` (RBAC) models; `Study`'s dangling catalog FKs (`sampleTypeId`, `methodId`, `techniqueId`, `equipmentId`); `OrderItem.status` enum values (already fixed by AD-4/UX, listed here for schema-authoring awareness).
- **Open technical risk carried into implementation.** BS-240Pro's exact protocol/transport (HL7 v2.3.1 vs ASTM E1394-97, TCP vs RS-232 serial) is unconfirmed — must be verified against the client's actual host-interface manual (or Mindray directly) before driver work starts for that instrument. BC-5150's protocol (HL7) is already confirmed.
- **Consistency conventions binding every module.** Prisma models PascalCase singular, fields camelCase, API routes kebab-case, domain events `module.action`. IDs = cuid2. Dates ISO-8601 UTC in DB, localized to Mexico time only at presentation. API errors: single envelope `{ error: { code, message, details? } }`. Structured JSON logging carries `tenant_id`/`request_id` on every line. Zod validates typed env config and every API request/response payload.
- **Observability default.** Vercel-native logs for Phase 1; no APM/error-tracking dependency added upfront (Sentry only if proven insufficient later).

### UX Design Requirements

Extracted from `EXPERIENCE.md` — actionable, story-ready UX work (Phase 1 unless flagged):

UX-DR1: **Evidence gallery** component for image-type analytes — in-app crop tool over uploaded PDF/image (no external screenshot step), 2–3 preset crop sizes matched to report column width, a *list* of evidence items per analyte (not single image) each with an optional caption, drag-reorderable (print order follows gallery order), live report-accurate preview, keyboard equivalent (Tab to focus, Ctrl+↑/Ctrl+↓ to reorder).
UX-DR2: **Constrained document editor** for document-type analytes — WYSIWYG limited to bold/italic/lists/headings only (matches what the PDF template can render), renders at the same font/column width as the final PDF, includes a snippet/phrase picker for common interpretation text.
UX-DR3: **Study reorder** drag-and-drop at the order level (list of studies, not evidence within one study) — same gesture and keyboard equivalent as the evidence gallery (Ctrl+↑/Ctrl+↓).
UX-DR4: **Correction history popover** — inline icon per analyte field opens a popover scoped to that analyte's own change history (who/when/before/after); complements, does not replace, the system-wide Auditoría/Bitácora log.
UX-DR5: **Reference range annotation** — numeric reference range always rendered next to/below every analyte's entered value (e.g. "14.2 g/dL (12.0–15.5)"), regardless of in/out-of-range state; never hidden behind hover/click.
UX-DR6: **Analyte source tag** — pill next to the analyte label: `Automático` (instrument-posted), `Calculado` (derived), no tag at all for manual entries (absence = manual signal). Field remains editable even when auto-tagged; correcting it writes the same correction-history record as a manual change.
UX-DR7: **Order print-preview panel** on Guardar — compact overlay listing exactly what's about to print: one container/tube label per required label (showing study/analyte + catalog tube color), the payment ticket, and the work-order template; user confirms to print all three or cancels to fix something first. Replaces silent single-ticket auto-print.
UX-DR8: **Signature pad** (Firma de recibido digital) for in-person delivery hand-off — touch/stylus input, "Borrar/Reintentar" control, signature stored with timestamp tied to the order/folio; applies only to in-person hand-off, not print/email/WhatsApp channels.
UX-DR9: **Kanban card** — five states only, aging communicated via color ring *and* a co-located text timestamp (never color alone); draggable only as a correction/override (never normal advancement), every manual drag writes its own audit-log entry; shows an inline note when the order has a logged result correction (e.g. "↺ 1 corrección registrada — TSH").
UX-DR10: **Pipeline state machine** — automatic advancement only, driven by business events (sample receipt, full-order validation, delivery recorded); per-study validation with the order's Kanban column reflecting the *least-advanced* study; Guardar = internal draft (never patient-visible); Validar = only action that can make a study patient-visible, and only once paid; calculated-analyte recalculation on a corrected input auto-invalidates the containing study, forcing re-validation.
UX-DR11: **Debt-gate behavior** — patient record with outstanding debt shows a prominent alert; delivery (print/email/WhatsApp/hand-off) blocked while unsettled except via an audit-logged admin override; patient portal enforces the same gate independently (paid AND validated both required, checked per study).
UX-DR12: **Critical-value acknowledgment gate** — a result crossing a configurable panic threshold blocks study validation until the validating chemist performs an explicit acknowledgment (not a passive dismiss); while blocked, other analyte rows dim and the blocking row is highlighted.
UX-DR13: **Offline/connectivity handling (PWA floor)** — Captura/Recepción keep locally-entered data on connectivity loss and show a persistent "Sin conexión — no se ha guardado" banner blocking Guardar/Validar until reconnected; read-only surfaces (Dashboard, loaded lists) show a "Última actualización hace X" indicator instead of blocking.
UX-DR14: **Empty/cold-load states** — Dashboard with zero orders today shows KPI cards at 0 with an encouraging empty-pipeline message; Pacientes search with no results shows an inline "crear paciente nuevo" shortcut.
UX-DR15: **Patient portal token policy** — 7-day expiring token per order (Phase 1 default, not single-use/not 24h); DOB confirmation gate before any clinical content renders; expired link shows "Enlace expirado" with no clinical content; DOB mismatch shows a neutral "no coincide" message with no attempt count or hint (fails closed, never leaks token validity).
UX-DR16: **Cash session (Caja) state** — one active session per branch per calendar day; lazily triggered by whichever user is first to register a patient/order at that branch that day; shift labels (matutino/vespertino/nocturno) are display metadata only, never gating; corte de caja is a user-initiated action available any time.
UX-DR17: **Keyboard-first capture and reception** — Tab-order moves through analyte fields top-to-bottom matching the printed report's reading order (Captura) and through the full order-entry flow end to end (Recepción); this is a hard requirement, not an enhancement.
UX-DR18: **Instant/fuzzy search** — patient search (name/phone/folio) and study search in order composition resolve perceived-instantly (<300ms), no explicit search/submit button.
UX-DR19: **Dashboard quick actions** render as a live-styled preview of the Recepción intake form (pre-focused on its first field) beside "Órdenes recientes" — not a menu of buttons.
UX-DR20: **App shell** — dark-chrome sidebar (always visible desktop/tablet, off-canvas drawer on phone); topbar carries the Caja status chip and (Phase 2) branch switcher as session-scoped state, distinct from sidebar navigation.
UX-DR21: **Responsive behavior per breakpoint** — desktop/laptop: full sidebar+topbar, multi-column layouts. Tablet: sidebar collapses to icons, content reflows to fewer columns, same components. Phone: off-canvas drawer, Dashboard KPI row collapses to 2-column grid, Kanban board becomes stacked/tab view. Patient portal: single-column, chrome-free (no sidebar/topbar) at all breakpoints.
UX-DR22: **Voice and tone / content standard** — all UI copy in Spanish (Mexico), all monetary values in MXN, professional/trustworthy tone (never playful) per the Do/Don't table; pipeline-state names must match the Kanban column labels verbatim everywhere they appear (table pills, filters, notifications).
UX-DR23: **Accessibility floor (WCAG 2.1 AA)** — every mouse-reachable action has a keyboard path; one consistent visible focus-ring treatment app-wide; RBAC-disabled actions show visibly-disabled-with-reason (never silently do nothing); drag-and-drop (evidence gallery, study reorder) has a full keyboard equivalent (Tab + Ctrl+↑/↓); Kanban card aging/critical state is announced via `aria-label`, not color alone, and status pills always carry text labels.
UX-DR24 [PHASE 2]: **Permission matrix** — module-grouped role editor (not a flat grid), ~2–4 action toggles nested per module header, bulk "select all" per module.
UX-DR25 [PHASE 2]: **Branch switcher** — topbar dropdown ("Viendo: Sucursal X ▾"), includes a "Todas las sucursales" consolidated view option; switching branch does not log the user out, each branch's Caja state is independent.

### Order Lifecycle — Canonical State Map

Every epic that reads or transitions order state must use this exact mapping — no epic invents its own vocabulary for the same `OrderItem.status` (AD-4) enum. Found during final review (Party Mode, Sally): the enum's sixth value, `cancelado`, had no story establishing its transition — closed below via Story 6.6.

| Enum (`OrderItem.status`) | UI label | Established by | Trigger |
|---|---|---|---|
| `recepcion` | Recepción | Story 6.1 | Order created, Caja gate passed |
| `muestra_recibida` | Muestra recibida | Story 6.5 | Sample physically received (or immediate, if none pending) |
| `en_analisis` | En análisis | Story 7.1 | Any study on the order unvalidated |
| `validado` | Validado | Story 7.4 | All studies on the order validated |
| `entregado` | Entregado | Story 9.2 | Delivery recorded |
| `cancelado` | Cancelado | Story 6.6 | Admin cancels the order with mandatory reason |

### FR Coverage Map

FR-1: Epic 1 - Sign-in
FR-2: Epic 1 - User CRUD + role assignment
FR-3: Epic 1 - RBAC enforcement (screen + API)
FR-4: Epic 1 - Password policy (NOM-024-SSA3)
FR-5: Epic 2 - Study catalog
FR-6: Epic 2 - Analyte catalog
FR-7: Epic 2 - Reference ranges by age/sex
FR-8: Epic 2 - Packages/profiles
FR-9: Epic 2 - Supporting catalogs (methods, techniques, equipment, containers, sample types)
FR-10: Epic 2 - Inline reference-range edit + audit
FR-11: Epic 2 - Results PDF header customization
FR-12: Epic 3 - Patient creation
FR-13: Epic 3 - Patient instant search
FR-14: Epic 3 - Patient edit + change log
FR-15: Epic 3 - Debt alert on patient record
FR-16: Epic 3 - Clinical history + trend chart
FR-17: Epic 6 - Sample-pending flag (moved from Epic 3 — the flag lives on Order/OrderItem, which doesn't exist until Epic 6; "muestra pendiente" maps directly onto AD-4's `muestra_recibida` OrderItem.status value)
FR-25: Epic 4 - Doctor CRUD
FR-26: Epic 4 - Orders filtered by doctor
FR-46: Epic 5 - Cash session open
FR-47: Epic 5 - Payment registration against session
FR-48: Epic 5 - Cash session close + summary
FR-49: Epic 5 - Historical sessions query/export
FR-18: Epic 6 - Order creation (patient + mandatory doctor + studies)
FR-19: Epic 6 - Order-line editable price
FR-20: Epic 6 - Discounts + price overrides (audit-logged)
FR-21: Epic 6 - Multi-method payment + tracked debt
FR-22: Epic 6 - Folio, QR token, 3-document print
FR-23: Epic 6 - Patient observations/conditions on order
FR-24: Epic 6 - Cash-session gating
FR-27: Epic 7 - Order/study lookup for capture
FR-28: Epic 7 - All analyte types captured
FR-29: Epic 7 - Out-of-range + critical-value acknowledgment
FR-30: Epic 7 - Tab-key navigation
FR-31: Epic 7 - Study validation + pipeline advance (the single "Validado" gate — manual or instrument-sourced analytes both pass through it)
FR-32: Epic 7 - Invalidate with mandatory reason
FR-33: Epic 7 - Results PDF preview
FR-34: Epic 7 - Adjustable study print order
FR-35: Epic 7 - Capture list color-coding
FR-36: Epic 8 - 5-column Kanban board
FR-37: Epic 8 - Card drag & drop + card content
FR-38: Epic 8 - Aging time alerts (45/90 min)
FR-39: Epic 8 - Board filters + live column counts
FR-40: Epic 8 - Card click opens order detail
FR-41: Epic 9 - Delivery list filtered by date/state
FR-42: Epic 9 - Print/email/hand-over + delivery record
FR-43: Epic 9 - Debt gating + admin override
FR-44: Epic 9 - Patient portal (QR/token, DOB gate)
FR-45: Epic 9 - Delivery history of comparable results
FR-50: Epic 10 - Sales report by period
FR-51: Epic 10 - Dashboard KPIs
FR-52: Epic 11 - Immutable audit recording (cross-cutting write path; see note)
FR-53: Epic 11 - Audit log admin viewer

FR-74a: Epic 7b - Live Mindray equipment interfacing (moved out of Epic 7; see Epic 7b below)

## Epic List

**Epic nature key** (per panel review — John flagged that not every epic delivers something an end user would actually want to touch): most epics below deliver genuine end-user value on their own. A few are **foundation/prerequisite** epics — they exist so a later epic can function, not because a lab worker has a job-to-be-done that ends at "load a catalog." Each epic is tagged below so this isn't left implicit.

### Epic 1: Foundation — Authentication, Roles, App Shell & Data-Access Infrastructure
Staff can sign in, admins manage users and role assignments, every screen/API enforces RBAC, and the base app shell (sidebar/topbar, responsive breakpoints) exists for every later epic to build inside. This epic also delivers the two pieces of cross-cutting infrastructure every subsequent module depends on — built once, here, not left as a floating convention each dev reinvents per module (per panel consensus, Winston):
- **The single Prisma Client wrapper** (`src/shared/db`) with its scoped mode (`SET LOCAL app.tenant_id`/`app.role`) and bootstrap mode, plus Neon RLS with `FORCE ROW LEVEL SECURITY` and the non-owner app role — as a working, testable entrypoint, not a principle.
- **The audit-log write path** — the `AuditLog` table (minimum shape: `id, tenantId, entity, entityId, action, before, after, actorUserId, createdAt`), the wrapper's single write entrypoint, and the Postgres-level revoke of UPDATE/DELETE on that table — built and demonstrably immutable before any other epic's stories claim "writes to audit log" as an acceptance criterion.
**FRs covered:** FR-1, FR-2, FR-3, FR-4
**Also carries:** UX-DR20 (app shell), UX-DR21 (responsive breakpoints), UX-DR23 (accessibility floor baseline), AD-2/AD-3 (Prisma wrapper, RLS), AD-8 (Better Auth), AD-10 (audit-log privilege model), NFR-1 (tenant isolation), NFR-2 (password policy), NFR-6 (PWA/mobile-first shell), NFR-7 (audit immutability)

### Epic 2: Lab Configuration Catalogs — [Foundation/prerequisite, not end-user value]
Admin fully configures the lab's operating data — studies, analytes with reference ranges, packages, supporting catalogs, and the results-PDF header — before any patient-facing work begins. **Honest framing (per John):** no lab role has a job-to-be-done that's satisfied by "loading a catalog" — nobody logs in on a Monday wanting to configure a study list. This epic's output is a *prerequisite delivered*, not *value delivered*; the value only becomes real once Epic 6 (Orders) consumes this data to sell and process a real study.
**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11
**Also carries:** `tubeType`/`tubeColor` catalog attribute (Additional Requirements, needed by Epic 6's label printing), NFR-9 (Spanish/MXN content)

### Epic 3: Patient Management
Reception registers, searches, and edits patients, and sees debt alerts and clinical history with trend charts.
**FRs covered:** FR-12, FR-13, FR-14, FR-15, FR-16
**Also carries:** UX-DR14 (empty/no-results state), UX-DR18 (instant search), UX-DR17 (keyboard-first entry)
**Note:** FR-17 (sample-pending flag) moved to Epic 6 — corrected during story-writing (2026-08-02). The flag lives on Order/OrderItem, which doesn't exist as an entity until Epic 6; it wasn't buildable here without pulling Epic 6 forward.

### Epic 4: Referring Doctors — [Foundation/prerequisite, not end-user value]
Admin manages the referring-doctor directory; every order (Epic 6) requires one assigned at creation, and orders can be filtered/listed by doctor. **Honest framing (per John):** same category as Epic 2 — CRUD on master data is not a job a lab role wakes up wanting to do. It's a *prerequisite delivered*: the real value shows up only once Epic 6 can assign a doctor to a real order.
**FRs covered:** FR-25, FR-26
**Note:** hard prerequisite of Epic 6, not optional — corrected 2026-07-31 (FR-18 originally read "optionally assigning a referring doctor"; the product owner confirmed it's mandatory in real operation, a capture error in the original PRD, not a deliberate scope choice). Epic 6 cannot be demoed — an order cannot be created at all — until at least one doctor record exists.

### Epic 5: Cash Sessions (Caja)
Staff open a per-branch cash session, register manual movements, close it with a reconciled summary, and query/export historical sessions.
**FRs covered:** FR-46, FR-47, FR-48, FR-49
**Also carries:** UX-DR16 (lazy per-branch-per-day session trigger, shift labels as display metadata only)
**Note:** must ship before/alongside Epic 6 — FR-24's cash-session gate is a hard prerequisite for order creation.

### Epic 6: Order Creation & Reception Workflow
Reception creates a complete order — patient, a mandatory referring doctor, studies with editable pricing/discounts, multi-method payment — gated by an open cash session; saving prints the three required documents; a patient can be flagged sample-pending, and receiving the sample triggers its charge and routes it to capture; an Admin can cancel an order with mandatory reason.
**FRs covered:** FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-17
**Also carries:** UX-DR7 (order print-preview panel), UX-DR17 (keyboard-first reception), UX-DR18 (instant study/patient search), UX-DR13 (offline banner on Recepción), AD-4 (folio composite-unique, `muestra_recibida`/`cancelado` OrderItem.status), AD-6 (folio as the equipment-matching key, consumed by Epic 7)
**Note:** absorbed FR-17 from Epic 3 (2026-08-02) — the sample-pending flag lives on Order/OrderItem. Story 6.6 (order cancellation) added during final Party Mode review — closes AD-4's previously-unused `cancelado` enum value, which FR-41 already assumes exists without any story establishing how an order reaches it.

### Epic 7: Results Capture & Validation
The chemist captures every analyte type — manual entry for studies with no attached instrument, and instrument-fed analytes once Epic 7b exists — and every study, regardless of source, passes through the same single "Validado" gate before it counts as done. Validating is the one event that both closes the study and makes it visible to the paying patient. This epic is fully functional and demoable end-to-end on 100% manual data — it does not depend on Epic 7b, and (per the entry-point AC below) it does not depend on Epic 8 either.
**Entry-point AC (per panel review — Sally):** the chemist's real entry point to this whole epic is "which sample do I capture next," and that answer normally comes from the Kanban board (Epic 8), which doesn't exist yet at this point in the build. Without a real entry surface, this epic would get demoed through an improvised, unspecified stopgap — the kind of ad-hoc UX nobody actually designed or reviewed. So this epic's own scope explicitly includes a **minimal "muestras pendientes de captura" list**: a plain sortable list with status (no drag-and-drop, no WIP limits, none of Epic 8's Kanban card rules) that lets the chemist find and open an order/study to capture. Epic 8 does not bolt something new on top of this later — it *replaces* this list outright with the full visual board, same as any other UI evolving from a simple first pass toward its final spec. Critical-value acknowledgment and the correction-history popover are captura-screen interactions, not board interactions — they fire on save/validate, never on a card move (that distinction stays exclusively Epic 8's).
**FRs covered:** FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-35
**Also carries:** UX-DR1 (evidence gallery), UX-DR2 (document editor), UX-DR3 (study reorder), UX-DR4 (correction-history popover), UX-DR5 (reference-range annotation), UX-DR6 (analyte source tag — the field this epic exposes for Epic 7b to populate later), UX-DR10 (pipeline/validation state machine — capture half), UX-DR12 (critical-value acknowledgment gate), UX-DR13 (offline banner on Captura), UX-DR17 (keyboard-first capture); AD-4 (`Result.source` enum, `OrderItem.status`, mutable `Result` + paired `AuditLog` in the same transaction — the Validado action is the regulatory/audit-significant event and the portal-visibility trigger, so its audit write and its paid-gate check are both hard requirements of this epic, not optional polish).

### Epic 7b: Equipment Interfacing — Mindray Agents
The two named Mindray instruments (BC-5150 hematology, BS-240Pro chemistry) push results automatically into the matching order/analyte via their own on-site agent process, landing in the exact same `Result` table Epic 7 already validates from — this epic never owns validation, it only populates data upstream of it.
**FRs covered:** FR-74a
**Sequencing (per panel consensus — John/Amelia/Winston):** split from Epic 7 because it carries a genuinely different risk profile — a separate deployable (on-site Node 24 agent, HMAC-signed, `agents/mindray-agent/`) against hardware, not application logic. Story order within this epic: **(1) BC-5150 first** — protocol confirmed (HL7 per Mindray's own manual), plannable with certainty; **(2) BS-240Pro as an explicit isolated spike story** — protocol/transport unconfirmed (HL7 v2.3.1 vs ASTM E1394-97, TCP vs RS-232), investigated and time-boxed before any implementation AC is committed. If BS-240Pro's protocol proves too costly, that instrument's studies fall back to Epic 7's manual capture — the lab is never without a working system.
**Also carries:** AD-5 (on-site agent, no cloud-held device connection), AD-6 (calls Epic 7's `recordInstrumentResult(orderItemId, analyteId, value)` interface — never writes `Result` directly, per-`(orderItemId, analyteId)` upsert), AD-7 (per-instrument API key + HMAC signing), AD-9 (agents run only in production; dev/preview use simulated HL7/ASTM messages).
**Note:** does not gate Epic 8/9/10 — Kanban, Delivery, and Dashboard all consume validated `Result` rows regardless of whether they arrived via Epic 7's manual entry or this epic's agents.

### Epic 8: Pipeline Kanban
Staff see every active order on a 5-column board with drag/drop correction, aging alerts, filters, and live counts.
**FRs covered:** FR-36, FR-37, FR-38, FR-39, FR-40
**Also carries:** UX-DR9 (Kanban card rules), UX-DR10 (state machine — board half), AD-11 (SWR polling every 4s), NFR-5 (5-second update SLA)

### Epic 9: Delivery & Patient Portal
Staff deliver results (print/email/hand-off) with debt gating and digital signature capture, and patients/doctors view results independently through the DOB-gated portal link.
**FRs covered:** FR-41, FR-42, FR-43, FR-44, FR-45
**Also carries:** UX-DR8 (signature pad), UX-DR11 (debt gate, portal-side independent check), UX-DR15 (portal token policy, 7-day expiry), UX-DR21 (portal responsive — chrome-free single column)

### Epic 10: Dashboard & Basic Reports
Admin/reception see today's KPIs, a 7-day revenue trend, top studies, and a mini pipeline summary on login, plus exportable sales reports by period.
**FRs covered:** FR-50, FR-51
**Also carries:** UX-DR19 (dashboard quick-actions as live intake-form preview), UX-DR14 (zero-orders empty state)
**Note:** aggregates data written by Epics 5, 6, 7, 8 — ships last among the operational epics by necessity.

### Epic 11: Audit Log
Admin reviews the immutable, filterable log of every regulated event (invalidations, price changes, user lifecycle, cash open/close, reference-range edits, admin overrides).
**FRs covered:** FR-52, FR-53
**Also carries:** AD-10 (single write path, no UPDATE/DELETE grant), NFR-7 (immutability)
**Note:** FR-52's *writing* of audit entries is cross-cutting — each triggering event (Epics 1–9) must include "writes an AuditLog row via the shared wrapper" as an acceptance criterion in its own stories. This epic delivers the admin-facing *viewer* (FR-53) and the immutable storage guarantee (AD-10), which needs entries from prior epics to be meaningfully demoed.

**Cross-cutting requirements not broken into their own epic** (apply as acceptance criteria within every epic's stories instead): NFR-1 (tenant isolation/RLS on every table), NFR-3 (privacy notice/consent/ARCO), NFR-4 (availability/offline messaging), NFR-6 (mobile-first PWA on every screen), NFR-8 (backup/restore), NFR-9 (Spanish/MXN), UX-DR22 (voice & tone), UX-DR23 (accessibility floor), AD-1/AD-2/AD-3 (vertical-slice boundaries, Neon RLS, single Prisma wrapper) — these are structural rules every module-owning epic must satisfy, not user-facing epics of their own.

**Phase 2 epics (FR-60–84 family) are out of scope for this decomposition** — see Requirements Inventory above for the full list; they will be decomposed in a future run once Phase 2 architecture exists.

---

## Epic 1: Foundation — Authentication, Roles, App Shell & Data-Access Infrastructure

Staff can sign in, admins manage users and role assignments, every screen/API enforces RBAC, and the base app shell exists for every later epic to build inside. Cross-cutting infrastructure (the tenant-scoped Prisma/RLS wrapper and the immutable audit-log write path) is demonstrated end-to-end here, inside real user-facing stories, rather than as standalone infra tickets.

### Story 1.1: User Sign-In

As a lab staff member (admin/recepcionista/químico),
I want to sign in with my nickname/email and password,
So that I can access only my tenant's data through a secure, tenant-scoped session.

**Acceptance Criteria:**

**Given** a valid nickname/email + password for an active user
**When** I submit the sign-in form
**Then** I'm authenticated via Better Auth and a tenant-scoped session begins
**And** the Prisma wrapper's bootstrap mode resolves `tenantId` from an RLS-exempt, narrowly-scoped lookup before any scoped transaction opens (AD-3)

**Given** my session is established
**When** any subsequent request runs
**Then** the wrapper's scoped mode opens the transaction with `SET LOCAL app.tenant_id`/`app.role`, and Postgres RLS restricts every query to my tenant

**Given** an invalid password or inactive account
**When** I submit sign-in
**Then** I see a generic authentication-failed message with no hint about which part was wrong

### Story 1.2: Admin Manages Users & Roles

As an Admin,
I want to create, edit, and deactivate users and assign one of the predefined roles (admin, recepcionista, químico),
So that I control who can access the system and what they can do.

**Acceptance Criteria:**

**Given** I am an Admin
**When** I create a new user with a role
**Then** the user is created tenant-scoped with that role and can sign in

**Given** I deactivate a user
**When** they attempt to sign in
**Then** access is denied

**Given** I edit a user's role
**When** I save
**Then** their permissions change on their next request
**And** every one of these actions writes an `AuditLog` row (actor, timestamp, before/after) through the shared wrapper's single write path (AD-10) — the first end-to-end demonstration of the audit infrastructure in the project

**Given** a non-Admin attempts any of these actions via direct API call
**When** the request arrives
**Then** it is rejected and the attempt itself is logged (FR-3)

### Story 1.3: Role-Based Access Control Enforced Everywhere

As any authenticated user,
I want every screen and API endpoint to enforce my role's permissions,
So that I can never see or do something outside my role, whether through the UI or by hitting an API directly.

**Acceptance Criteria:**

**Given** my role doesn't permit an action (e.g., Recepcionista attempting to validate a study)
**When** the UI renders that action
**Then** it appears visibly disabled with a stated reason — never silently inert (UX-DR23)

**Given** my role doesn't permit an action
**When** I call the underlying API directly
**Then** the server rejects the request independent of what the UI shows
**And** the blocked attempt writes its own `AuditLog` entry (FR-3)

### Story 1.4: Password Policy Enforcement (NOM-024-SSA3)

As an Admin,
I want password complexity enforced on every account,
So that the system complies with NOM-024-SSA3 and no account can be created with a weak password.

**Acceptance Criteria:**

**Given** a new user is created or resets their password
**When** the password is submitted
**Then** it must meet Better Auth's configured complexity policy (minimum length, character-class mix) or the action is rejected with a specific reason

**Given** repeated failed sign-in attempts on one account
**When** a configurable threshold is crossed
**Then** the account is temporarily locked and the lockout event is audit-logged

### Story 1.5: Base App Shell & Responsive Layout

As any authenticated user,
I want a consistent app shell that adapts to my device,
So that I can use Quimia IO comfortably on desktop, tablet, or phone.

**Acceptance Criteria:**

**Given** I'm on desktop/tablet
**When** I load any authenticated screen
**Then** I see the dark-chrome sidebar (always visible) and topbar, showing only nav items my role permits

**Given** I'm on a phone
**When** I load any authenticated screen
**Then** the sidebar collapses to an off-canvas drawer triggered from a compact top bar
**And** one consistent, always-visible focus-ring treatment applies across every interactive element (WCAG 2.1 AA baseline, UX-DR23)

---

## Epic 2: Lab Configuration Catalogs — [Foundation/prerequisite, not end-user value]

Admin fully configures the lab's operating data before any patient-facing work begins. Stories are ordered so each depends only on a strictly earlier story: supporting catalogs first, then Study (which references them), then Analyte + reference ranges, then Packages (which references Studies), then the PDF header (independent).

### Story 2.1: Supporting Catalogs — Methods, Techniques, Equipment, Containers, Sample Types

As an Admin,
I want to manage the lab's supporting catalogs (methods, techniques, equipment, containers, sample types),
So that Study definitions can reference validated values instead of free text.

**Acceptance Criteria:**

**Given** I am an Admin
**When** I create/edit/deactivate an entry in any of the five supporting catalogs
**Then** it becomes available for Study to reference
**And** Equipment entries store model, serial number, and calibration date

### Story 2.2: Study Catalog

As an Admin,
I want to define studies with their full operational attributes (code, name, area, sample type, container, method, technique, equipment, patient preconditions, processing days, price, tax flag, print options, and tube type/color),
So that reception and results-capture operate against accurate, complete study definitions.

**Acceptance Criteria:**

**Given** the supporting catalogs from Story 2.1 exist
**When** I create a study
**Then** I select its sample type, container, method, technique, and equipment from those catalogs (no free text)
**And** I set a tube type/color for the study (e.g., amarillo/lila/rojo) — this drives Epic 6's container-label printing later

**Given** I set price and tax flag
**When** I save
**Then** the study becomes sellable in Orders (Epic 6)

### Story 2.3: Analyte Catalog, Including Calculated Formulas

As an Admin,
I want to define analytes with their result type (numeric, text, calculated, image, document, referenced), unit, decimals, default value, and formula for calculated analytes,
So that results-capture renders the correct input control per analyte.

**Acceptance Criteria:**

**Given** I create a numeric analyte
**When** I save it
**Then** it stores unit and decimal precision

**Given** I create a calculated analyte
**When** I enter a formula referencing other analyte codes
**Then** the formula is validated against existing analyte codes at save time (evaluation itself happens in Epic 7's capture screen, not here)

### Story 2.4: Reference Ranges by Age & Sex, with Inline Edit + Audit

As an Admin,
I want to define multiple reference ranges per analyte segmented by age (days/weeks/years) and sex, and edit them inline from the analyte list,
So that results-capture resolves the correct range automatically and every change is traceable.

**Acceptance Criteria:**

**Given** a referenced-type analyte
**When** I add reference ranges for different age brackets and sexes
**Then** all ranges are stored and queryable by age+sex

**Given** I edit a range inline from the analyte list
**When** I save
**Then** an `AuditLog` entry records author, timestamp, and before/after values (FR-10) — a second, domain-specific demonstration of the audit path, distinct from Epic 1's generic one

### Story 2.5: Packages/Profiles

As an Admin,
I want to bundle existing studies into a named package sold at its own price, with its own preconditions and processing days,
So that common study combinations can be sold as one line item.

**Acceptance Criteria:**

**Given** at least two studies already exist (Story 2.2)
**When** I create a package referencing them at a package price
**Then** it becomes sellable as a single item in Orders (Epic 6)

### Story 2.6: Results PDF Header Customization

As an Admin,
I want to customize the results PDF header (logo, lab name, address, phone, legal captions, responsible-chemist signature),
So that every printed report carries the lab's own branding and required legal text.

**Acceptance Criteria:**

**Given** I upload a logo and fill in the header fields
**When** I save
**Then** a preview shows the header exactly as it will render in the final results PDF (Epic 7 consumes this)

---

## Epic 3: Patient Management

Reception registers, searches, and edits patients, and sees debt alerts and clinical history with trend charts. (FR-17, originally scoped here, moved to Epic 6 during story-writing — see note in Epic List.)

### Story 3.1: Patient Registration

As a Recepcionista,
I want to register a new patient with full name, birth date (age auto-calculated), sex, phone, email, optional CURP, address, and optional photo,
So that I can create orders for them.

**Acceptance Criteria:**

**Given** I fill in the required fields
**When** I save
**Then** the patient is created with age auto-computed from birth date
**And** CURP and photo remain optional

### Story 3.2: Instant Patient Search

As a Recepcionista,
I want to search patients by name, phone, or order folio as I type,
So that I can find existing patients instantly instead of re-registering them.

**Acceptance Criteria:**

**Given** I type into the search field
**When** results are computed
**Then** matches render in under 300ms (NFR-5)

**Given** no patient matches
**When** the empty state renders
**Then** an inline "crear paciente nuevo" shortcut appears (UX-DR14)

### Story 3.3: Edit Patient with Change Log

As a Recepcionista or Admin,
I want to edit any patient field,
So that I can correct or update information, with every edit tracked.

**Acceptance Criteria:**

**Given** I edit any field
**When** I save
**Then** a change-log entry records who/when/before/after — the same audit mechanism from Epic 1, now applied to Patient

### Story 3.4: Debt Alert on Patient Record

As a Recepcionista,
I want a prominent alert when opening a patient with outstanding debt,
So that I know to address it before proceeding.

**Acceptance Criteria:**

**Given** the patient has an unpaid balance
**When** I open their record
**Then** a prominent debt alert renders

**Given** no debt exists
**When** I open the record
**Then** no alert shows (debt data arrives from Epic 6; until then this renders the no-debt state, a valid demoable outcome, not a blocked one)

### Story 3.5: Clinical History with Trend Chart

As a Químico or Admin,
I want to see a patient's full result history ordered by date, with a trend chart comparing repeated studies and out-of-range values flagged,
So that I can track clinical trends over time.

**Acceptance Criteria:**

**Given** the patient has validated results
**When** I open their clinical history
**Then** results list by date, repeated studies of the same type render as a trend chart, and out-of-range values are flagged

**Given** no results exist yet
**When** I open clinical history
**Then** it renders an empty state (populates once Epic 7 ships validated results — same non-blocking pattern as Story 3.4)

---

## Epic 4: Referring Doctors — [Foundation/prerequisite, not end-user value]

Admin manages the referring-doctor directory; every order (Epic 6) requires one assigned at creation.

### Story 4.1: Doctor CRUD

As an Admin,
I want to create, edit, and deactivate referring doctors (name, specialty, cédula, phone, email, workplace),
So that Reception can assign a real referring doctor to every order — mandatory per Epic 6.

**Acceptance Criteria:**

**Given** I fill in the required doctor fields
**When** I save
**Then** the doctor becomes selectable in Epic 6's order-creation flow

**Given** I deactivate a doctor
**When** Reception opens the doctor picker
**Then** that doctor no longer appears as selectable for new orders

### Story 4.2: Orders Filtered by Doctor

As an Admin,
I want to filter and list orders by referring doctor and date range,
So that I can see referral volume per doctor.

**Acceptance Criteria:**

**Given** orders referencing this doctor exist (data arrives once Epic 6 ships)
**When** I filter by doctor and date range
**Then** matching orders list

**Given** no orders reference this doctor yet
**When** I open the filter
**Then** it renders an empty state — same non-blocking pattern used in Epic 3

---

## Epic 5: Cash Sessions (Caja)

Staff open a per-branch cash session, register manual movements, close it with a reconciled summary, and query/export historical sessions. Ships before/alongside Epic 6 — FR-24's cash-session gate is a hard prerequisite for order creation.

### Story 5.1: Open Cash Session

As a Recepcionista or Admin,
I want to open my branch's cash session with an initial fund amount,
So that order creation can proceed for the day.

**Acceptance Criteria:**

**Given** no session is open yet today for this branch
**When** the first person that day registers a patient or order attempt
**Then** they're prompted to open the session with an initial fund

**Given** the session is open
**When** a colleague at the same branch tries later
**Then** they see it already open with no prompt at all (UX-DR16 — lazy, per-branch-per-day trigger)
**And** opening the session writes an `AuditLog` entry (actor, branch, timestamp, initial fund) — FR-52 explicitly names cash-session open/close as a regulated event

### Story 5.2: Payments & Manual Movements Register Against the Open Session

As a Recepcionista,
I want every payment and manual in/out movement (with a concept) to register against the currently open session,
So that the day's cash position stays accurate.

**Acceptance Criteria:**

**Given** a session is open
**When** I enter a manual in/out movement with a concept
**Then** it's attributed to the open session and reflected in its running total

**Given** a payment is recorded from an order (Epic 6, once it exists)
**When** it posts
**Then** it registers against the branch's open session — this AC becomes fully exercisable once Epic 6 ships; the manual-movement half is testable standalone today

### Story 5.3: Close Cash Session with Reconciliation Summary

As a Recepcionista or Admin,
I want to close the session with a summary by payment method, theoretical vs. counted totals, the difference, and per-seller detail,
So that the day's cash is reconciled.

**Acceptance Criteria:**

**Given** an open session
**When** I enter counted totals and close it
**Then** the system computes theoretical vs. counted totals, shows the difference (over/short), breaks down by payment method and seller, and generates a closing PDF
**And** the theoretical total is the sum of every movement registered against the session (Story 5.2) — before Epic 6 ships, that's manual movements only, and a session with zero manual movements closes cleanly at theoretical=0; this story doesn't need Epic 6's order/payment data to be built, tested, or demoed
**And** closing writes an `AuditLog` entry (actor, branch, timestamp, theoretical/counted totals, difference) — same FR-52 obligation as opening

### Story 5.4: Historical Sessions Query & Export

As an Admin,
I want to query past cash sessions and export them,
So that I can review or share historical reconciliation records.

**Acceptance Criteria:**

**Given** closed sessions exist
**When** I filter by a date range
**Then** matching sessions list with export to PDF/Excel

---

## Epic 6: Order Creation & Reception Workflow

Reception creates a complete order — patient, mandatory referring doctor, studies with editable pricing/discounts, multi-method payment — gated by an open cash session; saving prints the three required documents; a patient can be flagged sample-pending, and receiving the sample triggers its charge and routes it to capture (FR-17, absorbed from Epic 3).

### Story 6.1: Cash-Session-Gated Order Creation (Patient + Mandatory Doctor + Studies)

As a Recepcionista,
I want to create an order by finding or creating the patient inline, assigning a mandatory referring doctor, adding studies via instant search, and recording patient observations/conditions,
So that a complete work order is ready — but only when the branch's cash session is open.

**Acceptance Criteria:**

**Given** no cash session is open for my branch today
**When** I try to start a new order
**Then** creation is blocked with a message pointing to opening the session (FR-24 — hard gate tied to Epic 5)

**Given** a session is open
**When** I search/create the patient, assign a referring doctor (required — cannot save without one), and add studies via instant fuzzy search
**Then** the order draft holds everything selected
**And** patient observations/conditions I enter are visible to the chemist during capture (Epic 7)
**And** the entire flow — patient search, study selection, payment — is fully operable via Tab/arrows/Enter with no mouse required (UX-DR17)

**Given** connectivity drops mid-entry
**When** it happens
**Then** a persistent "Sin conexión — no se ha guardado" banner appears, locally-entered fields remain in place, and Guardar stays blocked until the connection returns (UX-DR13 — same pattern Story 7.6 applies to Captura)

### Story 6.2: Editable Pricing, Discounts & Price Overrides

As a Recepcionista,
I want each order line to show the catalog price but let me override it or apply a percentage discount for this order only,
So that I can adjust pricing without touching the catalog.

**Acceptance Criteria:**

**Given** a study/package on the order
**When** I view the line
**Then** it shows the catalog price by default

**Given** I edit a line's price or apply a discount
**When** I save
**Then** the override applies only to this order, and a single `AuditLog` entry (same transaction, per AD-4) records actor, timestamp, the affected order-line, and both the before and after price/discount values (FR-20) — as one atomic write, not two separate operations that could diverge

### Story 6.3: Multi-Method Payment & Tracked Debt

As a Recepcionista,
I want to accept up to three payment methods (cash, card, transfer, credit) in any combination,
So that partial payments are tracked as debt.

**Acceptance Criteria:**

**Given** the order total
**When** I record payments across up to 3 methods
**Then** the sum is validated against the total

**Given** the payment doesn't cover the full total
**When** saved
**Then** the remaining balance is tracked as debt on the patient (feeds Epic 3's debt alert and Epic 9's debt gate)

### Story 6.4: Folio, QR Token & Order Print-Preview

As a Recepcionista,
I want saving the order to generate a folio and immutable QR token and open a print-preview panel showing exactly what's about to print (container labels, payment ticket, work-order template),
So that I can confirm before anything reaches the printer.

**Acceptance Criteria:**

**Given** I save the order
**When** it completes
**Then** a folio unique to `(tenantId, folio)` is generated (AD-4) and an immutable QR token is created

**Given** the save succeeds
**When** the print-preview panel opens
**Then** it lists one container label per required tube (tube color from Epic 2's catalog), the payment ticket, and the work-order template — printing only happens after I confirm (UX-DR7)
**And** this folio is exactly what Epic 7b's equipment agents later resolve orders by, per AD-6

### Story 6.5: Sample-Pending Flag & Auto-Route on Receipt

As a Recepcionista,
I want to flag an order as "muestra pendiente" and have receiving the sample trigger its pending charge and route it into capture automatically,
So that reception doesn't have to remember to follow up manually.

**Acceptance Criteria:**

**Given** an order has a study whose sample isn't yet available
**When** I flag it "muestra pendiente"
**Then** the order-item is created in that state instead of the normal Recepción state

**Given** the sample is later received
**When** I mark it received
**Then** the pending charge applies and the order-item transitions to `muestra_recibida` (AD-4), routing it into Epic 7's capture entry-point list automatically

### Story 6.6: Cancel Order (Admin-Only)

As an Admin,
I want to cancel an order with a mandatory reason,
So that erroneous or unwanted orders are removed from the active pipeline with full traceability.

**Acceptance Criteria:**

**Given** I am an Admin
**When** I cancel an order
**Then** I must provide a mandatory reason, the order transitions to `cancelado` (AD-4's sixth `OrderItem.status` value), and an `AuditLog` entry records actor, timestamp, and reason — same pattern as FR-32's invalidate-with-reason

**Given** a non-Admin (e.g., Recepcionista) attempts to cancel an order
**When** they try
**Then** the action is blocked by RBAC (Epic 1)

**Given** the cancelled order had a payment recorded
**When** it's cancelled
**Then** no automatic refund is issued — a manual refund movement is entered in Cash Sessions (Story 5.2) with a concept referencing the cancelled order's folio

**Given** a cancelled order
**When** viewed on Delivery (Epic 9) or the Kanban (Epic 8)
**Then** it's excluded from active pipeline views but remains queryable/filterable as "cancelled" (FR-41)

---

## Epic 7: Results Capture & Validation

The chemist captures every analyte type — manual entry for studies with no attached instrument, and instrument-fed analytes once Epic 7b exists — and every study, regardless of source, passes through the same single "Validado" gate before it counts as done. Fully functional and demoable end-to-end on 100% manual data; does not depend on Epic 7b or Epic 8.

### Story 7.1: Capture Entry Point — Pending Samples List + Order Lookup

As a Químico,
I want a simple list of samples pending capture, plus the ability to look up an order by folio, patient name, or date,
So that I always have an entry point into capture, even before the full Kanban board exists.

**Acceptance Criteria:**

**Given** order items are in `muestra_recibida` or `en_analisis` status
**When** I open Captura
**Then** a plain sortable list shows them — no drag-and-drop, no card rules (Epic 8 replaces this list outright, doesn't layer under it)

**Given** I search by folio, patient name, or date instead
**When** I find a match
**Then** I can open it directly

### Story 7.2: Multi-Type Analyte Capture

As a Químico,
I want to capture every analyte type — numeric, text, calculated, image (evidence gallery), document (constrained editor), and referenced — with Tab-key navigation and the reference range always visible,
So that I can enter results quickly and accurately regardless of type.

**Acceptance Criteria:**

**Given** a numeric analyte
**When** I enter a value
**Then** its unit, decimals, and reference range render alongside it (UX-DR5)

**Given** a calculated analyte
**When** its input analytes are captured
**Then** it auto-computes via the catalog formula

**Given** an image-type analyte
**When** I add evidence
**Then** the evidence-gallery pattern applies — in-app crop, captioned list, drag-reorder (UX-DR1)

**Given** a document-type analyte
**When** I write an interpretation
**Then** the constrained editor renders at final-PDF font/width (UX-DR2)
**And** Tab moves between analyte fields top-to-bottom (FR-30), and each field shows `Automático`/`Calculado` or no tag for manual entry (UX-DR6) — populated only once Epic 7b exists, blank/manual until then

### Story 7.3: Out-of-Range Highlighting & Critical-Value Acknowledgment Gate

As a Químico,
I want out-of-range values automatically highlighted and critical values to block validation until I explicitly acknowledge them,
So that dangerous results are never missed.

**Acceptance Criteria:**

**Given** a value outside its reference range
**When** it's captured
**Then** a Normal/Low/High indicator renders automatically

**Given** a value crosses its configurable critical threshold
**When** I attempt to validate
**Then** validation is blocked until I perform an explicit acknowledgment action — other rows dim and the blocking row highlights (UX-DR12)

### Story 7.4: Study Validation — the Single "Validado" Gate

As a Químico,
I want to preview the results PDF, adjust study print order, and validate a study with one action,
So that manual and instrument-fed results share exactly one path to "done" — and validating is what makes the study visible to the paying patient.

**Acceptance Criteria:**

**Given** a study with all analytes captured
**When** I preview the PDF and drag-reorder studies in the order-level list
**Then** the preview reflects my ordering (FR-33, FR-34), using the same drag gesture as the evidence gallery (Story 7.2), with the identical keyboard equivalent — Tab to focus a study, then Ctrl+↑/Ctrl+↓ to move it (UX-DR3)

**Given** the study is ready to validate
**When** I reach the end of the analyte list via Tab (Story 7.2's keyboard-first flow) and press the designated Validar shortcut (no mouse required — same keyboard-first standard as Recepción and the evidence gallery, not a separate convention invented for this screen, UX-DR17)
**Then** the Validar action fires exactly as if I'd clicked the button

**Given** I hit Validar
**When** it completes
**Then** every analyte in the study validates at once, validator+timestamp are recorded, and the order's pipeline position advances if this was its last unvalidated study (FR-31)
**And** the capture list shows the study color-coded pending/in-progress/validated throughout (FR-35)

**Given** the order is already paid
**When** validation completes
**Then** the study becomes visible on the patient portal immediately

### Story 7.5: Invalidate & Recapture with Mandatory Reason and Correction History

As a Químico,
I want to invalidate a validated result only with a mandatory reason, and see each analyte's own correction history,
So that every recapture is traceable.

**Acceptance Criteria:**

**Given** a validated result
**When** I invalidate it
**Then** a reason is mandatory, and an `AuditLog` entry records actor, timestamp, the mandatory reason, and the before value (result reverting from validated) — FR-32
**Given** the result is then recaptured
**When** saved
**Then** a second `AuditLog` entry records actor, timestamp, and the before/after values of the recapture — a distinct entry from the invalidation, since they're two separate events even when they happen back-to-back

**Given** any analyte edit — including a post-validation correction
**When** I open its correction-history popover
**Then** it shows who/when/before/after (UX-DR4)

**Given** a calculated analyte's input is corrected after its study was validated
**When** the derived value recalculates
**Then** the whole study auto-invalidates, forcing re-validation

### Story 7.6: Offline-Safe Capture

As a Químico,
I want locally-entered data preserved if connectivity drops, with a clear banner blocking Guardar/Validar until reconnected,
So that nothing typed is lost and nothing new reaches the server half-saved.

**Acceptance Criteria:**

**Given** connectivity drops mid-capture
**When** it happens
**Then** a persistent "Sin conexión — no se ha guardado" banner appears and locally-entered values remain in the form

**Given** the connection is down
**When** I try Guardar/Validar
**Then** both stay blocked until connectivity returns (UX-DR13)

---

## Epic 7b: Equipment Interfacing — Mindray Agents

The two named Mindray instruments push results automatically into the matching order/analyte via their own on-site agent process, landing in the exact same `Result` table Epic 7 already validates from. Never owns validation — only populates data upstream of it. Does not gate Epic 8/9/10.

### Story 7b.1: On-Site Agent Infrastructure & Ingestion API

As the platform (foundation for both instruments),
I want each Mindray instrument to have its own on-site agent process and a secure ingestion endpoint on the cloud app,
So that instrument results reach Quimia IO without any inbound connection to the lab PC.

**Acceptance Criteria:**

**Given** an on-site agent (Node 24) runs on the instrument's PC
**When** it sends a result
**Then** it authenticates via per-instrument API key + HMAC-signed request over body+timestamp (AD-7), and the endpoint rejects unsigned or stale requests

**Given** the agent only makes outbound HTTPS calls
**When** the system operates
**Then** the cloud app never opens or holds a connection to the lab PC (AD-5)

**Given** dev/preview environments
**When** interfacing is exercised
**Then** simulated HL7/ASTM messages are used — never real hardware (AD-9)
**And** this story's own test fixtures use a generic, synthetic HL7 envelope (valid structure, no instrument-specific segments) to prove the listener/auth/routing/error-handling infrastructure works — deliberately NOT built against BC-5150's confirmed protocol, so this story has no hidden dependency on Story 7b.2/7b.3 and can be built and accepted first, in isolation

### Story 7b.2: BC-5150 — Protocol Connection & Message Parsing

As the on-site agent,
I want to connect to the BC-5150 over its confirmed HL7 host interface and parse each incoming message into a structured result record,
So that raw instrument output becomes usable data before any order/analyte matching happens.

**Acceptance Criteria:**

**Given** the BC-5150 is connected via its native host interface (serial/TCP per Mindray's HL7 manual)
**When** it emits a result message
**Then** the agent parses it into a structured `{folio, analyte_code, value}` record

**Given** a malformed or unparseable message
**When** received
**Then** the agent logs the parse failure locally and does not forward a corrupted record downstream

**Given** the connection drops mid-session
**When** it happens
**Then** the agent attempts reconnection without losing already-parsed pending messages

### Story 7b.3: BC-5150 — Result Mapping & Ingestion with Error Handling

As a Químico,
I want each parsed BC-5150 result to resolve to the correct order/analyte and post via the shared ingestion path, with clear handling when it can't,
So that results land reliably or fail visibly rather than silently.

**Acceptance Criteria:**

**Given** a parsed `{folio, analyte_code, value}` record from Story 7b.2
**When** the ingestion API receives it (per Story 7b.1's auth)
**Then** it resolves the order by `(tenantId from API key, folio)`, validates the analyte belongs to a requested Study, and calls `results-capture`'s `recordInstrumentResult()` — never writing `Result` directly (AD-6)

**Given** the folio doesn't match any order, or the analyte isn't part of the order's requested studies
**When** that happens
**Then** the record is rejected with a specific error reason — logged to an ingestion-errors surface an operator can see, never silently dropped

**Given** a new result arrives for the same `(orderItemId, analyteId)`
**When** it's processed
**Then** it upserts — never a batch replace of the whole study

**Given** an analyte the instrument doesn't report
**When** the study opens in Epic 7's capture screen
**Then** it remains empty for the Químico to complete manually

### Story 7b.4: BS-240Pro Chemistry Protocol Spike

As the development team,
I want to confirm BS-240Pro's exact protocol, version, and transport before committing to implementation,
So that this unconfirmed risk doesn't block the rest of Phase 1.

**Acceptance Criteria:**

**Given** the client's actual BS-240Pro host-interface manual (or direct contact with Mindray), investigated within a fixed time-box (e.g., 3 working days — owner to confirm the exact limit before this story starts)
**When** the protocol is confirmed within that window
**Then** the protocol (HL7 v2.3.1 vs. ASTM E1394-97) and transport (TCP vs. RS-232 serial) are documented, and Stories 7b.5/7b.6 proceed as planned

**Given** the time-box expires without a confirmed protocol
**When** that happens
**Then** the spike ends in an explicit written decision — not silent continued investigation — that BS-240Pro is excluded from Phase 1: studies from that instrument fall back to Epic 7's manual capture, Stories 7b.5/7b.6 are formally descoped, and the decision is logged in the PRD/architecture record (same treatment as the FR-18 and debt-gate corrections already made this session)
**There is no third outcome** — the spike cannot end "still unclear, continuing to investigate"; it produces either a confirmed protocol or a logged exclusion decision, before this story is considered done

### Story 7b.5: BS-240Pro — Protocol Connection & Message Parsing

As the on-site agent,
I want to connect to the BS-240Pro over its confirmed protocol/transport (per Story 7b.4) and parse its messages into structured result records,
So that BS-240Pro output becomes usable data the same way BC-5150's does.

**Acceptance Criteria:**

**Given** Story 7b.4 confirmed the protocol/transport
**When** the agent is built against that confirmed spec
**Then** it connects and parses messages following the same structured-record pattern as Story 7b.2

**Given** 7b.4's spike times out instead
**When** that happens
**Then** this story is explicitly descoped from Phase 1

### Story 7b.6: BS-240Pro — Result Mapping & Ingestion with Error Handling

As a Químico,
I want BS-240Pro results mapped and ingested the same way BC-5150's are,
So that chemistry panels are captured without manual re-entry, same as hematology.

**Acceptance Criteria:**

**Given** a parsed BS-240Pro record from Story 7b.5
**When** ingested
**Then** it follows the exact same mapping/error-handling path as Story 7b.3

**Given** 7b.4's spike times out instead
**When** that happens
**Then** this story is explicitly descoped from Phase 1 without affecting the rest of the epic

---

## Epic 8: Pipeline Kanban

Staff see every active order on a 5-column board with drag/drop correction, aging alerts, filters, and live counts. Replaces Epic 7's minimal entry-point list outright.

### Story 8.1: Five-Column Board with Automatic State Advancement

As any staff member,
I want to see all active orders on a 5-column board (Recepción→Muestra recibida→En análisis→Validado→Entregado) that advances automatically as business events happen,
So that I always know where every order stands without manual bookkeeping.

**Acceptance Criteria:**

**Given** an order is created (Epic 6)
**When** it saves
**Then** it appears in Recepción

**Given** an order has multiple studies at different states
**When** the board renders
**Then** its column reflects the least-advanced study

**Given** all studies validate (Epic 7) or delivery is recorded (Epic 9)
**When** those events fire
**Then** the order advances to Validado / Entregado respectively
**This story replaces Epic 7's minimal pending-list entry point outright — it doesn't layer on top of it**

### Story 8.2: Card Content, Drag-as-Correction & Audit

As any staff member,
I want each card to show folio, patient, study chips, elapsed time, responsible person, and a color state, and to be draggable only as a manual correction — never the normal path,
So that the board stays trustworthy.

**Acceptance Criteria:**

**Given** a card renders
**When** I view it
**Then** it shows folio, patient, study chips, elapsed time, responsible, and color state

**Given** I drag a card to a different column
**When** it drops
**Then** it's treated purely as a correction/override and writes its own `AuditLog` entry (who/when/from-state/to-state) — never the normal advancement path

**Given** an order has a logged result correction
**When** its card renders
**Then** it shows an inline note (e.g., "↺ 1 corrección registrada — TSH")

### Story 8.3: Aging Time Alerts

As any staff member,
I want a card to turn yellow after 45 minutes without advancing and red after 90,
So that stuck orders are visible before they become a problem.

**Acceptance Criteria:**

**Given** a card hasn't advanced in 45/90 minutes
**When** the shared 4-second SWR poll refreshes
**Then** its color updates accordingly, reflected within NFR-5's 5-second SLA
**And** this polling hook is the only real-time mechanism in Phase 1 — no module opens a WebSocket/SSE connection instead (AD-11)
**And** aging/critical state is announced via `aria-label`, not color alone (accessibility floor, UX-DR23)

### Story 8.4: Board Filters & Live Column Counts

As any staff member,
I want to filter the board by chemist and date and see a live count per column,
So that I can focus on relevant orders.

**Acceptance Criteria:**

**Given** I filter by chemist and/or date
**When** applied
**Then** only matching cards show
**And** each column header shows a live count that updates via the same polling hook

### Story 8.5: Card Click Opens Order Detail

As any staff member,
I want clicking a card to open the full order detail,
So that I can see everything about that order without losing my place on the board.

**Acceptance Criteria:**

**Given** I click a card
**When** it opens
**Then** the full order detail (Epic 6 data) renders, and returning restores the board's prior filter/scroll state

---

## Epic 9: Delivery & Patient Portal

Staff deliver results (print/email/hand-off) with debt gating and digital signature capture, and patients/doctors view results independently through the DOB-gated portal link.

### Story 9.1: Delivery List Filtered by Date & State

As a Recepcionista,
I want the delivery screen to list results filtered by date and state (ready, with debt, cancelled) and color-coded,
So that I can quickly find what needs to go out.

**Acceptance Criteria:**

**Given** results exist across different states
**When** I filter by date and state
**Then** matching results list, green for ready and red for debt/cancelled

### Story 9.2: Deliver via Print/Email/Hand-off with Debt Gate

As a Recepcionista,
I want to print, email, or hand over a result — blocked while debt is unsettled unless an admin overrides,
So that delivery only happens once both validated and paid.

**Acceptance Criteria:**

**Given** an outstanding balance
**When** I attempt delivery
**Then** it's blocked with "Adeudo — entrega bloqueada" (UX-DR11)

**Given** an Admin overrides the debt gate to allow delivery anyway
**When** the override is used
**Then** an `AuditLog` entry records actor (the Admin), timestamp, the order/folio, the outstanding balance at the time of override, and a mandatory reason for the override — FR-43's "audit-logged" made concrete

**Given** I settle the balance from this screen (multiple payment methods)
**When** it clears
**Then** delivery actions unlock

**Given** the patient consented to email at registration (Epic 3)
**When** I choose email delivery
**Then** it sends — otherwise that channel is unavailable
**And** every delivery records timestamp, channel, and user (FR-42)

### Story 9.3: Signature Pad for In-Person Hand-off

As a Recepcionista,
I want the patient to sign on a touchscreen during in-person delivery,
So that receipt is confirmed digitally.

**Acceptance Criteria:**

**Given** an in-person hand-off
**When** I initiate delivery
**Then** the patient signs via touch/stylus, with "Borrar/Reintentar" to clear without leaving the screen
**And** the captured signature is stored with a timestamp tied to the order/folio; this applies only to the in-person channel, not print/email/WhatsApp (UX-DR8)

**Given** the signature pad hardware fails, or connectivity is down at the moment of signing
**When** that happens
**Then** delivery still proceeds — it is never blocked by a signature-capture failure — and the signature is marked pending-sync, stored locally if captured or flagged missing if the pad itself didn't work, then reconciled to the order once the pad/connection is available again

### Story 9.4: Patient Portal — DOB-Gated Public Result View

As a patient,
I want to open my QR/token link, confirm my date of birth, and see my validated-and-paid results with PDF download,
So that I can access my results without an account.

**Acceptance Criteria:**

**Given** a valid, unexpired token
**When** I open the portal link
**Then** I'm shown a DOB confirmation prompt before any clinical content renders

**Given** my DOB matches
**When** confirmed
**Then** I see name/date/studies/results with indicators, plus PDF download — only for studies that are both validated and paid, checked independently per study

**Given** a study is validated but the order has an unsettled balance
**When** I view it in the portal
**Then** it shows as existing and validated, but the result detail/PDF download is replaced with the fixed message "Resultado con saldo pendiente, pase a liquidar sus estudios." — corrected 2026-08-02 in `EXPERIENCE.md`; visible-but-blocked, not withheld — and unlocks automatically once the balance clears (Epic 6 payment)

**Given** my DOB doesn't match
**When** submitted
**Then** a neutral "no coincide" message shows, with no hint and no attempt count

**Given** the token has passed its 7-day expiry
**When** I open the link
**Then** an "Enlace expirado" message shows with no clinical content (FR-44, UX-DR15)
**And** the portal renders single-column, chrome-free, on phone (UX-DR21)

### Story 9.5: Delivery History of Comparable Results

As a Químico or Recepcionista,
I want delivery history to show the patient's previous comparable results,
So that trends are visible at delivery time too.

**Acceptance Criteria:**

**Given** prior deliveries of the same study type exist
**When** viewing delivery history
**Then** previous comparable results display alongside the current one

---

## Epic 10: Dashboard & Basic Reports

Admin/reception see today's KPIs, a 7-day revenue trend, top studies, and a mini pipeline summary on login, plus exportable sales reports by period. Aggregates data written by Epics 5, 6, 7, 8 — ships last among the operational epics by necessity.

### Story 10.1: Sales Report by Period

As an Admin,
I want a sales report by day/week/month/custom range with totals by payment method and seller, exportable to Excel/PDF,
So that I can review revenue performance.

**Acceptance Criteria:**

**Given** orders and payments exist (Epics 5, 6)
**When** I select a reporting period
**Then** totals compute by payment method and by seller, sourced only from `cash` and `orders`' own exposed query interfaces (AD-1) — never a direct query against another module's Prisma models
**And** the report exports to Excel/PDF

### Story 10.2: Dashboard KPIs & Mini Pipeline Summary

As an Admin or Recepcionista,
I want today's KPIs (orders, revenue, pending results, delivered studies), a 7-day revenue chart, top-5 studies, and a mini pipeline summary mirroring the Kanban column counts,
So that I see the lab's day at a glance.

**Acceptance Criteria:**

**Given** today's operational data exists
**When** the dashboard loads
**Then** all KPI cards, the 7-day revenue chart, and the top-5 studies list populate — each figure pulled from its owning module's own exposed query (`orders`, `cash`, `results-capture`, `kanban`), never from a cross-module join written inside the dashboard module itself (AD-1)
**And** the mini-pipeline mirrors Epic 8's live column counts via `kanban`'s own exposed summary, not a re-derivation from raw order data

**Given** zero orders exist today
**When** the dashboard loads
**Then** KPI cards show 0 with an encouraging empty-pipeline message rather than blank cards (UX-DR14)

### Story 10.3: Active Alerts & Dashboard Quick Actions

As an Admin or Recepcionista,
I want the dashboard to surface active alerts (debts, pending samples, time-critical orders) and offer quick actions styled as a live Recepción-intake preview beside "Órdenes recientes,"
So that I can act immediately without a menu of buttons.

**Acceptance Criteria:**

**Given** debts, pending samples, or time-critical orders exist
**When** the dashboard loads
**Then** each alert type surfaces distinctly

**Given** I want to start a new order
**When** I view the dashboard
**Then** quick actions render as a live-styled, pre-focused intake-form preview (UX-DR19) — not a button menu — opening directly into Epic 6's order-creation flow

---

## Epic 11: Audit Log

Admin reviews the immutable, filterable log of every regulated event. The write path and storage-privilege guarantee were built in Epic 1; this epic delivers the admin-facing viewer and confirms every prior epic actually wired its regulated events into it.

### Story 11.1: Admin Audit-Log Viewer with Cross-Epic Traceability Check

As an Admin,
I want to view the immutable, filterable audit log (by date and user),
So that I can review every regulated change across the system.

**Acceptance Criteria:**

**Given** regulated events have occurred across the system
**When** I filter the log by date and/or user
**Then** matching `AuditLog` entries list with actor, timestamp, entity, and before/after values

**Given** I am not an Admin
**When** I try to access this screen
**Then** access is denied

**Given** the six event categories FR-52 names — result invalidations (Epic 7), order price/discount changes (Epic 6), user lifecycle (Epic 1), cash-session open/close (Epic 5), reference-range edits (Epic 2), and admin debt overrides (Epic 9)
**When** an automated integration test exercises each triggering action once (not a manual checklist walkthrough) and then queries the `AuditLog` table directly
**Then** exactly one new row exists per category with actor/timestamp/before-after populated — this test is what would have caught the Epic 5 cash-session gap before ship, and it re-runs on every future change to any of the six source epics, not just once at Epic 11's own delivery

**Given** any `AuditLog` row exists
**When** anyone (including Admin) attempts to update or delete it
**Then** the database rejects it — no UPDATE/DELETE grant exists on this table (AD-10, enforced in Epic 1)
