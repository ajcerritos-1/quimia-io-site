---
source: quimiaio-prompt-maestro.md (v2.0)
reconciled: 2026-07-21
---

# Reconciliation: `quimiaio-prompt-maestro.md` vs `DESIGN.md` + `EXPERIENCE.md`

**Note on provenance:** a file of this name already exists at
`_bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/reconcile-prompt-maestro.md`, but it reconciles the maestro against the **PRD/addendum**, not against the UX spines. No prior reconciliation of the maestro against `DESIGN.md`/`EXPERIENCE.md` existed in this workspace, so this is a fresh pass focused specifically on UX/design-level ideas (visual language, interaction patterns, flows) rather than functional-requirement coverage, which the PRD-level document already audits.

The maestro is the internal brand/route/build spec: color tokens, typography, multi-tenant routing, the 15-module inventory, and Claude-Code build instructions (tech stack, Prisma schema, file tree, SDD methodology). Sections 1, 2, 9, 10, 12 are HOW-level implementation directives — out of scope for a UX spine by design, not a drop.

## Covered — UX/design ideas that landed

| Idea in maestro | Landed in |
|---|---|
| Color tokens (`--primary`, `--accent`, `--bg`, `--text`, `--gray`, `--ok/warn/error`) | `DESIGN.md` Colors — carried with two documented accessibility fixes (`--gray` `#64748B`→`#607089`, `ok-text` darkened) |
| Logo lockup "Quimia" (300) + " IO" (800, cyan) | `DESIGN.md` Typography, `logo-light`/`logo-bold` — flagged non-negotiable |
| Font "300 light / 800 bold" | `DESIGN.md` Typography — consciously widened to the fuller 300/400/600/700/800 range actually shipped in `index.html`, with rationale given |
| Multi-tenant routing (`quimiaio.com` / `app.quimiaio.com` / `labname.quimiaio.com`) | `EXPERIENCE.md` Foundation |
| 5-column Kanban (Recepción→Muestra recibida→En análisis→Validado→Entregado) | `EXPERIENCE.md` State Patterns |
| 45/90-min yellow/red Kanban alert thresholds (Módulo 4) | `DESIGN.md` Kanban card component — collapsed to a single red "aging" variant in the reference mock, explicitly noted as expressing FR-38's two-tier semantics; thresholds kept lab-configurable, not hardcoded |
| Tab-key capture (Módulo 5 "Captura eficiente") | `EXPERIENCE.md` Interaction Primitives (FR-30) |
| Fuzzy/instant search (Módulo 2, 3 "Mejoras") | `EXPERIENCE.md` Interaction Primitives (NFR-5) |
| Image analito (ancho/alto/alineación fields) | `EXPERIENCE.md` Component Patterns, **Evidence gallery** — superseded by a deliberate UX decision (auto-fit preset crop sizes replacing manual width/height/alignment entry), not a silent drop |
| Document analito (editor de texto enriquecido) | `EXPERIENCE.md` Component Patterns, **Constrained document editor** |
| "Cambiar orden" (study reorder for PDF) | `EXPERIENCE.md` Component Patterns, **Study reorder** — resolves the maestro's underspecified interaction with a concrete drag + keyboard equivalent |
| Editar analitos / bitácora de cambios | `EXPERIENCE.md` Component Patterns, **Correction history popover** + State Patterns |
| Permisos granulares por módulo (flat list, Módulo 12) | `EXPERIENCE.md` Component Patterns, **Permission matrix** — improved on the source (grouped by module, not flat) |
| Apertura de caja obligatoria (regla de negocio #1) | `EXPERIENCE.md` State Patterns, Caja session + Flow 1 |
| Adeudo bloquea entrega (regla #2) | `EXPERIENCE.md` State Patterns, Debt-gate states + Flow 3 |
| Invalidación con motivo obligatorio (regla #3) | `EXPERIENCE.md` State Patterns |
| Precio editable solo en la orden (regla #4) | Reflected via order-composition framing in `EXPERIENCE.md`/digest, not restated verbatim (business rule, not a visual/interaction pattern) |
| QR único por orden (regla #5) | `EXPERIENCE.md` Flow 1, Flow 4 |
| Portal del paciente, token + QR, no login | `EXPERIENCE.md` IA table + Flow 4, date-of-birth gate |
| Pipeline Kanban resumen (mini vista) en Dashboard (Módulo 1) | `EXPERIENCE.md` IA table: "mini pipeline" |
| index.html brand DNA (pill shapes, translucent dark chips) referenced via maestro palette | `DESIGN.md` Shapes, Components |

## Not carried forward (explained)

| Idea | Reason |
|---|---|
| Tech stack (Next.js, Prisma, NextAuth, Tailwind/shadcn, Twilio, Resend, Stripe) | Correctly out of scope — implementation layer, not design/UX |
| Subscription plan pricing/limits table | Business/pricing detail, not a UX pattern; phase tags in `EXPERIENCE.md` IA table reflect the Phase 1/2 split it implies |
| Prisma schema, file structure, SDD methodology | HOW-level, correctly excluded from a design/experience spine |
| WhatsApp message copy examples (Módulo 8) | Not quoted verbatim anywhere; reasonable at spine level since WhatsApp itself is Phase 2 |
| Cotización 30-day auto-archive (regla #8) | Not mentioned in either spine; Phase 2, narrow business rule — low UX stakes but see below |

## Dropped or at-risk ideas

1. **Cancelled-order visual state is missing entirely.** Módulo 6 explicitly states delivery-list results appear in red "por dos motivos: por adeudo, o por órdenes canceladas" (two reasons: debt OR cancellation), and the maestro's own Prisma sketch (§9) carries an explicit `CANCELLED` value in `OrderStatus`. But `DESIGN.md`'s `status-pill` component defines only five variants (`recepcion`, `en-analisis`, `validado`, `entregado`, `adeudo`) — there is no `cancelado` pill, and neither spine's Kanban/State Patterns section mentions how a cancelled order is represented on the board or in the delivery list. This is a genuine silent drop, not a conscious deferral.

2. **Kanban drag-and-drop between columns is silently superseded, not reconciled.** The maestro is explicit: "Arrastrar tarjeta entre columnas (drag & drop)" is a named Kanban interaction (Módulo 4). `EXPERIENCE.md` Interaction Primitives states the opposite outright: "No other surface introduces a competing drag pattern in Phase 1" (drag is reserved for the evidence gallery and study-reorder list only) — and State Patterns describes all Kanban transitions as automatic, business-event-driven (validation, delivery), never manual drag. This is very likely the *right* call — a chemist shouldn't be able to manually drag a card past a validation gate — but it directly contradicts a named source interaction with no explanatory note anywhere. Worth a one-line callout in `EXPERIENCE.md` making the supersession explicit and intentional.

3. **Digital signature on delivery ("firma de recibido digital... el paciente firma en pantalla táctil") never appears.** This is a distinct, concrete client-requested improvement (Módulo 6 "Mejoras") — a touchscreen signature capture at hand-off — and it's absent from both spines with no deferral tag. Worth a second look, even if the answer is "Phase 2/3."

4. **Partial/role-scoped Dashboard views dropped.** Módulo 1: "Roles con acceso: Admin, Químico (parcial), Recepcionista (parcial)" — a role-scoped, reduced dashboard for non-admin roles. Neither the IA table nor any Dashboard description in `EXPERIENCE.md` mentions role-gated dashboard content; RBAC is discussed generically (Accessibility Floor) but not tied to the dashboard specifically.

5. **Portal single-use token option still missing.** Módulo 6 "Mejoras" names "token de 1 uso o con expiración" as two distinct security models. `EXPERIENCE.md` only ever describes the DOB-gate + expiring-token model (Flow 4); the single-use alternative — already flagged as dropped in the PRD-level reconciliation — is still absent at the UX-spine level, so it never got a second chance to resurface.

6. **Push notification on result-ready (Módulo 6 "Mejoras") isn't mentioned anywhere**, and isn't tagged as deferred. Low stakes on its own, but combine with item 3 above and there's a small cluster of "nice-to-have delivery UX" ideas from the client's improvement wishlist that quietly disappeared together.
