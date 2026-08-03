---
title: "UX Source Digest — Quimia IO"
generated: 2026-07-10
sources:
  - prd.md (prd-quimiaio-2026-07-05)
  - addendum.md
  - research-market.md
  - quimiaio-prompt-maestro.md (v2.0)
  - "Proyecto QuimiaIO Specs.docx" (client's original raw requirements notes)
  - index.html (existing static prototype/landing page)
---

# UX Source Digest — Quimia IO

Extraction only — no invented content. Where a section has nothing in the sources, it is marked "Not covered in sources."

## Product scope & modules

Numbered per `quimiaio-prompt-maestro.md` §6 (15 modules), cross-checked against PRD §5/§6 functional groups and the client's raw notes in the docx. Spanish names kept verbatim with English gloss.

1. **Dashboard** (Dashboard) — home screen on login; real-time daily KPIs, mini pipeline summary, quick actions.
2. **Pacientes** (Patients) — patient record management: registration, edit-with-changelog, clinical history with trend charts, "muestra pendiente" (pending-sample) flag/flow.
3. **Recepción / Órdenes** (Reception / Orders) — create and manage work orders; explicitly flagged "⭐ Más importante" / most-used module daily. Includes **Cotizaciones** (Quotations, Phase 2) as a sub-flow.
4. **Pipeline Kanban** (Kanban Pipeline) — visual board of every active order's state with time-based alerts; explicitly flagged "⭐ Innovación principal" (flagship differentiator, no incumbent offers it).
5. **Captura de Resultados** (Results Capture) — chemist enters/validates analyte results for each study on an order.
6. **Entrega de Resultados** (Results Delivery) — deliver validated results via PDF print, email, WhatsApp, or patient-portal QR; settle outstanding debt from this screen.
7. **Doctores** (Doctors) — CRUD for referring physicians; doctor-specific price lists and sales commissions (Phase 2 statements).
8. **Empresas** (Companies / convenios) — corporate/lab billing agreements: credit control, exclusive price lists, commission %, account statements.
9. **Configuración** (Configuration) — catalog admin hub with sub-areas: Estudios (studies), Analitos (analytes), Paquetes/Perfiles (packages), Métodos (methods), Técnicas (techniques), Equipos (equipment, incl. calibration date), Recipientes (containers), Tipos de Muestra (sample types), Nivel del Mar (sea-level/altitude catalog), Plantillas PDF (PDF templates), Tiempo de alertas Kanban (Kanban alert thresholds).
10. **Caja** (Cash control) — daily/branch cash-session open→operate→close cycle with reconciliation; a hard gate on order creation.
11. **Reportes y Análisis** (Reports & Analytics) — sales reports by many dimensions, relationship tables (doctors/companies/folios), interactive charts, multi-branch consolidated dashboard (Red plan).
12. **Usuarios y Roles** (Users & Roles) — user CRUD, role assignment, branch assignment, granular per-module permission checkboxes.
13. **Inventario de Reactivos** (Reagent Inventory, Plan Red) — stock catalog, minimum-stock alerts, automatic consumption per study, purchases/manual outflows, consumption reports.
14. **Auditoría / Bitácora** (Audit Log) — immutable record of critical changes (invalidations, price changes, user CRUD, cash open/close) for traceability and compliance; admin-only, filterable.
15. **Facturación CFDI** (CFDI Invoicing, Phase 2 add-on, +$399 MXN/mo) — SAT electronic invoicing: generate, stamp via PAC, PDF+XML download, cancellation, issued-invoices report.

Additional cross-cutting surfaces named in the sources (not standalone numbered modules but distinct UX surfaces):
- **Portal del Paciente** (Patient Portal) — public, no-login page at `quimiaio.com/r/{token}`; identity-gated by date-of-birth confirmation (PRD FR-44).
- **Integración WhatsApp** (WhatsApp Integration, Twilio, Phase 2) — automatic + manual messaging triggered from order creation, validation, and delivery.
- **Multi-tenant shell** — `quimiaio.com` (marketing landing), `app.quimiaio.com` (SaaS login entry), `labname.quimiaio.com` (tenant-specific subdomain).

Phase framing (from PRD §5): modules 1–3, 5–7 (basic), 9, 10, 11 (basic), 12, 14 ship in Phase 1; Kanban (4) ships Phase 1 but with fixed (non-configurable) alert thresholds; Cotizaciones, WhatsApp, Empresas' full commission/statement features, Inventario, full Reportes/BI, CFDI (15), and the altitude-adjusted reference engine are Phase 2. Phase 3 backlog (not modules, adjacent domains): appointments/agenda, imaging, EMR/HIS integrations, native mobile apps, offline capture, patient-facing mobile app, home sample-collection logistics.

## User roles

| Role (verbatim) | Gloss | What it does | Phase |
|---|---|---|---|
| **Admin** | Lab owner / partner doctor | Full access: oversight, configuration, reports, audit | 1 |
| **Recepcionista** | Receptionist | Registers patients, creates orders, takes payments, delivers results, opens/closes cash | 1 |
| **Químico** | Lab chemist | Captures and validates results, manages the analysis queue, delivery, pipeline | 1 |
| **Administración** (docx: "Administracion_contabilidad") | Administration/accounting | Reports, cash, statements, relaciones | 2 |
| **Gerente** | Manager | Dashboards and reports, read-mostly — no capture, no cash | 2 |
| **Paciente** | Patient | Not a system user/account; receives results via a tokenized public portal link, no login | n/a |

Granular per-module permissions (Phase 2, FR-70) are checkbox-style per the docx: "Nuevo paciente, Modificar paciente, Historial, Nueva orden, Editar orden, Cotización, Captura, Validar, Entrega, Cierre caja, Apertura caja, Reportes, Relaciones, Doctores, Empresas, Usuarios, Configuración, Precios" — a flat list of ~17 module/action toggles per role, no grouping proposed in sources.

## Pipeline / core workflow

The Kanban board's 5 columns (PRD FR-36; maestro §Módulo 4) are the canonical spine of the lab pipeline: **Recepción → Muestra recibida → En análisis → Validado → Entregado** (Reception → Sample received → In analysis → Validated → Delivered). Phase 2 adds a send-out/maquila sub-state (FR-84) represented on the same board.

Step-by-step, combining the order-creation flow (maestro §Módulo 3 "Flujo principal") with the pipeline and delivery FRs:

1. **Reception intake** — receptionist finds or creates the patient inline (name/phone/folio instant search); order enters Kanban column "Recepción."
2. **Order composition** — optionally assign referring doctor, company (auto-applies its price list), and vendedor (staff member); add studies via instant code/name search; catalog price is editable per-order only (never touches the catalog); percentage discount or per-line override, both audit-logged.
3. **Payment** — up to 3 payment methods combined (cash/card/transfer/credit); partial payment creates a tracked debt. A cash session must already be open for the branch/day (Caja gate) or order creation is blocked.
4. **Save** — generates a unique per-tenant folio and an immutable QR/token, prints a ticket/work order. (If a prior quotation exists, converting it collapses steps 1–3 into one click, Phase 2.)
5. **Sample handling** — if a sample is pending (e.g., urine to bring later), the order is flagged "muestra pendiente"; receiving the sample triggers the pending charge and auto-routes the order into capture. Otherwise the order advances to "Muestra recibida" on sample receipt.
6. **Capture** — chemist finds the order (folio/name/date), captures each study's analytes (numeric, text, calculated/auto-formula, image, rich-text document, or age/sex/altitude-referenced), with Tab-key navigation and automatic out-of-range highlighting (Normal/Low/High); critical (panic) values require explicit chemist acknowledgment. Order sits in "En análisis" while any study is unvalidated.
7. **Validation** — validating a study records validator + timestamp; once every study on the order is validated, the order auto-advances to "Validado." A validated result can only be invalidated with a mandatory logged reason (then recaptured).
8. **Delivery** — staff filters ready results (by date/state), prints the official PDF, emails it (if the patient consented at registration), sends via WhatsApp (Phase 2), or hands it over; a debt-gate blocks delivery until settled (or an audit-logged admin override). Delivery is recorded with timestamp/channel/user; order moves to "Entregado." The patient can independently access results anytime via the QR/token portal (date-of-birth-gated, no login).
9. **Cash close** — wrapping the day: Caja close produces a by-payment-method summary, theoretical-vs-counted totals and discrepancy, per-seller detail, and a closing PDF.

Docx raw notes largely mirror this same sequence and add operational color: e.g. reordering study print order happens inside the Captura module ("cambiar orden... vamos al modulo de captura"); price overrides also happen at order/study level inside the same order-creation screen.

## Brand & visual hints

Confirmed CSS custom properties (declared identically in `quimiaio-prompt-maestro.md` §3 and `addendum.md`; the navy/cyan pairing is directly visible in `index.html`'s inline `<style>`):

```
--primary:    #0D1B36  /* navy — navbar, buttons; also index.html body background */
--accent:     #00C4E0  /* electric cyan — "IO" in the logo, active/accent elements */
--accent-lt:  #E0F8FF  /* soft cyan — active-sidebar background */
--bg:         #F0F6FF  /* general (light) app background */
--text:       #0F172A  /* primary text */
--gray:       #64748B  /* secondary text */
--border:     #E2E8F0  /* borders */
--ok:         #10B981  /* delivered / validated (green) */
--warn:       #F59E0B  /* >45 min alert (amber) */
--error:      #EF4444  /* >90 min critical, or debt (red) */
```

- **Font**: Plus Jakarta Sans. Maestro specifies weights "300 light / 800 bold"; `index.html` actually loads the fuller family `wght@300;400;600;700;800` from Google Fonts.
- **Logo lockup** (verbatim, confirmed in `index.html` markup `<div class="logo">Quimia <span>IO</span></div>`): "Quimia" at weight 300 + " IO" at weight 800 in accent cyan.
- **Tone/copy signals** from `index.html`: headline "El sistema de laboratorio que **sí funciona**" (direct, contrarian-to-incumbents), "Sin spam. Solo te avisamos cuando lancemos." (low-pressure reassurance), uppercase letter-spaced pill badge "Próximamente."
- **Layout/component patterns actually implemented in index.html**: fully rounded ("pill", `border-radius:99px`) buttons and text inputs; a 4px flat accent bar pinned to the viewport top; two large soft radial-gradient decorative circles (low-opacity cyan glow) in the dark hero background; translucent white overlays (low-opacity `rgba(255,255,255,…)`) for input borders/fills and for feature "chips."
- **Naming/domain**: product name "Quimia IO" consistent everywhere; root domain `quimiaio.com`; multi-tenant subdomain pattern `labname.quimiaio.com`; app entry `app.quimiaio.com` (per maestro §4 and addendum route notes).
- **Reconciliation gap**: the palette's `--bg: #F0F6FF` (light) is the stated *general app background*, but the only built artifact (`index.html`) is a fully dark navy (`#0D1B36` body) hero page — the two aren't reconciled in the sources (see Open Questions).

## Existing prototype analysis

`index.html` is **not an application-screen prototype** — it is a single static marketing "coming soon" / pre-launch landing page (`<title>Quimia IO — Próximamente</title>`), vanilla HTML/CSS/inline-JS, no framework, no build step, no routing.

**Structure (single view, no navigation):**
- Full-viewport, centered flex layout, dark navy body background.
- Decorative layer: 4px cyan top bar; two large radial-gradient cyan-glow circles positioned off-canvas top-right and bottom-left.
- Content block, in order: logo lockup → "Próximamente" pill badge → H1 headline (with cyan `<em>` emphasis span) → gray subcopy paragraph → email-capture form (rounded input + rounded cyan CTA button) → thin divider line → row of 6 feature "chips" → footer (copyright + `mailto:` contact link).
- Feature chips (verbatim, doubling as an informal mini-sitemap of headline modules): "Expediente digital", "Resultados PDF", "Kanban de órdenes", "WhatsApp", "Código QR", "Multi-sucursal".
- One responsive breakpoint (`max-width:480px`): shrinks logo/H1 font sizes, stacks the form vertically.

**Interaction/behavior:** inline `onclick="registrar()"` JS reads the email input, does a bare `.includes('@')` check (not real validation), then toggles `display` to hide the form and reveal a static "✓ Te avisamos cuando lancemos." success message. No `fetch`/API call — the signup is not wired to any backend.

**Nav model:** none — single CTA page, not a dashboard/sidebar shell. The maestro's route structure (`app/(dashboard)/layout.tsx ← sidebar + topbar`) describes the intended real app shell, but no such shell exists in any built file reviewed.

**What works:** consistent, confident brand execution (color pairing, type, logo lockup, tone of copy) that the real product UI should inherit; the chip row is a clean, ready-made value-prop summary.

**What's rough:** no real screens (dashboard, Kanban board, capture form, tables) exist to evaluate or extend; accessibility gaps (no `aria-hidden` on decorative circles, no visible focus-ring beyond a border-color change, low-opacity gray-on-navy paragraph text is a likely contrast risk, naive email regex); zero backend wiring; the light `--bg` token from the design system is untested since this page is 100% dark.

## UX requirements & constraints

- **Performance** (NFR-5): patient/study search perceived under 300 ms; a routine 3-study order created end-to-end in under 2 minutes; Kanban board reflects state changes within 5 seconds.
- **Mobile-first PWA** (NFR-6): every screen must be usable on a phone; reception and delivery flows specifically optimized for tablet/desktop; the patient portal specifically optimized for phone.
- **Keyboard-driven capture** (FR-30): Tab-key navigation between analytes for rapid results entry — a named requirement, not incidental.
- **Instant/fuzzy search**: patient search (FR-13) and study search in order-entry (maestro: "búsqueda de estudios instantánea, fuzzy search") both must resolve in real time as the user types.
- **Language & currency** (NFR-9): UI in Spanish (Mexico); all monetary values in MXN.
- **RBAC surfaced in UI** (NOM-024-SSA3 / NFR-2, FR-3): every screen and API enforces role-based access; unauthorized actions must be visibly blocked, not just silently disabled.
- **Debt/alert affordances**: opening a patient with outstanding debt must show "a prominent alert" (FR-15); delivery is blocked on unsettled debt except an explicit, audit-logged admin override (FR-43) — both need clear, distinct visual treatment.
- **Critical-value acknowledgment** (FR-29): values crossing configurable panic thresholds must be flagged distinctly and require an explicit chemist acknowledgment step before validation can complete.
- **Kanban time-alert semantics** (FR-38): fixed thresholds in Phase 1 — card turns yellow at 45 min, red at 90 min; Phase 2 makes thresholds lab-configurable (FR-79), so the UI should not hardcode the labels/colors to those exact numbers.
- **Patient portal identity gate** (FR-44): the public token URL requires the viewer to confirm the patient's date of birth before any result renders — no account, no login; token policy (single-use vs. 24h/7-day expiry) is configurable.
- **Privacy/consent UX** (NFR-3, LFPDPPP 2025): a privacy notice must be presented and explicit consent captured at patient registration; ARCO rights (access/rectify/cancel/oppose) must be operationally supported (export/rectify/delete on request), with configurable notice text/response deadlines — implies a consent step in the patient-creation flow and an admin-facing ARCO-request handling surface.
- **Auditability surfaced** (NFR-7, FR-52/53): audit log is append-only/immutable, admin-only, filterable by date and user — records actor/timestamp/before-after values for invalidations, price/discount changes, user CRUD, cash open/close, reference-range edits, debt overrides.
- **Equipment/traceability data** (NOM-007-SSA3): equipment catalog carries model/serial/calibration date — implied need for calibration-status visibility (e.g., overdue-calibration alerting) in the Configuración > Equipos UI, though sources do not specify an alert UI for it explicitly.
- **Print surfaces beyond results**: the docx repeatedly calls out "imprimir tabla" (print table) buttons for Doctores and Empresas lists, plus a closing-cash PDF and delivery PDFs — print/export is a recurring, cross-module affordance, not confined to lab results.
- **Multi-tenant/multi-branch**: subdomain-per-tenant (`labname.quimiaio.com`) from Phase 2; Kanban/cash/orders are branch-scoped (cash session ties to "user y sucursal"); Red-plan consolidated multi-branch dashboard compares branches — implies a branch switcher/filter is needed somewhere in the Phase 2 UI, though no pattern is specified.
- **Regulatory grounding**: NOM-007-SSA3-2011 (record-keeping: studies/results/incidents/equipment maintenance), NOM-024-SSA3-2012 (RBAC, audit trail, backups, password complexity), LFPDPPP 2025 (privacy notice/consent/ARCO), CFDI 4.0 (strict buyer tax-data validation, SAT product key 85121800) all directly shape required UI fields/flows as listed above.
- **Accessibility (WCAG or similar)**: Not covered in sources beyond the general "mobile-first" mandate — no explicit accessibility standard, contrast target, or screen-reader requirement is named anywhere.

## Open questions for UX

1. **No real application-screen prototype exists.** `index.html` is a marketing teaser only — there is no wireframe/mockup for the dashboard, Kanban board, capture screen, order form, or any other working-app screen. UX must design all of these essentially from a field/flow description, with no existing visual reference to reconcile against.
2. **Two unreconciled visual identities.** The design tokens name `--bg: #F0F6FF` as the general (light) app background, but the only built artifact is a fully dark-navy hero page. Sources do not say whether the real app shell is light, dark, or themeable, nor how the landing page's dark hero relates to the app's intended light background.
3. **The client's own notes flag unresolved understanding of specific flows**, e.g. (docx, verbatim): "Apertura Caja... no me queda claro muy bien para que sirve este modulo de Apertura Caja aun" (client is unsure what the cash-session-open module is even for) and "NOTA: ESTO NO SE COMO SE MANEJA" next to the calculated-analyte capture/validation step. These need a business-side walkthrough before screen design, not a UX guess.
4. **No interaction pattern specified for study-reordering-for-PDF** ("cambiar orden," done inside the Captura module per the docx) — drag list, numeric-priority field, or modal is unstated.
5. **Image- and document-type analyte capture UI is undefined.** The docx flags these as important ("TE LO ENCARGO MUCHO" / "really need you to nail this") — image analyte has width/height/alignment fields, document analyte opens a rich-text editor inline during capture — but no layout or interaction pattern is given for either.
6. **Permission-matrix UI is unspecified.** Roles carry a flat list of ~17 module/action permission toggles (docx/FR-70) with no proposed grouping, hierarchy, or bulk-assign pattern.
7. **No branch/sucursal switcher pattern** is described for the Phase 2 multi-branch consolidated dashboard, despite branch-scoping already existing in Phase 1 (cash sessions, users).
8. **No accessibility standard is named** anywhere in the sources (no WCAG level, contrast target, or assistive-tech requirement) beyond "mobile-first."
9. **Sidebar+topbar app shell is referenced only as a file-tree comment** (`layout.tsx ← sidebar + topbar` in the maestro's route structure) with zero visual specification — UX has full latitude but also zero existing constraint to anchor to.
