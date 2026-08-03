---
name: Quimia IO
status: final
sources:
  - '{planning_artifacts}/prds/prd-quimiaio-2026-07-05/prd.md'
  - '{planning_artifacts}/prds/prd-quimiaio-2026-07-05/addendum.md'
  - '{planning_artifacts}/sprint-change-proposal-2026-07-27.md'
  - '{planning_artifacts}/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md'
updated: 2026-08-02
---

# Quimia IO — Experience Spine

> Multi-tenant clinical-lab SaaS (LIS) for Mexican labs. Paired with `DESIGN.md` (Hybrid Slate). Phase 1: Admin, Recepcionista, Químico. Phase 2 adds Administración, Gerente, multi-branch (Red plan), and CFDI invoicing. Four key screens are rendered under `mockups/` (Dashboard, Captura, Kanban, Critical-overlay) — this spine wins over any mock where the two disagree.

## Foundation

Mobile-first PWA (NFR-6): every screen must remain usable on a phone. Reception and delivery flows are specifically optimized for tablet/desktop — their primary, all-day work surface. The patient portal is specifically optimized for phone — it is nearly always opened from a WhatsApp/SMS link or a printed QR code on a mobile device. `DESIGN.md` is the visual identity source for every token referenced below (`{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`, `{components.*}`).

Multi-tenant shell: `quimiaio.com` (marketing landing), `app.quimiaio.com` (SaaS login entry), `{lab}.quimiaio.com` (tenant-specific subdomain, the actual working surface for lab staff). The patient portal lives outside the tenant shell entirely, at `quimiaio.com/r/{token}` — public, no login, reachable independent of which tenant subdomain issued it.

Single-branch labs (Phase 1 default) and multi-branch lab networks (Phase 2, Red plan) share the same shell; branch-scoping (Caja, Kanban, orders) is additive, not a fork of the IA.

## Information Architecture

| Surface | Reached from | Purpose | Phase |
|---|---|---|---|
| Dashboard | Login / sidebar | Daily KPIs, mini pipeline, critical-value alert, quick actions — the flagship view. "Quick actions" render as a live-styled preview of the Recepción intake form (already focused on its first field) beside Órdenes recientes, not a menu of buttons — see `mockups/key-dashboard.html` | 1 |
| Pacientes | Sidebar | Patient registration, edit-with-changelog, clinical history + trend charts, "muestra pendiente" flag | 1 |
| Recepción / Órdenes | Sidebar (⭐ most-used) | Create/manage work orders; Cotizaciones sub-flow | 1 (Cotizaciones: 2) |
| Pipeline Kanban | Sidebar (⭐ flagship differentiator) | 5-column board of every active order, time-based alerts | 1 |
| Captura de Resultados | From Kanban card / folio search | Chemist enters/validates analyte results per study | 1 |
| Entrega de Resultados | From Kanban card / sidebar | PDF print, email, WhatsApp, portal link; settle debt | 1 (WhatsApp: 2) |
| Doctores | Sidebar | Referring-physician CRUD, price lists, commissions | 1 (statements: 2) |
| Empresas | Sidebar | Corporate billing agreements, credit control, price lists | 1 (full commission/statement: 2) |
| Caja | Topbar chip / sidebar | Per-branch cash session open, corte de caja, reconciliation | 1 |
| Reportes y Análisis | Sidebar | Sales reports, relationship tables, multi-branch dashboard | 1 basic, 2 full |
| Usuarios y Roles | Sidebar (Admin only) | User CRUD, role/branch assignment, permission matrix | 1 (matrix: 2) |
| Configuración | Sidebar (Admin only) | Estudios, Analitos, Paquetes, Métodos, Equipos, Plantillas PDF, alert thresholds, etc. | 1 |
| Inventario de Reactivos | Sidebar | Reagent stock, min-stock alerts, consumption | 2 |
| Auditoría / Bitácora | Sidebar (Admin only) | Immutable change log, filterable | 1 |
| Facturación CFDI | Sidebar | SAT e-invoicing | 2 |
| Portal del Paciente | `quimiaio.com/r/{token}` (external link) | Patient views own results, DOB-gated, no login | 1 |

