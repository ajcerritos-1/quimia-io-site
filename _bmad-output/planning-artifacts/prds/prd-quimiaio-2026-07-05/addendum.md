# PRD Addendum — Quimia IO

Technical and implementation material extracted from `quimiaio-prompt-maestro.md` v2.0. This content is intentionally kept out of the PRD (capabilities-only) and feeds the architecture and design phases downstream.

## Tech stack (owner's decision, pre-made)

Next.js 14+ App Router · TypeScript strict · Tailwind CSS + shadcn/ui · Plus Jakarta Sans (300/800) · PostgreSQL with RLS (Supabase or Neon) · Prisma · NextAuth.js v5 · React-PDF/jsPDF · Twilio (WhatsApp) · Resend (email) · qrcode.react · Vercel (Phase 1) → VPS/Railway (Phase 2) · Stripe.

These are owner-stated preferences, not PRD requirements. The architecture phase should ratify or challenge them (notably: Vercel serverless vs. long-running needs for HL7 interfacing; Supabase vs. Neon for RLS ergonomics).

## Data model and route structure drafts

A complete draft Prisma schema exists in `quimiaio-prompt-maestro.md` §9 (Tenant, User, Patient, Order, OrderItem, Study, Analyte, AnalyteRef, Result, Payment, enums). Treat it as a strong starting sketch for the architecture phase, not a contract. Known gaps vs. PRD: no models yet for cash sessions (Caja), quotations, companies, doctors, inventory, audit log, or CFDI documents.

Proposed Next.js route layout in `quimiaio-prompt-maestro.md` §10: route groups `(auth)` and `(dashboard)`, public portal at `r/[token]`, API routes per domain, Twilio webhook.

## Design system

Palette and logo treatment from `quimiaio-prompt-maestro.md` §3:

- `--primary: #0D1B36` (navy)
- `--accent: #00C4E0` (electric cyan)
- `--accent-lt: #E0F8FF`
- `--bg: #F0F6FF`
- `--text: #0F172A`
- `--gray: #64748B`
- `--border: #E2E8F0`
- `--ok: #10B981`
- `--warn: #F59E0B` (>45 min)
- `--error: #EF4444` (>90 min / debt)
- Logo: `Quimia` (weight 300) + ` IO` (weight 800, cyan)

## Development methodology

Owner mandates per-module SDD flow: SPEC → SCHEMA → API → UI → CODE → REVIEW, with TypeScript strict, Zod validation on client and server, RLS on every table, mobile-first components, explicit loading/error states. First module to build: Dashboard + Auth + base layout (per maestro §12). This matches the PRD timeline, which also starts with auth/foundations.

## Rejected / deferred considerations

- **Data migration from ToronjaLab**: rejected for Phase 1 scope (greenfield start). Preserved as an optional paid service; feasibility depends on ToronjaLab export formats (OQ-3).
- **WhatsApp and quotations in Phase 1**: deferred to Phase 2 to protect the 17-week budget; flagged as first trade-in candidates if the client insists.
- **Altitude engine in Phase 1**: deferred — single-site client at fixed altitude makes it a no-op for Phase 1; it is a Phase 2 SaaS differentiator.

## Equipment interfacing protocol (FR-74a, added 2026-07-28)

Verified against Mindray's own documentation before committing this to the PRD:

- **Mindray BC-5150** (hematology): confirmed — Mindray publishes a dedicated "BC-5000 & BC-5150 HL7 Communication Protocol V2.0" manual. HL7 (2.3.1-family) is the documented host interface.
- **Mindray BS-240Pro** (chemistry): not independently confirmed for this exact model. Mindray's general host-interface manuals for its chemistry line cover both HL7 (v2.3.1) and ASTM E1394-97, typically over TCP/IP (some models/configs use RS-232 serial instead). `[ASSUMPTION]` confirm the exact protocol, version, and physical transport from the client's actual BS-240Pro host interface manual (or by contacting Mindray) during the architecture phase, before driver work starts.
- Both are Mindray-brand "result-only" (unidirectional) interfaces in their default host mode — matches FR-74a's scope. Host-query (bidirectional) mode, if supported at all, is a separate protocol capability and stays out of Phase 1 per FR-74b.

## Client-facing deliverable

The owner wants a client-facing document with timelines for both phases, derived from PRD §11. To be generated after the phasing is approved (likely in Spanish, addressed to the partner doctor).
