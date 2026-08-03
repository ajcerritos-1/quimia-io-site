---
title: "PRD: Quimia IO"
status: final
created: 2026-07-05
updated: 2026-07-31
---

# Quimia IO — Product Requirements Document

> Laboratory Information System (LIS) for Mexican clinical laboratories · Multi-tenant SaaS · PWA

## 1. Executive Summary

Quimia IO is a cloud-based laboratory information system for small and medium clinical laboratories in Mexico. It manages the full daily cycle of a lab — patient registration, work orders, results capture and validation, delivery, and cash control — and adds two capabilities no incumbent in the segment offers: a **visual Kanban pipeline** that shows every active order's state with time-based alerts, and **altitude-adjusted reference ranges** grounded in Mexican clinical practice.

The product ships in three phases:

- **Phase 1 (17 weeks, fixed budget $32,000 MXN):** a complete single-lab system for the first client — a one-branch laboratory currently running on ToronjaLab — covering the operational core end to end.
- **Phase 2 (~14 weeks, indicative):** conversion into a replicable multi-tenant SaaS (`labname.quimiaio.com`) with subscription billing, WhatsApp delivery, equipment interfacing, business/convenio management, full reporting, inventory, and the CFDI 4.0 invoicing add-on.
- **Phase 3 (backlog):** appointments, imaging, EMR integrations, native apps, offline capture.

Subscription pricing (Phase 2 onward): **Reactivo** $799, **Clínico** $1,299, **Red** $2,099 MXN/month, plus **CFDI add-on** at $399 MXN/month.

## 2. Context and Problem

Small Mexican clinical labs run on aging desktop LIS products (the first client uses **ToronjaLab**) or spreadsheets. Common pain points, confirmed by market research (`research-market.md`):

- No visibility into where each order stands; delays are discovered when a patient complains, not before.
- Results delivery is manual (printed and picked up), while patients increasingly expect digital delivery.
- Incumbent vendors have opaque pricing, slow support, and weak regulatory follow-through (SAT/COFEPRIS changes).
- No product in the segment offers visual workflow tracking or automated altitude-adjusted reference ranges.