Sidebar is dark-chrome (`{colors.navy}`), always visible on desktop/tablet; collapses to an off-canvas drawer on phone (see Responsive & Platform). The Caja state and branch switcher live in the topbar (`{colors.navy-topbar}`), not the sidebar, because they're session-scoped state, not navigation.

## Voice and Tone

UI copy is Spanish (Mexico); every monetary value renders in MXN (NFR-9). Tone is professional and trustworthy, never playful — this matches the brand's "soft, professional, reliable, serious" posture from `DESIGN.md.Brand & Style`. Regulated surfaces (consent, ARCO rights, audit log) use precise, formal Spanish — this is compliance language, not marketing copy.

| Do | Don't |
|---|---|
| "Caja abierta · desde 07:58 am" | "¡Ya puedes empezar a vender! 🎉" |
| "Valor crítico sin confirmar — Potasio 6.8 mEq/L" | "¡Alerta! Algo anda mal con este resultado" |
| "Adeudo — entrega bloqueada" | "Ups, este paciente todavía debe" |
| "Guardado (borrador)" / "Validado por Dr. Aarón Solís · 14:32" | "✓ Listo!" |
| State names match the Kanban column labels verbatim (Recepción, Muestra recibida, En análisis, Validado, Entregado) everywhere they appear — table pills, filters, notifications | Paraphrase pipeline-state names differently on different screens |

## Component Patterns