The first client relationship (a partner doctor's laboratory) gives Quimia IO a real operating lab as design partner and showcase for the SaaS phase.

**Starting point:** greenfield — no data migration from ToronjaLab is in scope. Catalog data (studies, analytes, prices) will be loaded fresh during onboarding. An optional paid migration service (patients and historical results from ToronjaLab exports) can be offered to the client as an add-on; it is not part of the Phase 1 budget. `[ASSUMPTION]` ToronjaLab can export data in a machine-readable format; to be verified only if the client requests migration.

## 3. Goals and Success Metrics

### Phase 1 goals (first client)

| # | Metric | Target |
|---|--------|--------|
| G1 | Go-live | Lab operating on Quimia IO by week 17 |
| G2 | Full adoption | All new orders processed exclusively in Quimia IO within 4 weeks of go-live; ToronjaLab retained read-only as the historical-results archive (record-retention obligations; no migration in scope) |
| G3 | Turnaround time (TAT) | Pre-go-live baseline measured on ToronjaLab during week-1 discovery; ≥20% median reduction in order-to-validated time by week 8 post-go-live `[ASSUMPTION — target to validate with client]` |
| G4 | Digital delivery | ≥90% of results delivered via portal or email by week 8 post-go-live |
| G5 | Cash discipline | 100% of operating days have opened/closed cash sessions; discrepancy incidents <2% of sessions |
| G6 | Data integrity | Zero data-loss and zero unauthorized data-exposure incidents (cross-tenant isolation becomes a measurable target in Phase 2, when a second tenant exists) |

### Phase 2 goals (SaaS launch)

| # | Metric | Target |
|---|--------|--------|
| G7 | Paying labs | 10 subscribed laboratories within 6 months of SaaS launch `[ASSUMPTION — founder to confirm ambition level]` |
| G8 | Revenue | MRR ≥ $15,000 MXN by month 6 post-launch `[ASSUMPTION]` |
| G9 | Churn | Monthly logo churn <5% |
| G10 | Onboarding | New lab fully operational in <1 week from signup |

### Counter-metrics (what must not degrade)

- **Result invalidation/recapture rate** must not rise above 5% — faster TAT cannot come at the cost of accuracy.
- **Order creation time** at reception must not exceed the ToronjaLab baseline (timed during the week-1 discovery visit, before go-live) — new features cannot slow the front desk.
- **Support load per lab** (Phase 2) must trend down after onboarding week; rising tickets signal usability debt.

## 4. Users and Roles

Single-branch lab, Phase 1. `[ASSUMPTION]` Staff of roughly 4–8 people and daily volume in the 30–80 orders/day range, typical for the segment; to be confirmed with the client during week 1 discovery.

| Role | Primary jobs | Phase 1 access |
|------|-------------|----------------|
| **Admin** (lab owner / partner doctor) | Oversight, configuration, reports, audit | Everything |
| **Recepcionista** | Register patients, create orders, take payments, deliver results, open/close cash | Reception, patients, cash, delivery |
| **Químico** | Capture results, validate, manage the analysis queue | Capture, validation, delivery, pipeline |

Phase 2 adds `administracion` (reports, cash, statements) and `gerente` (dashboards and reports, read-mostly) roles plus granular per-module permissions.

Patients are not system users: they receive results through a tokenized public portal link — no account, no login.

## 5. Scope and Phasing

Phasing decided by the product owner's directive: make Phase 1 a complete, high-quality single-lab system; defer SaaS mechanics and breadth to Phase 2; park adjacent domains in Phase 3. Nothing from the original scope is dropped — everything is placed.

### Phase 1 — Operational core (17 weeks)

Auth and roles (3 roles) · Configuration catalogs (studies, analytes with age/sex reference ranges, packages, methods, techniques, equipment, containers, sample types, PDF template) · Patients · Orders and payments · Doctors (basic) · Results capture (all analyte types) and validation, including live auto-capture from the client's 2 named instruments (FR-74a) · Kanban pipeline (fixed 45/90-minute alerts) · Delivery (PDF, email, patient portal via QR/token) · Cash control · Audit log (core events) · Dashboard (basic KPIs).

**Explicitly out of Phase 1 — invoicing.** The client issues facturas through an external accountant today, and few patients request one (confirmed with product owner). That channel continues unchanged through Phase 1; Quimia IO records payments but does not emit CFDI until the Phase 2 add-on. Retiring ToronjaLab does not depend on invoicing.

### Phase 2 — SaaS platform (~14 weeks, indicative)

Multi-tenant onboarding with subdomain routing · Subscription billing (Stripe) and plan gating (Reactivo/Clínico/Red) · WhatsApp delivery and notifications (Twilio) · Quotations (cotizaciones) · Companies/convenios with credit control and price lists · Doctor commissions and statements · Basic sales reports · Generalized equipment interfacing (FR-74b: CSV/HL7 fallback, new-instrument driver onboarding, bidirectional host-query per-instrument) and external PDF attachment · Full reporting and BI with charts · Reagent inventory (Red plan) · Multi-branch support and consolidated dashboard · CFDI 4.0 invoicing add-on · **Altitude-adjusted reference range engine** · Configurable Kanban alert thresholds · Granular permissions · Push notifications · Digital delivery signature.

`[ASSUMPTION]` Quotations and WhatsApp moved to Phase 2 to protect the 17-week budget; both are high-visibility, so if the client pushes back, they are the first candidates to trade into Phase 1 against something else.

`[ASSUMPTION]` Altitude adjustment deferred to Phase 2 because the first client operates at a single fixed altitude — reference values entered in Phase 1 are already local. The engine matters when the SaaS serves labs at different altitudes, and market research confirms it as a whitespace differentiator worth building well.

### Phase 3 — Adjacent domains (backlog, not scheduled)

Appointments/agenda · Imaging module · EMR/HIS integrations · Native mobile apps · Offline capture mode · Patient-facing mobile app · Home sample-collection logistics.

## 6. Functional Requirements

FR IDs are global and stable. Grouped by feature area; each group is tagged with its phase. IDs run FR-1 to FR-53 for Phase 1 and resume at FR-60 for Phase 2 (§6.12) — FR-54–59 is a reserved gap, not a missing block.

### 6.1 Authentication, Users and Roles — Phase 1

- **FR-1** Users sign in with nickname/email and password; sessions are tenant-scoped.
- **FR-2** Admin can create, edit, deactivate users and assign one of the predefined roles (admin, recepcionista, químico in Phase 1).
- **FR-3** Every screen and API enforces role-based access; unauthorized actions are blocked and logged.
- **FR-4** Password policy and account controls comply with NOM-024-SSA3 (complexity, no shared accounts). *(Phase 2 extends to granular per-module permissions — FR-70.)*

### 6.2 Configuration Catalogs — Phase 1

- **FR-5** Admin manages the study catalog: code, name, area, sample type, container, method, technique, equipment, patient preconditions, processing days, price, tax flag, and per-study print options for the results PDF.
- **FR-6** Admin manages the analyte catalog: code, name, result type (numeric, text, calculated, image, document, referenced), unit, decimals, default value, and formula for calculated analytes.
- **FR-7** Referenced analytes support multiple reference ranges segmented by age range (days/weeks/years) and sex. *(Altitude dimension added in Phase 2 — FR-78.)*
- **FR-8** Admin manages packages/profiles: a named group of studies sold at a package price, with its own preconditions and processing days.
- **FR-9** Admin manages supporting catalogs: methods, techniques, equipment (model, serial, calibration date), containers, sample types.
- **FR-10** Admin edits reference ranges inline from the analyte list; every change is recorded in the audit log with author and timestamp.
- **FR-11** Admin customizes the results PDF header: lab logo, name, address, phone, legal captions, responsible chemist signature.

### 6.3 Patients — Phase 1

- **FR-12** Reception creates patients with full name, birth date (age auto-calculated), sex, phone, email, optional CURP, address, optional photo.
- **FR-13** Patient search by name, phone, or order folio resolves in real time as the user types.
- **FR-14** Any field is editable; every edit is captured in the change log.
- **FR-15** Opening a patient with outstanding debt shows a prominent alert.
- **FR-16** Patient clinical history lists all results ordered by date, with a trend chart comparing repeated studies of the same type and out-of-range values flagged.
- **FR-17** A patient can be flagged "sample pending" (e.g., urine to be brought later); receiving the sample triggers the pending charge and routes the order to capture automatically.

### 6.4 Orders (Reception) — Phase 1

- **FR-18** Reception creates an order by finding or creating the patient inline, assigning a referring doctor (mandatory — confirmed 2026-07-31 with the product owner; the original "optionally" wording was a capture error, not a deliberate scope choice), and adding studies via instant search by code or name.
- **FR-19** Each order line shows catalog price; the price is editable for that order only — the catalog is never modified from reception.
- **FR-20** Orders support a percentage discount and per-line price overrides, both audit-logged.
- **FR-21** An order accepts up to three payment methods (cash, card, transfer, credit) in any combination; partial payment generates a tracked debt.
- **FR-22** Saving an order generates a unique per-tenant folio, a unique QR token (immutable across edits), and prints three document sets: (1) sample container/tube labels — one per analyte/container required, barcode or QR matching the folio/analyte for later scan-matching against instrument output; (2) payment ticket; (3) work-order template.
- **FR-23** Orders carry patient observations (fasting, medications) and patient conditions, visible to the chemist during capture.
- **FR-24** Cash-session gating: no order can be created in a branch without an open cash session (see FR-46). *(Quotations arrive in Phase 2 — FR-71.)*

### 6.5 Doctors — Phase 1 (basic)

- **FR-25** CRUD for referring doctors: name, specialty, professional license (cédula), phone, email, workplace, active flag.
- **FR-26** Orders can be filtered and listed by referring doctor with a date filter. *(Commissions and statements arrive in Phase 2 — FR-73.)*

### 6.6 Results Capture and Validation — Phase 1

- **FR-27** Chemist finds an order by folio, patient name, or date, and selects a study to capture.
- **FR-28** Capture supports all analyte types: numeric (with unit and range), text, calculated (formula evaluated automatically from captured analytes), image attachment (renders in PDF), rich-text document (renders in PDF), and referenced (range resolved by patient age/sex).
- **FR-29** Out-of-range values are highlighted automatically with a Normal/Low/High visual indicator. Values crossing critical (panic) thresholds — configurable per analyte — are flagged distinctly and require explicit acknowledgment by the validating chemist before validation completes. *(Automated critical-value notification/escalation arrives in Phase 2 — FR-83.)*
- **FR-30** Tab-key navigation moves between analytes for rapid keyboard capture.
- **FR-31** Validating a study marks it validated, records validator and timestamp, and advances the order in the pipeline when all its studies are validated.
- **FR-32** A validated result can be invalidated only with a mandatory reason; invalidation and recapture are fully audit-logged.
- **FR-33** Chemist can preview the results PDF before validating.
- **FR-34** Study display order in the final PDF is adjustable.
- **FR-35** The capture list color-codes each study: pending / in progress / validated. *(Live equipment interfacing for the client's 2 named instruments arrives in Phase 1 — FR-74a, below; generalized interfacing, bidirectional mode, and external PDF attachment remain Phase 2 — FR-74b/FR-75.)*
- **FR-74a** (Phase 1) Live unidirectional equipment interfacing: results from the client's confirmed instruments (Mindray BC-5150 hematology, Mindray BS-240Pro chemistry) post automatically into the matching order/analyte via each instrument's native host interface the instant the instrument produces them — no CSV drop, no manual re-entry. Químico only completes analytes the instruments don't report. Scoped to these two named instruments only. *(Protocol specifics: `addendum.md`.)*

### 6.7 Pipeline Kanban — Phase 1

- **FR-36** A board shows all active orders in five columns: Reception → Sample received → In analysis → Validated → Delivered. *(Phase 1 assumes in-house processing; send-out/maquila tracking and its board state arrive in Phase 2 — FR-84.)*
- **FR-37** Cards move by drag & drop; each card shows folio, patient, study chips, elapsed time, current responsible, and a color state.
- **FR-38** Time alerts: a card turns yellow after 45 minutes without advancing and red after 90 (thresholds fixed in Phase 1; configurable in Phase 2 — FR-79).
- **FR-39** The board filters by chemist and date and shows a live count per column.
- **FR-40** Clicking a card opens the full order detail.

### 6.8 Delivery and Patient Portal — Phase 1

- **FR-41** Delivery screen lists results filtered by date and state (ready, with debt, cancelled), color-coded: green ready, red debt/cancelled.
- **FR-42** Per result, staff can print the official PDF, email it (only when the patient consented to email delivery at registration — see NFR-3), or hand it over — delivery is recorded with timestamp, channel, and user.
- **FR-43** Debt gating: a result with outstanding balance cannot be printed or delivered until settled, except by explicit admin override (audit-logged). Balance can be settled from the delivery screen with multiple payment methods.
- **FR-44** Patient portal: each order's QR/token resolves to `quimiaio.com/r/{token}` — a public page (no account) that requires the viewer to confirm the patient's date of birth before rendering patient name, date, studies, and results with indicators, plus PDF download. Token policy is configurable: single-use or time-expiring (24h / 7 days).
- **FR-45** Delivery history shows the patient's previous comparable results. *(WhatsApp delivery, push notifications, and on-screen signature arrive in Phase 2 — FR-72/80/81.)*

### 6.9 Cash Control (Caja) — Phase 1

- **FR-46** A cash session must be opened (with initial fund, user, branch) before any order can be created that day in that branch.
- **FR-47** Every payment registers against the open session; manual in/out movements with a concept are supported.
- **FR-48** Closing produces a summary by payment method, theoretical vs counted totals, difference (over/short), per-seller detail, and a closing PDF.
- **FR-49** Historical sessions are queryable and exportable (PDF/Excel).

### 6.10 Reports — Phase 1 (basic)

- **FR-50** Sales report by period (day/week/month/custom range) with totals by payment method and by seller, exportable to Excel/PDF.
- **FR-51** Dashboard shows today's KPIs: orders, revenue, pending results, delivered studies, a 7-day revenue chart, top-5 studies, a mini pipeline summary (order counts per Kanban column), and active alerts (debts, pending samples, time-critical orders), with quick actions (new order, capture, delivery). *(Full BI — by study, doctor, company, branch — arrives in Phase 2: FR-76.)*

### 6.11 Audit Log — Phase 1 (core events)

- **FR-52** The system immutably records: result invalidations (with reason), order price changes and discounts, user creation/deactivation/deletion, cash session open/close, reference-range edits, admin debt overrides — each with actor, timestamp, and before/after values.
- **FR-53** Audit log is queryable by admin only, filtered by date and user.

### 6.12 Phase 2 Requirements — SaaS platform

- **FR-60** Tenant provisioning: a new lab signs up, gets `labname.quimiaio.com`, and configures branding and catalogs through guided onboarding.
- **FR-61** Row-level tenant isolation: no query, report, export, or portal link can expose another tenant's data.
- **FR-62** Subscription billing via Stripe with the three plans (Reactivo $799 / Clínico $1,299 / Red $2,099 MXN/month) and the CFDI add-on ($399); plan limits (branches, users, modules) are enforced automatically.
- **FR-63** Landing (`quimiaio.com`) and app entry (`app.quimiaio.com`) with public tier pricing — pricing transparency is a deliberate positioning choice against "contact sales" incumbents.
- **FR-70** Granular per-module permissions and the `administracion` and `gerente` roles.
- **FR-71** Quotations: create without charging, send as PDF (email/WhatsApp), retrieve by quote number, convert to order in one click; unconverted quotes auto-archive after 30 days.
- **FR-72** WhatsApp (Twilio): automatic messages on order creation, validation (with portal link), and physical delivery; manual send with editable message and PDF or link attachment.
- **FR-73** Companies/convenios: CRUD with RFC and type (Empresa/Laboratorio), credit management (limit, available balance, alerts), exclusive price lists per company, per-company commission %, account statements; doctor commissions (% of referred sales) with period statements and optional doctor-specific price lists.
- **FR-74b** (Phase 2) Generalized equipment interfacing: CSV/HL7 batch import as fallback for instruments without a live driver; onboarding flow to add a driver per new brand/model as clients come on. Bidirectional (host-query — LIS sends worklist/order TO the instrument) deferred here, scoped per-instrument only when a specific client's workflow requires it.
- **FR-75** Attach external equipment PDFs to a result.
- **FR-76** Full reporting: sales by study, doctor, company, branch, seller, payment method; relation tables (doctors, companies, folios); interactive charts; multi-branch consolidated dashboard (Red plan).
- **FR-77** Reagent inventory (Red plan): stock catalog, minimum-stock alerts, automatic consumption per study (configurable), purchases, manual outflows, consumption reports.
- **FR-78** Altitude-adjusted reference ranges: reference ranges gain an altitude dimension; the lab's configured altitude (city catalog with msnm) automatically resolves the correct range. Flagship differentiator — no competitor automates this.
- **FR-79** Configurable Kanban alert thresholds per lab.
- **FR-80** Push notification to the patient when results are ready.
- **FR-81** Digital received-signature on delivery (touch screen).
- **FR-82** CFDI 4.0 add-on: generate CFDI from any order with the full receptor tax data CFDI 4.0 validates (RFC, razón social, código postal fiscal, régimen fiscal, uso de CFDI), automatic stamping via certified PAC, PDF+XML download, cancellation, issued-invoices report; SAT product key 85121800 preconfigured (verified valid for clinical laboratory services).
- **FR-83** Critical-value escalation: configurable notification (in-app, and via the Phase 2 messaging channels) to the responsible chemist/admin when a critical value is captured, with acknowledgment tracking.
- **FR-84** Send-out (maquila/subrogación) management: mark studies as sent to an external reference lab, track destination and expected return date, capture externally produced results (manual entry or PDF attachment), and represent the send-out state on the Kanban board.

## 7. Non-Functional Requirements

- **NFR-1 Tenant isolation.** Phase 1 ships tenant-ready: every table carries `tenant_id` and database-enforced row-level security policies are active from day one, while the system serves a single tenant. Phase 2 (before onboarding a second lab) adds the automated cross-tenant isolation test suite; from that point a cross-tenant read is a release-blocking defect.
- **NFR-2 Compliance (NOM-024-SSA3).** Role-based access control, full audit traceability of modifications, periodic backups, and password complexity are mandatory system behaviors, not options.
- **NFR-3 Privacy (LFPDPPP 2025).** Health data is sensitive data under the new Ley Federal de Protección de Datos Personales en Posesión de los Particulares (DOF 2025-03-20, replacing the 2010 law; supervisory authority is now the Secretaría Anticorrupción y Buen Gobierno, not INAI): privacy notice presented at patient registration, explicit consent captured, ARCO rights supported operationally (export/rectify/delete patient data on request), encryption in transit and at rest. Privacy-notice text, named authority, and ARCO response deadlines are configurable content, not hardcoded — final wording is lawyer-reviewed before go-live (OQ-6). Where NOM-mandated record retention applies, deletion requests are deferred until the retention period lapses, with the refusal reason logged.
- **NFR-4 Availability.** The lab cannot operate without the system (cash gating, capture). Target 99.5% business-hours availability; graceful degradation messaging when offline. `[ASSUMPTION — formal SLA to be agreed for SaaS phase]`
- **NFR-5 Performance.** Patient/study search results render under 300 ms perceived; order creation end-to-end under 2 minutes for a routine 3-study order; Kanban board updates reflect state changes within 5 seconds.
- **NFR-6 Mobile-first PWA.** Every screen is usable on a phone; reception and delivery flows are optimized for tablet/desktop, portal for phone.
- **NFR-7 Auditability.** Audit records are append-only and immutable; no admin can edit or delete them.
- **NFR-8 Data durability.** Automated daily backups with tested restore; results and audit data retained per NOM-007/NOM-024 record-keeping obligations.
- **NFR-9 Language.** UI in Spanish (Mexico). All monetary values in MXN.

## 8. Regulatory Landscape

| Norm | What it demands of the product |
|------|-------------------------------|
| **NOM-007-SSA3-2011** | Lab operation record-keeping: studies, results, incidents, equipment maintenance. The audit log and equipment catalog (calibration dates) support these obligations. Check final status of PROY-NOM-007-SSA3-2017 (open question OQ-2). |
| **NOM-024-SSA3-2012** | Health information systems: RBAC, audit trail, backups, password policy → NFR-2. |
| **LFPDPPP (2025)** | New privacy law (DOF 2025-03-20) replaced the 2010 LFPDPPP; INAI dissolved — authority is the Secretaría Anticorrupción y Buen Gobierno. Privacy notice, ARCO rights, consent → NFR-3. Reglamento pending; legal copy parametrized and lawyer-reviewed (OQ-6). |
| **CFDI 4.0 (SAT)** | Electronic invoicing with strict buyer tax-data validation; product key 85121800 (verified: valid SAT key for clinical laboratory services) → FR-82 (Phase 2 add-on). During Phase 1 the client's invoicing remains on its existing external accountant channel. |

## 9. Competitive Positioning

From `research-market.md` (2026): incumbents in the segment (DevelLab, Nubelab, SASS, Interlab, Syslabs, and regional players) compete on cloud access, modularity, and WhatsApp delivery — which is now table stakes, not a differentiator. Quimia IO's positioning:

1. **See your lab** — the Kanban pipeline with time alerts; no competitor offers visual workflow tracking.
2. **Clinically correct by geography** — altitude-adjusted reference ranges; unautomated by any incumbent despite solid clinical grounding.
3. **Honest pricing** — public MXN tiers against an industry of "contact sales" quotes.
4. **Compliance kept current** — NOM/SAT alignment as a maintained product commitment, answering the most common incumbent complaint.

WhatsApp delivery, patient portal, and CFDI must be executed well, but they are parity features, not the pitch.

## 10. Business Model

- **Phase 1:** fixed-price project for the first client ($32,000 MXN, 17 weeks). The client's lab becomes the reference installation.
- **Phase 2 onward:** subscriptions — Reactivo $799 (1 branch, 3 users, core modules), Clínico $1,299 (1+1 branches, unlimited users; adds Kanban, WhatsApp, QR portal), Red $2,099 (up to 5 branches, consolidated dashboard, inventory), CFDI add-on $399. Prices confirmed unchanged by product owner.
- Optional paid services: ToronjaLab data migration, onboarding assistance, custom PDF template design. `[ASSUMPTION — service pricing TBD]`

## 11. Release Plan and Timeline

### Phase 1 — 17 weeks

| Weeks | Milestone |
|-------|-----------|
| 1–2 | Foundations: auth, roles, app shell, tenant scaffolding. Week-1 discovery visit: confirm staff count, daily volume, equipment inventory, TAT baseline expectations |
| 3–5 | Configuration catalogs: studies, analytes, reference ranges, packages, supporting catalogs, PDF template |
| 5–7 | Patients + Orders + payments + folio/ticket + cash-session gating |
| 8–10 | Results capture (all analyte types), calculations, validation/invalidation |
| 10–12 | Kanban pipeline + Dashboard KPIs |
| 12–13 | Delivery: PDF engine, email, patient portal (QR/token) |
| 13–14 | Cash control complete + basic reports + audit log |
| 15–16 | UAT with lab staff, catalog data load, training |
| 17 | Go-live + hypercare |

Weeks 5 and 10 overlap intentionally: catalog work and capture work stream in parallel with order-flow hardening. `[ASSUMPTION]` Single developer (Jesús Cerritos); timeline assumes no scope additions mid-phase — trade, don't add.

### Phase 2 — ~14 weeks (indicative, to be re-planned after Phase 1 retro)

| Weeks | Milestone |
|-------|-----------|
| 1–4 | Multi-tenant infrastructure, subdomain routing, Stripe billing, plan gating, landing |
| 5–8 | WhatsApp (Twilio), quotations, companies/convenios, doctor commissions |
| 9–11 | Equipment interfacing (CSV/HL7), full reporting/BI |
| 12–14 | Inventory, multi-branch, CFDI add-on, altitude engine |

### Phase 3 — unscheduled backlog

Prioritized after Phase 2 launch based on subscriber demand.

## 12. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Phase 1 scope vs. 17-week solo estimate (adversarial review sized it 2–3x; accepted on the product owner's AI-assisted-velocity assumption) | Timeline overrun on a fixed-price commitment | Accepted risk. Tripwire: at week 8, ≥50% of Phase 1 FR groups (§6.1–6.11) must be implemented and client-demoed; if not, invoke the trade-not-add rule and move the lowest-priority groups to a client-agreed Phase 1.5 |
| Unknown lab operating parameters (staff, volume, equipment) | Wrong sizing of flows | Week-1 discovery visit; targets marked `[ASSUMPTION]` revisited then (see Assumptions Index, §13) |
| Scope pressure from client during Phase 1 | 17-week budget blown | Phasing contract in this PRD; trade-not-add rule; quotations/WhatsApp identified as first trade candidates |
| Twilio WhatsApp Business approval lead time | Phase 2 delivery slips | Start Meta/Twilio approval process during Phase 1 |
| PAC/CFDI integration complexity | Add-on delayed | CFDI isolated as an add-on; ship Phase 2 core without it if needed |
| Single-developer bus factor | Delivery stalls | SDD discipline + this PRD + architecture docs keep the project transferable |
| Solo lab data-entry burden (catalogs) | Slow onboarding | Package catalog templates; consider pre-loaded common study/analyte library `[ASSUMPTION — worth building in Phase 2 for SaaS onboarding]` |

## 13. Open Questions

- **OQ-1** Lab staff count, daily order volume, and actual analyzer models — resolve in week-1 discovery visit.
- **OQ-2** Final status of PROY-NOM-007-SSA3-2017 (update to NOM-007) — verify before Phase 1 UAT.
- **OQ-3** Does the first client want the optional ToronjaLab migration service? Depends on ToronjaLab export capability.
- **OQ-4** Phase 2 SaaS goals (G7/G8) — founder to confirm ambition and marketing plan before Phase 2 kickoff.
- **OQ-5** Formal availability SLA for SaaS subscribers (NFR-4).
- **OQ-6** LFPDPPP 2025: final ARCO response deadlines and the pending Reglamento; privacy-notice legal copy to be lawyer-reviewed before Phase 1 go-live.

### Assumptions Index

Every `[ASSUMPTION]` tag in this document, for at-a-glance tracking. Most resolve at the week-1 discovery visit or the Phase 1 retro; the rest are flagged for Phase 2 planning.

| # | Section | Assumption | Revisit condition |
|---|---------|-----------|--------------------|
| A1 | §2 Context | ToronjaLab can export data in a machine-readable format | Only if the client requests migration (OQ-3) |
| A2 | §3 G3 | ≥20% TAT reduction is the right target | Week-1 discovery visit |
| A3 | §3 G7 | 10 subscribed labs within 6 months of SaaS launch | Before Phase 2 kickoff (OQ-4) |
| A4 | §3 G8 | MRR ≥ $15,000 MXN by month 6 post-launch | Before Phase 2 kickoff (OQ-4) |
| A5 | §4 Users and Roles | Staff of 4–8 people; 30–80 orders/day | Week-1 discovery visit (OQ-1) |
| A6 | §5 Phase 2 scope | Quotations and WhatsApp deferred to Phase 2 | Ongoing during Phase 1 — first trade candidates if the client pushes back |
| A7 | §5 Phase 2 scope | Altitude adjustment deferred to Phase 2 | Phase 2 planning |
| A8 | §7 NFR-4 | Formal availability SLA still to be agreed | Before Phase 2 kickoff (OQ-5) |
| A9 | §10 Business Model | Pricing for optional paid services (migration, onboarding, custom PDF) | When the client requests one of these services |
| A10 | §11 Release Plan | Single developer; no mid-phase scope additions | Phase 1 retro |
| A11 | §12 Risks | Pre-loaded study/analyte library worth building | Phase 2 backlog grooming |

### Glossary of Spanish Domain Terms

Spanish terms kept as-is in the English text because they name a role, document, or concept specific to the Mexican lab domain — translating them would lose precision for the client and dev team.

| Term | Meaning |
|------|---------|
| Folio | Unique sequential order/receipt number |
| Caja | Cash session/register (open, close, reconcile) |
| Recepcionista | Front-desk role: registers patients, creates orders, takes payments |
| Químico | Lab chemist role: captures and validates results |
| Convenio | Corporate/company billing agreement with credit terms and price lists |
| Cotización | Quotation issued before an order is created |
| Maquila / subrogación | Sending a study to an external reference lab for processing |
| Gerente | Manager role (Phase 2): dashboards and reports, read-mostly |
| Cédula | Professional license number (used for referring doctors) |
| msnm | Meters above sea level — the unit behind altitude-adjusted reference ranges |