Behavioral specs only — visual specs (color, radius, shadow) live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| **Evidence gallery** (image-analyte) | Captura, image-type analytes (equipment charts, antibiogram PDFs) | "Agregar evidencia" opens an in-app crop tool over the uploaded PDF/image — no external screenshot step. Crop auto-fits to one of 2–3 preset sizes matched to the report's column width; no manual pixel width/height entry. The analyte holds a **list** of evidence items, not a single image — each item has an optional caption label (e.g. "Antibiograma — E. coli"). Items are drag-reorderable; print order follows gallery order. Preview is live and report-accurate (what's shown while capturing is what prints). Designed explicitly to handle a culture growing 1, 2, or 3+ organisms without a delete/re-upload cycle. Keyboard-equivalent: Tab to focus a gallery item, then Ctrl+↑ / Ctrl+↓ moves it — no mouse required (see Accessibility Floor). See `mockups/key-captura.html` for a rendered reference of the gallery in use. |
| **Constrained document editor** (document-analyte) | Captura, document-type analytes (chemist interpretations/observations) | WYSIWYG limited to bold, italic, lists, and headings — only formatting the PDF template can actually render; no option is offered that can't survive export. Editor renders at the same font and column width as the final PDF, so the capture view *is* the preview, not an approximation of it. A snippet/phrase picker inserts predefined common-interpretation text to reduce retyping. |
| **Study reorder** (drag-and-drop) | Captura, order-level study list | Same drag interaction as the evidence gallery, applied one level up: the list of studies on an order (not the evidence within one study) is drag-reorderable to control print order in the final PDF. Kept visually and behaviorally identical to the gallery pattern so chemists learn the gesture once. Same keyboard-equivalent as the evidence gallery: Tab to focus a study, then Ctrl+↑ / Ctrl+↓ to move it (see Accessibility Floor). |
| **Correction history popover** (results capture) | Captura, every analyte field | An inline icon next to each analyte opens a small popover scoped to that analyte's own change history (who changed it, when, before-value → after-value). This is the fast, in-context surface for spot-checking one value; it complements — does not replace — the system-wide Auditoría/Bitácora log (module 14, admin-only, filterable across all entities). Both surfaces read the same underlying change record. See `mockups/key-critical-overlay.html` for a rendered reference. |
| **Reference range annotation** (results capture) | Captura, every analyte field | The numeric reference range renders next to (or directly below) every analyte's entered value at all times — e.g. "14.2 g/dL (12.0–15.5)" — regardless of whether the value is in or out of range. This is a precision/trust surface the chemist relies on to judge decimal-vs-integer precision and valid bounds at a glance; it is never hidden behind hover or click, and sits alongside (not instead of) the Normal/Low/High status highlight. |
| **Analyte source tag** (FR-74a) | Captura, every analyte field | A small pill (`{components.analyte-source-tag}`) next to the analyte label marks where its value came from: `Automático` for a value the interfaced instrument (BC-5150 hematology, BS-240Pro chemistry) posted directly, `Calculado` for a derived analyte (e.g. LDL). A manually-typed value carries no tag at all — the absence is the "manual" signal, so the same visual language works whether the analyte sits in a fully-manual study or is the one analyte an instrument didn't report inside an otherwise-interfaced study (FR-74a: "Químico only completes analytes the instruments don't report" — see Flow 2). The tag never locks the field: a químico can still correct an `Automático` value if the instrument mis-read something, and that edit writes the same correction-history record as any manual change (see State Patterns). |
| **Order print-preview panel** (FR-22) | Recepción/Órdenes, on Guardar | Saving an order opens a compact preview panel (`{components.print-preview-panel}`) — a lightweight overlay, not a full modal — listing exactly what's about to print: one container/tube label per label the order's studies require (each showing which study/analyte it's for and its catalog-defined tube color), the payment ticket, and the work-order template. Paola confirms to print all three at once, or cancels to fix something first — e.g. a wrong tube color from a miscatalogued study — before anything reaches the printer. Replaces the previous silent single-ticket print; the extra tap is a deliberate trade against printing a wrong or incomplete label set. |
| **Signature pad** (Firma de recibido digital) | Entrega de Resultados, in-person hand-off (Phase 1) | At in-person delivery, the patient signs on a touchscreen to confirm receipt — a digital signature capture step. Accepts touch or stylus input; a "Borrar / Reintentar" control clears the pad without leaving the screen. The captured signature is stored with a timestamp and tied to the specific order/folio being delivered. Applies only to the in-person hand-off path — it does not gate or apply to the print/email/WhatsApp delivery channels. |
| **Kanban card** | Pipeline board | Five states only (see State Patterns). Card color/ring communicates aging via `{components.kanban-card-aging}`; state is never signaled by color alone — the column itself and a text timestamp always co-locate with the color cue. Cards are also draggable between columns, but only as a correction/override of an automatic transition (see State Patterns) — never the normal advancement path — and every manual drag writes its own Auditoría/Bitácora entry. A card whose order carries a logged result correction shows a small inline note (e.g. "↺ 1 corrección registrada — TSH") directly on the board — a lightweight surface of the fact a correction exists, complementing rather than replacing the full per-analyte detail in the Captura correction-history popover. See `mockups/key-kanban.html`. |
| **Permission matrix** (Phase 2) | Usuarios y Roles → role editor | Grouped by module, not a flat rol×permiso grid: each module (Pacientes, Órdenes, Captura, Entrega, Caja, Reportes, Relaciones, Doctores, Empresas, Usuarios, Configuración, Precios) renders as a header with its ~2–4 action toggles nested underneath (e.g. Pacientes → Nuevo paciente / Modificar paciente / Historial). Bulk module-level "select all" toggle per header. |
| **Branch switcher** (Phase 2, Red plan) | Topbar chip | Dropdown, not a page navigation. Trigger reads "Viendo: Sucursal Polanco ▾"; menu lists every branch plus a "Todas las sucursales" option that switches the Dashboard/Reportes into a consolidated multi-branch view. Switching branch does not log the user out; the cash-status chip reflects the selected branch's own session — each branch opens and closes its cash session independently, once per calendar day (see State Patterns). |

## State Patterns

**Pipeline (order/study), 5-column Kanban** — Recepción → Muestra recibida → En análisis → Validado → Entregado.

| State | Trigger to enter | Trigger to leave |
|---|---|---|
| Recepción | Order created (Caja gate passed, payment recorded) | Sample physically received (or immediately, if no pending sample) |
| Muestra recibida | Sample received; if order was flagged "muestra pendiente," receiving it also triggers the pending charge | Chemist opens the order in Captura |
| En análisis | Any study on the order is unvalidated | Every study on the order has been validated |
| Validado | All studies validated | Delivery recorded (print/email/WhatsApp/hand-off) |
| Entregado | Delivery recorded, with timestamp/channel/user | Terminal state |

**Manual Kanban drag is correction-only, not the normal flow** — normal advancement between the five columns above is always automatic, driven strictly by the business events in the table (sample receipt, full-order validation, delivery). A card can also be dragged directly to a different column, but that exists solely as a correction/override mechanism for fixing a miscategorized or stuck order — it is never the expected day-to-day path, and the UI does not treat it as one. Every manual drag produces its own audit-log entry (who, when, from-state, to-state), joining the invalidate/recapture and admin-override events already required in the Auditoría/Bitácora log (module 14, FR-52).

**Per-study validation, inside En análisis/Validado** — an order can hold several studies at different sub-states simultaneously; the order-level Kanban column reflects the *least advanced* study still open. Each study is its own block with a single **Validar** action that validates every analyte in that study at once (not per-analyte). A validated study becomes patient-portal-visible immediately — but only if the order is paid (see debt-gate below); the patient is notified per study as each becomes available (e.g. biometría today, urine culture in 3 days), not only once at full-order completion.

**Guardar vs. Validar** — Guardar writes an internal draft, never patient-visible regardless of payment state. Validar is the only action that can make a study patient-visible, and only after payment clears. A validated study can only be invalidated via a mandatory logged reason, then recaptured — this event is one of the required audit-log entries (FR-52).

**Calculated-analyte recalculation invalidates the study** — a calculated/derived analyte (e.g. LDL derived from colesterol total + HDL + triglicéridos) is computed from its own input analytes rather than typed directly. If a químico corrects one of those input analytes after the containing study was already validated, the derived value auto-recalculates immediately, and — reusing the same invalidate-with-mandatory-reason-then-recapture rule above — the whole study is automatically invalidated, forcing re-validation before it can be patient-visible again. This closes the client's own flagged open question on how calculated-analyte capture is handled.

**Correction/change history** — every result edit (interfaced or manual, including a post-validation correction) records who/when/before/after. This is a currently-missing capability the chemist explicitly asked for and the lab needs for its ISO 15189 pursuit; treat it as a hard requirement on the results-capture surface, not an optional nice-to-have. Surfaced via the inline per-analyte history icon (**Correction history popover**, see Component Patterns for the full mechanism).

**Debt-gate states** — opening a patient record with outstanding debt shows a prominent alert (FR-15). Delivery (print/email/WhatsApp/hand-off) is blocked while any balance is unsettled, with one exception: an explicit, audit-logged admin override (FR-43). The patient portal enforces the same gate independently, but — corrected 2026-08-02, during `bmad-create-epics-and-stories` story-writing — a validated-but-unpaid study is **visible but blocked**, not withheld: the patient sees that the study exists and is validated, with a fixed message — "Resultado con saldo pendiente, pase a liquidar sus estudios." — in place of the result detail/PDF download, which unlock the moment the balance clears. This nudges toward payment instead of hiding the study's existence entirely. Paid and validated are still both required, checked independently per study.

**Critical-value acknowledgment** — a result crossing a configurable panic threshold is flagged distinctly (visual treatment lives in `DESIGN.md.Components`, the dashboard `critical-alert` pattern) and blocks study validation until the validating chemist performs an explicit acknowledgment action (FR-29). Acknowledgment is a deliberate extra step, not a passive dismiss — it must be attributable to a specific chemist for the audit trail. While blocked, the study's other analyte rows dim (reduced opacity) and the blocking analyte's own row is highlighted with a light tint background, directing attention to the one field that needs action before the rest of the study is reachable (see `mockups/key-critical-overlay.html`).

**Offline / connectivity loss (PWA floor, NFR-6)** — capture and intake forms (Captura, Recepción/Órdenes) keep locally-entered data in place when connectivity drops and show a persistent "Sin conexión — no se ha guardado" banner that blocks Guardar/Validar until the connection returns, so nothing typed is lost but nothing new reaches the server either. Read-only surfaces (Dashboard, already-loaded lists) may keep showing their last-loaded data with a "Última actualización hace X" indicator instead of blocking the view.

**Empty / cold-load states** — Dashboard with zero orders yet today shows the KPI cards at 0 with an encouraging empty-pipeline message rather than blank cards; Pacientes search with no results shows a "crear paciente nuevo" shortcut inline rather than a dead end. Other IA surfaces are out of scope for empty-state detail at spine granularity.

**Patient portal token policy (FR-44)** — Phase 1 ships a 7-day expiring token per order, not single-use and not the 24h option also allowed by the PRD; this lets a patient or referring doctor reopen the same results link within the week without requesting a new one. Opening an expired link shows a clear "Enlace expirado" message with no clinical content, directing the patient back to the lab (or the original delivery channel) to request a fresh link — no in-portal re-issuance flow.

**Cash session (Caja) state** — per branch, one active cash session per branch per 24h calendar day. This reconciles cleanly with PRD FR-46's per-branch gate — there is no PRD conflict. Each shift (matutino 7am–3pm, vespertino 2:30pm–10pm, nocturno/urgencias) can have 2–3 people working simultaneously at a branch, but only one of them triggers the day's opening. Lazily triggered: whichever user is first to register a patient or order at that branch starting at 00:00 that calendar day opens the branch's caja (if no overnight urgencias, this is typically the first person of the 7am matutino shift); once opened, it runs for everyone at that branch for the rest of the day — nobody else at that branch is prompted, regardless of shift changes. Shift labels are **display metadata only** — shown alongside who registered what and when — and never gate order creation or Caja opening. Corte de caja (close) is a user-initiated action, typically run in the afternoon before a break: count the drawer, leave a fondo/change amount for the next day, available any time — not tied to a shift boundary.

## Interaction Primitives

- **Keyboard-first capture (FR-30)** — Tab moves between analyte fields in Captura; this is a hard requirement, not a nice-to-have, directly answering the "slow mouse-dependent capture flow" anti-pattern. Reception order-entry is equally keyboard-driven end to end (Tab/arrows/Enter) per the same anti-pattern finding.
- **Instant/fuzzy search (NFR-5)** — patient search (by name, phone, or folio — FR-13) and study search in order composition both resolve perceived-instantly, under 300ms, as the user types. No explicit "search" button/submit step.
- **Drag-and-drop** — the evidence gallery and the study-reorder list (Component Patterns above) share one drag gesture, learned once and reused. Both also share the same keyboard equivalent — Tab to focus, then Ctrl+↑ / Ctrl+↓ to move (see Accessibility Floor). No other surface introduces a competing drag-to-reorder pattern in Phase 1 — the Kanban board's card drag is a distinct, correction-only override gesture (see State Patterns), not a reordering interaction, so it doesn't compete with this shared gesture.
- **Debt/critical alerts as blocking, not ambient** — unlike a typical toast/banner, the debt-gate and critical-value states actively prevent the next action (delivery, validation) rather than merely displaying a warning the user can ignore — this is a deliberate escalation over "just show a badge," because the cost of missing either is clinical or financial, not cosmetic.

## Accessibility Floor

WCAG 2.1 AA is the floor (contrast values live in `DESIGN.md`'s Accessibility note under Do's and Don'ts — the gray and ok-text pairs are both now resolved to clear 4.5:1).

- **Keyboard navigation** is complete, not partial: every action reachable by mouse (validate a study, reorder the evidence gallery, dismiss/acknowledge a critical value, switch branch) must have a keyboard path. Captura's Tab-order follows the analyte list top-to-bottom as rendered, matching the printed report's reading order.
- **Focus states are always visible** — the pill-input focus ring (`{components.input-pill}`, accent border + accent-lt glow) is the one focus treatment used everywhere; no component may suppress the outline without supplying an equally visible substitute.
- **RBAC is visible, not silent** (NOM-024-SSA3 / NFR-2, FR-3) — an action a role cannot perform is shown disabled with a reason (e.g. a Recepcionista cannot see a "Validar" button rendered active-but-inert; it does not appear, or it appears visibly locked) rather than silently doing nothing on click.
- **Drag-and-drop has a keyboard equivalent** — both the evidence gallery and study-reorder list are fully operable without a mouse: Tab focuses the item in the list, then **Ctrl+↑ / Ctrl+↓** moves it up or down one position — the same end result as dragging. A chemist working keyboard-first end to end is never forced to reach for a mouse to reorder a report.
- **Screen-reader considerations** — Kanban card aging/critical state must be announced (not color-only): e.g. an `aria-label` stating "En análisis, 96 minutos, fuera de rango" rather than relying on the red tint alone. Status pills carry text labels always, never icon-only.

## Inspiration & Anti-patterns

Three anti-patterns were named directly by the client during discovery and drive concrete UX commitments:

- **Rejected — illegible final PDF reports.** The indirect end users (patient, referring doctor) are the ones who suffer when a report is badly typeset — it generates a flood of "what does this result mean?" phone calls. The PDF report is treated as a first-class designed surface in this product, not an afterthought export — this is why the document-analyte editor renders at final-PDF font/width (captura = reporte) instead of a generic rich-text box.
- **Rejected — broken analyzer integrations forcing manual transcription.** When bidirectional device communication fails, the fallback of hand-transcribing results is both slow and a serious human-error risk. The UI must always visibly distinguish device-sourced values from manually-entered ones, so a chemist reviewing an interfaced study can tell at a glance what came from the analyzer versus what a human typed.
- **Rejected — slow, mouse-dependent capture flow.** Reception and sample intake must be fully keyboard-driven end to end; this is the direct justification for the Tab-key navigation requirement (FR-30) being treated as a hard constraint rather than an enhancement.

## Responsive & Platform

| Breakpoint / surface | Behavior |
|---|---|
| Desktop / laptop (primary for Recepción, Captura, Entrega, Reportes, Configuración) | Full sidebar + topbar shell. Multi-column layouts (KPI row, Kanban row, table + side-panel). |
| Tablet (secondary-primary for Recepción, Entrega per NFR-6) | Sidebar remains visible or collapses to icons; content reflows to fewer columns but keeps the same components. |
| Phone (mobile-first PWA floor, NFR-6) | Sidebar becomes an off-canvas drawer (☰ trigger in a compact top bar). Dashboard collapses the KPI row to a 2-column grid and the Kanban board to a stacked/tab view rather than 5 side-by-side columns. |
| Patient portal (phone-optimized specifically) | Single-column, no shell chrome at all — no sidebar, no topbar, no navigation beyond the DOB gate and (once past it) the results view + PDF download. This surface is deliberately the leanest in the product. |

## Key Flows

### Flow 1 — Reception intake with the Caja gate (Paola Reséndiz, recepcionista, 7:04am, first patient of her shift)

1. Paola opens `{lab}.quimiaio.com` at the start of her matutino shift and starts registering the day's first patient, Roberto Nava Cruz, by folio-and-name instant search — he's new, so she creates his record inline.
2. Because no one else at this branch has registered a patient or order yet today, the system lazily prompts Paola — as the first to trigger it, not because it's tied to her personally — to open the branch's caja before the order can proceed. She enters the opening fund amount.
3. Back in the order form, she adds his studies via instant fuzzy search (FR-13/NFR-5), tabs through the payment section, and records a cash payment.
4. She presses Enter to save. The system generates folio ORD-03918 and an immutable QR/token, then opens the print-preview panel (see Component Patterns): 2 container labels — one per tube color the two ordered studies require — the payment ticket, and the work-order template. She confirms and all three print together.
5. **Climax:** the order appears instantly in the Kanban board's Recepción column with a fresh "4 min" timestamp — Paola can see, without leaving her screen, exactly where Roberto's order sits in the pipeline she just fed. The whole intake — patient search, study selection, payment, save — happened without her hands leaving the keyboard.

Failure: if Paola dismisses the caja prompt without opening it, order creation remains blocked — the gate is a hard stop, not a reminder she can defer. Had a colleague on the same matutino shift registered a patient a few minutes earlier, that colleague would have triggered the branch's opening instead, and Paola would see the caja already open with no prompt at all.

### Flow 2 — Chemist results capture with the evidence gallery and per-study validation (Q.F.B. Sofía Camacho, química, mid-afternoon, urine culture growing two organisms)

1. Sofía opens Captura and finds Lucía Andrade's order by folio.
2. The order has an interfaced Biometría Hemática study and a manual Urocultivo (urine culture) study. Most BH analytes arrived from the BC-5150 already tagged `Automático`, out-of-range values auto-highlighted Normal/Low/High against their numeric reference range (see Component Patterns) — but one analyte, Reticulocitos, isn't reported by this instrument model: it shows no tag and an empty field. Sofía types that single value herself, same field, same study, no separate step — then saves BH as a draft.
3. On the Urocultivo study, the culture has grown two organisms. She opens the image-analyte field and taps "Agregar evidencia" twice — once per organism's antibiogram PDF page — cropping each in-app to a preset size matched to the report column width, captioning them "Antibiograma — E. coli" and "Antibiograma — Klebsiella pneumoniae." She drags the E. coli card above the Klebsiella card so the more clinically significant result prints first.
4. The live preview shows exactly how both captioned crops will appear in the final PDF — no separate preview step.
5. **Climax:** she hits **Validar** on the Urocultivo study block — one action validates every analyte in that study, including both gallery evidence items, at once. The study becomes visible on Lucía's patient portal within seconds (the order was paid at intake), while the BH study she saved earlier is still an internal draft — the two studies on the same order sit at genuinely different validation states, and the portal reflects that difference incrementally rather than waiting for the whole order.

Failure: had a third organism turned up mid-capture, Sofía would add a third gallery item and reorder again — no delete/re-upload cycle required, which is exactly the case this pattern was designed to absorb.

### Flow 3 — Results delivery with the debt gate and portal (Paola Reséndiz, recepcionista, end of day, patient with an outstanding balance)

1. Paola filters the Entrega screen for today's ready-for-delivery orders and finds Ismael Ramírez's — Validado, Perfil hepático, $720 — flagged with an "Adeudo — entrega bloqueada" pill alongside the Validado pill.
2. She attempts to print the PDF; the delivery action is blocked because the balance is unsettled (FR-43) — no admin override is invoked here, this is the standard path.
3. She collects Ismael's $720 payment on the spot and records it against the order.
4. The debt pill clears; the delivery actions (print/email/hand-off) unlock.
5. Because this is an in-person hand-off, Entrega prompts a **Firma de recibido digital**: Ismael signs on the touchscreen to confirm receipt — a digital signature capture step (Phase 1) — with a "Borrar / Reintentar" option if the stroke is illegible.
6. **Climax:** she prints the official PDF and hands it over; the system records the delivery timestamp, channel, her user ID, and Ismael's captured signature, and the order moves to Entregado on the Kanban board — the same order that was invisible to Ismael on the portal moments earlier (validated but unpaid) is now both delivered in person *and* independently viewable through his QR link, because paying cleared the second gate at the same moment it cleared the first.

Failure: had Ismael been unable to pay, an admin (not Paola) could override delivery — but the override is itself audit-logged with a reason, so the exception is traceable, not silent.

### Flow 4 — Patient portal access via QR token with the DOB gate (María Fernanda Ruiz, patient, that evening, on her phone)

1. María received her order's QR/token at intake days earlier; her Perfil tiroideo results have just been validated and the order was paid at intake.
2. She scans the printed QR (or taps the link from an SMS) on her phone, landing on `quimiaio.com/r/{token}` — no app, no login, no account to create.
3. The portal shows nothing yet except a date-of-birth confirmation prompt (FR-44) — a deliberate identity gate before any clinical content renders, even though she already holds the unguessable token.
4. She enters her date of birth; it matches the record.
5. **Climax:** her Perfil tiroideo results render immediately — patient name, date, studies, out-of-range values marked with a directional arrow (↑ alto, ↓ bajo) and normal values carrying no icon at all, since the absence of a marker is itself the all-clear signal — with a PDF-download option, all inside a single-column, chrome-free mobile view built for exactly this one-shot, high-stakes read. If she'd had a second study still in análisis, the portal would show only what's validated-and-paid so far, with the rest simply not yet present — no "locked" placeholder, no premature disclosure.

Failure: a wrong date of birth shows a neutral "no coincide" message with no hint about which field was wrong and no attempt count displayed — the gate fails closed without leaking whether the token itself is valid. A second failure mode: opening the link after its 7-day token has expired (see State Patterns) shows a distinct "Enlace expirado" message with no clinical content, directing María back to the lab (or her original delivery channel) to request a fresh link, rather than attempting silent renewal.
