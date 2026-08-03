---
title: 'Reviewer Gate — Rubric Walker'
reviewer: rubric-walker
target: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md
target_revision: '2026-07-30 re-distill (AD-10, AD-11, AD-12, broadened Zod convention, Serwist stack entry, extended Deferred)'
altitude: feature (keeps epics coherent)
date: '2026-07-30'
cross_read:
  - prds/prd-quimiaio-2026-07-05/prd.md
  - prds/prd-quimiaio-2026-07-05/addendum.md
  - sprint-change-proposal-2026-07-27.md
  - ux-designs/ux-quimiaio-2026-07-10/EXPERIENCE.md (status final, 2026-07-29)
  - ux-designs/ux-quimiaio-2026-07-10/DESIGN.md (status final, 2026-07-29)
  - architecture/.../reviews/reconcile-prd.md
  - .memlog.md
verdict: CHANGES REQUIRED
---

# Reviewer Gate — Rubric Walker

## Verdict

**CHANGES REQUIRED.** The 2026-07-30 revision genuinely closed four of the seven gaps its own reconcile pass raised, and AD-1 through AD-9 remain the strongest part of the document — the equipment-interfacing chain (AD-5/6/7) is exemplary spine work. But the revision closed those gaps at the *topic* level rather than the *invariant* level: three of the four new items (AD-10, AD-12, and the Serwist/NFR-6 answer) name a mechanism without making it enforceable, and AD-11 does not actually prevent the divergence it claims to prevent. More seriously, the rubric walk surfaces three Phase-1 structural dimensions that are completely silent — non-session database access, file/object storage, and route/host topology — plus one Deferred item whose stated justification is falsified by an artifact finalized the day before the revision. As written, two epics built independently from this spine will diverge on things that matter clinically and legally.

Counts: **3 critical**, **6 high**, **7 medium**, **4 low**.

---

## 1. Rubric Walk

### 1.1 Does it fix the real divergence points for the level below, and miss none?

**PARTIAL — misses three.** The divergence points it *does* fix are the right ones and are fixed well: module boundary discipline (AD-1), the single DB path (AD-3), the base ERD (AD-4), and the whole equipment-interfacing topology (AD-5/6/7). Those are the questions an epic author would otherwise answer four different ways.

Missed, in descending order of blast radius:

- **Non-session DB access** — AD-3 says the only path to the database is a wrapper that sets `app.tenant_id` "from the authenticated session." Phase 1 has three flows with no authenticated session at the moment of the query: login itself (Better Auth must read `User`/`Session` before a session exists), the public portal at `quimiaio.com/r/{token}` (EXPERIENCE.md §Portal, no login by design), and the agent ingestion endpoint (AD-6 must read the instrument's API-key row to *learn* `tenantId` before it can scope anything). See F-1.
- **File/object storage** — FR-28 (Phase 1) requires image and rich-document analyte types; FR-11 (Phase 1) requires an uploaded lab logo and chemist signature image. Nothing in Stack, ERD, Conventions, or Deferred says where bytes live. See F-2.
- **Route / host topology** — `src/app` appears nowhere in the source tree yet is cited in the Capability Map ("app shell (`src/app`)"). AD-1 gives each module its routes, but Next.js App Router owns `app/**`; the mapping rule is unstated, the public portal has no owning module, and the `{lab}.quimiaio.com` tenant-subdomain shell that EXPERIENCE.md treats as the working surface has no tenant-resolution decision. See F-5.

### 1.2 Is every AD's Rule enforceable, and does it actually prevent its stated divergence?

**PARTIAL — 8 of 12 clean.** Enforceable and effective: AD-1 (a lint/import boundary rule is mechanically checkable), AD-2, AD-3 (modulo F-1), AD-4, AD-5, AD-6, AD-7, AD-8, AD-9. Credit where due: AD-3 correctly specifies `SET LOCAL` rather than `SET`, which is the difference between working and silently failing behind Neon's transaction-mode pooler — that is a detail most spines get wrong.

Failing this test:

- **AD-10** — the Rule's teeth ("the DB role the app connects as holds no `UPDATE`/`DELETE` grant") are a no-op under the default Neon topology, where the app connects as the object owner. A table owner can re-grant itself at will, so revoking from the owner is not a durable control. Same defect silently breaks AD-3: in PostgreSQL, table owners bypass RLS entirely unless the table is declared `FORCE ROW LEVEL SECURITY`. See F-4.
- **AD-11** — "polling at an interval inside the NFR-5 SLA window" fixes neither an interval nor a mechanism, so kanban at 5 s and dashboard at 2 s via two different libraries both satisfy the Rule. That is precisely the split the Prevents clause claims to stop. See F-6.
- **AD-12** — "relies on Neon's built-in continuous backup" is a procurement statement, not an invariant; no plan tier, no retention window, and NFR-8's retention clause is not satisfiable by PITR at all. See F-7.
- **Consistency Conventions (broadened Zod row)** — the broadening is correct in substance but the row now carries four unrelated mandates in one cell, and the addendum's other two per-module mandates (mobile-first components, explicit loading/error states) are still absent. See F-9.

### 1.3 Is anything under Deferred secretly load-bearing?

**FAIL — three items are.**

| Deferred item | Load-bearing? | Why |
| --- | --- | --- |
| `OrderItem.status` / `ItemStatus` | **Yes — critical** | Justification ("values were never specified anywhere") is false as of 2026-07-29. See F-3. |
| `AuditLog` model | **Yes — high** | AD-10 binds a write path to a table with no shape; FR-52 mandates actor/timestamp/before-after per event. Two modules through one wrapper can still write two incompatible payloads. |
| `User.roleId` / `Role` | **Yes — high** | AD-3's wrapper sets `app.role`, and RLS policies are written against its values; FR-3 requires every screen and API to enforce RBAC. The three Phase-1 role names are already fixed (PRD §5 "3 roles"; EXPERIENCE.md: Admin, Recepcionista, Químico), so this is deferral of a *known* value that every RLS policy and every module's guard depends on. |
| `Study` dangling catalog FKs | Acceptable | Leaf catalog references; no cross-module contract. |
| Doctor, CashSession/Caja | Acceptable | Single-module ownership, no cross-cutting invariant. |
| Company/Quotation/Inventory/CFDI, branch fields | Acceptable | Genuine Phase 2. |
| Altitude engine, FR-74b, Twilio/Stripe, ToronjaLab migration | Acceptable | Genuine Phase 2 / rejected scope. |
| BS-240Pro protocol | Misfiled | A real pre-work blocker sitting in the same bucket as Phase-2 scope. See F-13. |

### 1.4 Is named tech verified-current?

**PASS, with a pinning-discipline caveat.** Next.js 16.2.x, TypeScript 5.x strict, Tailwind v4 + shadcn/ui (Base UI default), Prisma 7.x Rust-free, and Node 24 Active LTS form a mutually consistent mid-2026 snapshot, and the memlog records dated web verification with sources for each (2026-07-28) plus the Serwist check (2026-07-30). The `next-pwa` → Serwist reasoning is correct: `next-pwa` has been archived for years and Serwist is its named successor. No stale claim found — notably, the owner's stale "Next.js 14+" and NextAuth v5 preferences were both correctly challenged rather than ratified.

Caveats: five entries are `unpinned` and two are `current`, which at this altitude means two epics built three weeks apart can install different majors of the same library. The sharper one is **`React-PDF / jsPDF`** — an unresolved either/or, not a version gap. FR-22 (labels + ticket + work order) and FR-42 (official result PDF) will be built by different epics; each will pick a side, and "React-PDF" is itself ambiguous between `react-pdf` (a viewer) and `@react-pdf/renderer` (a generator). See F-8.

### 1.5 Does the spine cover the driving spec's capabilities?

**PARTIAL.** Everything in the frontmatter `binds:` list has a Capability Map row and at least one governing AD — that part is clean and traceable. The problem is what is *not* in `binds:`:

- **NFR-2 (NOM-024 compliance)** — the regulatory NFR. Its four mandates are RBAC, audit traceability, periodic backups, password complexity. Post-revision the spine covers audit (AD-10) and backups (AD-12); RBAC is deferred (see 1.3) and **password/session policy is absent entirely**, despite Better Auth being the component that would carry it. NFR-2 has no `binds:` entry, no AD, no Capability Map row.
- **NFR-3 (LFPDPPP 2025 / ARCO)** — the spine's own reconcile pass raised the deletion-vs-retention-vs-audit-immutability tension as finding 1.6. The revision did not address it in any form: no AD, no Deferred bullet, no open question. AD-10 makes audit rows undeletable, which *sharpens* the tension the reconcile flagged.
- **NFR-4 (availability)** — reconcile finding 1.7 (monitoring/health/graceful-degradation) also went unaddressed.

So the revision closed reconcile findings 1.1, 1.2, 1.3, 1.5 (partially) and 1.4, and left 1.6 and 1.7 open without marking them open. See F-10.

Also: FR-22 is bound in the frontmatter and mandates "a unique QR token (immutable across edits)". The ratified ERD (AD-4) has no token attribute on `ORDER`, and the portal surface depends on it. See F-11.

### 1.6 Is every structural dimension the altitude owns decided, deferred, or an open question?

**PARTIAL.** Dimensions and their state:

| Dimension | State |
| --- | --- |
| Module decomposition / boundaries | Decided (AD-1) — strong |
| Data access & tenancy | Decided but holed (AD-3 + F-1, F-4) |
| Core data model | Decided (AD-4), incomplete (F-11, F-12) |
| External-device integration | Decided (AD-5/6/7) — strongest section; reliability envelope missing (F-14) |
| Auth provider | Decided (AD-8); authorization model deferred (1.3), password/session policy silent |
| Deployment & environments | Decided (AD-9 + table) — see below |
| Naming / formats / errors / logging | Decided (Conventions) |
| Real-time transport | Nominally decided (AD-11), not actually pinned (F-6) |
| Audit integrity | Nominally decided (AD-10), not actually enforced (F-4) |
| Backup / durability | Nominally decided (AD-12), does not meet NFR-8 (F-7) |
| **File / object storage** | **SILENT** (F-2) |
| **Route & host topology / tenant resolution** | **SILENT** (F-5) |
| **Client data-fetching & caching** | **SILENT** (F-6) |
| **Schema authoring & migration process** | **SILENT** (F-15) |
| **Test strategy & CI gate** | **SILENT** (F-16) |
| **Observability / monitoring / log sink** | **SILENT** (F-10) |
| **Design system / UI consistency** | **SILENT — but externally owned** (F-9) |

**Operational/environmental envelope specifically (AD-9 + Deployment table), as the rubric asks:** this is the better half of the operational story. The three-tier ladder is explicit, the Neon-branch-per-PR topology is a real decision, the "agents only in production, simulated messages elsewhere" rule is exactly the kind of invariant that stops someone testing against a live analyzer, and the secret-placement split (agent key in local config on the lab PC vs. server secrets in Vercel/Neon env) is enforceable. That is a genuine pass on *environments*.

What the envelope still does not cover: (a) how Prisma migrations are promoted along that ladder — `migrate deploy` against an ephemeral preview branch vs. main is a real per-PR mechanic and nothing states it; (b) monitoring, alerting, health checks, or the log sink/retention for the structured JSON logs the Conventions table mandates — which is also the missing half of NFR-4's "graceful degradation messaging"; (c) the on-site agent's own lifecycle — how it is installed, versioned, updated, or supervised on an unmanaged lab PC, and how anyone learns it has died (a dead agent means results silently stop arriving, and FR-74a explicitly removes the CSV fallback that would otherwise mask it). Verdict on this dimension: **adequate on environments, thin on operations.**

---

## 2. Findings

### CRITICAL

#### F-1 — AD-3 has no defined path for the three Phase-1 flows that query the DB with no session
**Section:** AD-3 (and AD-6, AD-8 by dependency)

AD-3 is the spine's keystone: "the only path to the database is one Prisma Client Extension wrapper… It opens a transaction and runs `SET LOCAL app.tenant_id` / `app.role` **from the authenticated session** before any query." Three Phase-1 flows must read the database *before* a session-derived tenant exists:

1. **Login.** Better Auth's adapter must read `User`/`Session` rows to establish the session. Chicken-and-egg with AD-3's precondition.
2. **Public patient/doctor portal.** EXPERIENCE.md (status final): "The patient portal lives outside the tenant shell entirely, at `quimiaio.com/r/{token}` — public, no login." It renders clinical `Result` rows, gated by token + DOB + the dual paid-and-validated rule. There is no session to derive tenant from, and no `portal` module in the source tree to own the resolution.
3. **Agent ingestion.** AD-6 resolves the order by "(tenantId from the instrument's API key, folio)" — but learning that `tenantId` requires reading the API-key row first, which is itself a query AD-3 says must already be tenant-scoped. (The `ApiKey`/credential entity also appears in neither the ERD nor Deferred.)

Why it matters at this altitude: whoever builds each of these three will invent their own escape hatch — most likely a second, unwrapped Prisma client — and every such hatch is exactly the tenant-isolation bypass (NFR-1) that AD-3 exists to prevent. Three independent inventions is the worst outcome available.

**Minimal fix:** extend AD-3 with a named, enumerated system/bootstrap context — one additional wrapper entrypoint that runs as a distinct low-privilege role with RLS policies scoped to exactly the three bootstrap reads (credential lookup, session lookup, portal-token lookup), with a Rule that no other code path may use it. State that the portal derives tenant from the token row, not from a session, and assign the portal an owning module.

#### F-2 — File/object storage is a completely silent Phase-1 dimension
**Section:** Stack, ERD, Deferred (absent from all three)

FR-28 (Phase 1) requires analyte result types `image attachment (renders in PDF)` and `rich-text document (renders in PDF)`. FR-11 (Phase 1) requires an uploaded lab logo and responsible-chemist signature image on the PDF header. EXPERIENCE.md elaborates a Phase-1 evidence *gallery* — multiple cropped images per image-analyte, drag-reorderable, caption per item, print order = gallery order.

The spine names no object store (no Vercel Blob, S3, R2, UploadThing), no ERD entity for an attachment/evidence item, no rule on bytes-in-Postgres vs. bytes-in-a-bucket, no signed-URL or access-control rule for clinical images that must also honor the portal's paid+validated gate. This is not deferred and it is not an open question — it is absent.

Why it matters: `results-capture`, `delivery` (PDF rendering), `catalog` (logo/signature), and the portal all need it. Each will pick differently, and one of them will pick base64-in-a-column. Access control on clinical images is a privacy-law surface (NFR-3), not just a plumbing choice.

**Minimal fix:** one AD naming the store and the access pattern (private bucket + short-lived signed URLs issued only after the same authorization check that gates the row), plus an `Attachment`/`Evidence` entity in the ERD keyed to `Result` with `tenantId` for RLS parity.

#### F-3 — Deferred `OrderItem.status` is load-bearing and its stated justification is false
**Section:** Deferred, bullet 3 (interacts with AD-1 kanban/orders boundary and AD-4)

The Deferred bullet reads: "Referenced in the owner's schema sketch… but its values were never specified anywhere — deferred rather than invented, since guessing values now risks contradicting a per-item cancellation/state design not yet elicited."

EXPERIENCE.md, status `final`, updated **2026-07-29** — the day before this revision — specifies it:
- the five pipeline states verbatim (Recepción → Muestra recibida → En análisis → Validado → Entregado), with an explicit instruction that these names be used verbatim everywhere they appear;
- per-study sub-states inside En análisis/Validado, with the derivation rule "the order-level Kanban column reflects the *least advanced* study still open";
- validation granularity (one `Validar` per study, not per analyte);
- transitions are automatic from business events, with manual drag as a correction-only override that must write its own audit entry.

Why it matters: this state model is read or written by `orders` (owner), `kanban` (AD-1 says it reads order state through the orders interface — through *what* state vocabulary?), `results-capture` (writes validation), `delivery` (terminal transition), and the portal (per-study visibility). Five units, one undefined enum, plus an undefined cross-module derivation rule. This is the single clearest "deferred but secretly load-bearing" item in the document, and the falsified justification means nobody downstream will re-examine it.

**Minimal fix:** promote to an AD binding the five order-level states, the per-study sub-states, the least-advanced derivation rule, and the "automatic transitions only, manual drag is an audited correction" invariant. Cite EXPERIENCE.md as the source.

### HIGH

#### F-4 — AD-10's immutability and AD-3's RLS are both no-ops under the default Neon role topology
**Section:** AD-10 (primary), AD-2/AD-3 (same defect)

Two PostgreSQL facts the spine does not account for:
1. **A table owner can re-grant itself any privilege.** Revoking `UPDATE`/`DELETE` on `AuditLog` from the role the app connects as is not a durable control if that role owns the table — and Neon's default connection string uses the object-owning role.
2. **Table owners bypass RLS.** Policies do not apply to the owner unless the table is declared `FORCE ROW LEVEL SECURITY`. This is the more dangerous half: it means the entire AD-2/AD-3/NFR-1 tenant-isolation story can be *fully implemented as written* and still enforce nothing.

AD-10 is the new addition, so it is the one that "looks complete on the surface" — it reads as stronger than app-level discipline ("enforced at the Postgres privilege level, not by application discipline alone") while being weaker than advertised in the default topology.

**Minimal fix:** an AD (or a clause in AD-2) mandating role separation — a migration/owner role used only by `prisma migrate`, and a distinct non-owning application role in the runtime connection string — plus `ALTER TABLE … ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` on every tenant table as part of the RLS convention. Then AD-10's grant revocation becomes real. Consider also an append-only trigger as belt-and-braces for `AuditLog`.

#### F-5 — Route/host topology and tenant resolution are undecided; `src/app` is missing from the source tree
**Section:** Structural Seed → Source tree; AD-1; Capability Map (NFR-6 row)

`src/app` is referenced in the Capability Map ("app shell (`src/app`)") but does not appear in the source tree, which shows only `src/modules/*`, `src/shared/*`, and `agents/*`. AD-1 says each module owns "its own routes/server-actions/domain logic," but the App Router requires the route tree to live under `app/**`, so the mapping (thin `app/` route files delegating into modules? route groups? per-module segment folders?) is the thing every epic must get right identically — and it is unstated.

Compounding: EXPERIENCE.md treats `{lab}.quimiaio.com` as the staff working surface with `app.quimiaio.com` as the login entry and `quimiaio.com/r/{token}` as a shell-free public surface. The spine's Structural Seed shows one `app` box and a `portal` box with no host/middleware decision, no tenant-resolution rule (subdomain vs. session claim — which feeds AD-3's `SET LOCAL`?), and no owning module for the portal.

**Minimal fix:** one convention line fixing the `app/` ↔ `modules/` mapping (with `src/app` shown in the source tree), and a sentence in AD-3 or a new AD stating where tenant identity comes from per surface: session claim for staff, token row for the portal, API key for the agent.

#### F-6 — AD-11 does not prevent the divergence it names; no client data-fetching decision exists
**Section:** AD-11; Stack

AD-11's Prevents clause is "one module building a persistent-connection channel while another polls, splitting the real-time story." Its Rule bans server push and requires "polling at an interval inside the NFR-5 SLA window." That leaves two of the three divergence axes open:
- **Interval** — NFR-5 says 5 s for Kanban. Kanban at 5 s and the dashboard at 2 s both comply; the live story is still split, and on Vercel the difference is a multiple on function invocations.
- **Mechanism** — the Stack table contains no data-fetching/caching layer at all (no TanStack Query, no SWR, no statement that `router.refresh()` + `revalidate` is the mechanism). AD-11 mandates polling without naming what polls. Two modules will use two mechanisms, each with its own cache semantics — which is the same class of split, one layer down.

Secondary risk worth flagging under the same AD: AD-3 wraps every read in an interactive transaction; multiply that by a ≤5 s poll per open board per user against Neon's pooler and NFR-5's other clause (300 ms perceived search) is under pressure. The spine never states a performance budget for the wrapper.

**Minimal fix:** pin the interval to a single value for all live views, and name the fetching mechanism in Stack. One sentence each.

#### F-7 — AD-12 does not satisfy NFR-8, and names no retention window or plan tier
**Section:** AD-12; Capability Map (NFR-8 row)

NFR-8 has two clauses: "automated daily backups with tested restore" **and** "results and audit data retained per NOM-007/NOM-024 record-keeping obligations." AD-12 answers the first and silently drops the second. Neon's history/PITR retention is a plan-tier window on the order of days to a few weeks — it is a recovery mechanism, not a records-retention mechanism, and cannot express a multi-year clinical-records obligation. The AD also names no plan tier and no retention window, so "relies on Neon's built-in continuous backup" is unverifiable as written.

Additionally, "a documented quarterly restore-drill is a Phase 1 operational task" has no owner and no evidence artifact, which makes NFR-8's "tested" unauditable — a problem specifically because NOM-024 compliance (NFR-2) is an audit surface, not just an internal quality bar.

**Minimal fix:** state the Neon plan and its PITR window; separate the *recovery* control (PITR, with a number) from the *retention* control (periodic exported snapshots to durable storage with a stated retention period, or an explicit statement that retention is met by never hard-deleting rows plus the audit-immutability guarantee); name who runs the drill and where the evidence lands.

#### F-8 — Two unresolved Stack choices will be resolved differently by different epics
**Section:** Stack

- **`React-PDF / jsPDF`** — an either/or, not a version gap. FR-22's three document sets (container labels, payment ticket, work order) and FR-42's official result PDF are separate epics. These libraries have incompatible authoring models, and the label/ticket path additionally has physical-print constraints (thermal label sizing, tube-color-driven label count per AD-4/FR-22) that the choice interacts with. "React-PDF" is also ambiguous between `react-pdf` (viewer) and `@react-pdf/renderer` (generator).
- **`current` / `unpinned`** on seven of thirteen Phase-1 rows, including Better Auth (the newest, least battle-tested piece, and the one that must carry NFR-2's password-complexity mandate). At feature altitude, "unpinned" means epics built weeks apart can diverge on majors.

**Minimal fix:** pick one PDF library and name the exact package; pin at least Better Auth and Serwist to a major.

#### F-9 — UI/design-system dimension is silent and the final UX artifacts are not referenced
**Section:** Consistency Conventions; frontmatter `sources:` / `companions: []`; Capability Map (NFR-6 row)

The spine binds FR-35 (a capture-screen behavior) and NFR-6 (mobile-first), yet neither `EXPERIENCE.md` nor `DESIGN.md` — both `status: final`, both updated 2026-07-29 — appears in `sources:` or `companions:`. The reference is one-directional: EXPERIENCE.md lists ARCHITECTURE-SPINE.md as one of its sources. An epic author reading only the spine has no pointer to the artifact holding the design tokens (DESIGN.md carries the full color/typography set), the state-name vocabulary, or the offline semantics.

Concretely dropped from the Conventions table: the addendum's per-module mandates are "TypeScript strict, Zod validation on client and server, RLS on every table, **mobile-first components, explicit loading/error states**." The revision correctly broadened the Zod half; the last two — which are exactly the UI-consistency invariants that keep independently built epics coherent — are still absent. So is the pinned typeface (`Plus Jakarta Sans 300/800`) from the addendum's own stack list.

Also under this heading: the revision's Serwist entry answers NFR-6 with a *library* under Stack and a Capability Map row that says "Governed by: Stack (Serwist)" — the only capability in the map governed by no AD. Meanwhile EXPERIENCE.md §State Patterns already decided the actual PWA floor: capture/intake keep locally typed data and block `Guardar`/`Validar` behind a persistent "Sin conexión" banner (no offline write queue), while read-only surfaces may serve last-loaded data with a "Última actualización hace X" indicator. That is a real architectural rule with service-worker caching consequences, and the spine neither binds it nor points to it. Installing Serwist is not a decision about what happens when the lab's internet drops mid-capture.

**Minimal fix:** add both UX files to `companions:`; add a UI row to the Conventions table (mobile-first, mandatory loading/error/empty states, tokens come from DESIGN.md, pipeline state names verbatim); promote the offline floor to an AD (or an explicit "governed by EXPERIENCE.md §State Patterns" reference) so NFR-6 has an enforceable rule and not just a dependency.

### MEDIUM

#### F-10 — Reconcile findings 1.6 (NFR-3) and 1.7 (NFR-4) were left unaddressed and unmarked
**Section:** Deferred (absent); Capability Map (no NFR-2/NFR-3/NFR-4 rows)

The spine's own `reviews/reconcile-prd.md` raised seven findings. The revision closed 1.1 (NFR-8 → AD-12), 1.2 (NFR-7 → AD-10), 1.3 (NFR-5 → AD-11), 1.4 (folio evidence → AD-4 amendment), and partially 1.5 (NFR-6 → Serwist). Findings 1.6 and 1.7 got nothing — not an AD, not a Deferred bullet, not an open question:

- **1.6 / NFR-3:** ARCO "delete patient data on request" must coexist with NOM retention and with an audit trail that stores before/after values referencing that patient. AD-10 makes those audit rows undeletable, which *tightens* the conflict the reconcile flagged. A patients-module author and an audit-module author will resolve "delete a patient" incompatibly (hard delete vs. tombstone vs. refuse-and-log).
- **1.7 / NFR-4:** no monitoring, health checks, alerting, or log sink, and no technical answer for "graceful degradation messaging when offline" beyond what EXPERIENCE.md decided unilaterally.

Also missing from the frontmatter `binds:` and Capability Map: NFR-2, the NOM-024 compliance NFR, whose four mandates are RBAC (deferred), audit traceability (AD-10), periodic backups (AD-12), and **password complexity (absent entirely — no AD, no convention, despite AD-8 naming the provider that would enforce it)**.

**Minimal fix:** at minimum, three honest open-question bullets (patient-deletion semantics vs. audit immutability; observability/alerting; password & session policy) so downstream authors know these are unresolved rather than absent. A spine may leave things open; it should not leave them invisible.

#### F-11 — FR-22's immutable QR token has no home in the ratified ERD
**Section:** AD-4; Structural Seed → Core-entity ERD

FR-22 (bound in the frontmatter) requires "a unique QR token (immutable across edits)" per order; EXPERIENCE.md §Portal token policy adds a Phase-1 decision (7-day expiring, reusable, not single-use, no in-portal re-issuance). The ERD shows `ORDER` with no token attribute, and AD-4 ratifies the base ERD listing two corrections — neither of which is the token. The portal (F-1, F-5) depends entirely on it, and its immutability-across-edits property is exactly the kind of constraint that gets lost when three modules each assume someone else owns it.

**Minimal fix:** add the token (value, expiry) to the ERD bullet list alongside `Order.folio` and `Result.source`, with the immutability constraint stated.

#### F-12 — The ratified `Result` model does not account for FR-28's six analyte result types
**Section:** AD-4; ERD

FR-28 (Phase 1) requires numeric, text, calculated (formula-evaluated), image, rich-text document, and referenced (age/sex-resolved) results. AD-4's only correction to `Result` is the `source` enum. Nothing states how one `Result` row holds a number vs. a formatted document vs. an ordered gallery of images, where calculated-analyte formulas are evaluated (client, server, or both — the Conventions table's Zod rule implies both), or where the age/sex reference resolution against `AnalyteRef` lives. `Result` is the most-shared entity in the system: `results-capture` writes it, `delivery` renders it to PDF, the portal renders it to HTML, `equipment-interfacing` writes a subset of it.

**Minimal fix:** one ERD note on the `Result` value representation, and one line assigning formula evaluation and reference-range resolution to a single owning module (catalog or results-capture) so both readers get identical values.

#### F-13 — The spine has no Open Questions section; a real blocker is filed as "Deferred"
**Section:** Deferred (BS-240Pro bullet)

The BS-240Pro protocol bullet is well written and honest — "a real open item, not resolved in this coaching session," must be confirmed before driver work starts. But it sits in the same list as Phase-2 scope items like Stripe and the altitude engine. "Deferred by design" and "unresolved and blocking" are different states with different downstream obligations, and the rubric treats them as distinct. Filing them together means an epic planner scanning the Deferred list has no signal about which bullets carry a pre-work gate.

**Minimal fix:** split into `## Deferred` and `## Open Questions`; move BS-240Pro (and the F-10 items) into the latter, each with the event that must resolve it.

#### F-14 — AD-5/6/7 have no reliability envelope: no idempotency, retry, or unmatched-result rule
**Section:** AD-5, AD-6, AD-7

The interfacing chain is the spine's best work on topology and authentication, but it stops at the happy path. FR-74a removed the CSV fallback ("no CSV drop, no manual re-entry"), so the agent's HTTPS POST is the *only* path for those results, from an unmanaged PC on a small-clinic internet connection. Undefined:
- **Retry / durability** — what the agent does when the POST fails (drop? local spool? backoff?). Two agents get built (BC-5150, BS-240Pro); each will answer differently.
- **Idempotency** — with any retry, the same `{folio, analyte_code, value}` can arrive twice. Nothing states an idempotency key or an upsert rule, and a duplicated clinical `Result` row is a patient-safety-adjacent defect, not a cosmetic one.
- **Unmatched arrival** — AD-6 defines resolve-order → validate-analyte → write, but not the outcome when the folio doesn't exist yet (result produced before the order was saved, or a mistyped folio at the instrument) or when the analyte wasn't requested. Reject-and-drop vs. quarantine-for-review is a data-loss decision, and `results-capture` and `equipment-interfacing` would resolve it differently.

**Minimal fix:** three sentences in AD-6/AD-7 — local spool with bounded retry, a natural idempotency key with defined upsert-or-reject semantics, and a named destination for unmatched results.

#### F-15 — No rule for how a single Prisma schema is authored by per-module SPEC→SCHEMA work
**Section:** AD-1, AD-4, Conventions

AD-1 gives modules end-to-end ownership and the owner's mandated flow is per-module SPEC → SCHEMA → API → UI. But Prisma's schema is a global artifact, and the source tree places nothing schema-related under `src/modules/*` (only `shared/db` holds the wrapper). Nothing states whether models live in one `prisma/schema.prisma` or in Prisma 7's multi-file layout partitioned per module, who owns cross-module relation fields (e.g. `Order` ↔ `Study`), or how migrations are sequenced when two modules are authored in parallel. This is the mechanical friction point the per-module flow will hit first, in week one.

**Minimal fix:** one convention line: schema file layout, ownership rule for relation fields, and migration naming/sequencing.

#### F-16 — No test-strategy or CI dimension
**Section:** absent throughout

No test framework, no test-location convention, no CI gate. This matters here for three specific reasons rather than as a generic complaint: (a) AD-1's boundary rule ("no direct cross-module Prisma access") is only real if something mechanically enforces it — a lint rule in CI is the cheapest enforcement and the spine mandates the rule without an enforcer; (b) NFR-1 explicitly plans a cross-tenant isolation test suite for Phase 2, and RLS policies written in Phase 1 with no tests are policies nobody can refactor safely later; (c) AD-9 mandates simulated HL7/ASTM messages in dev and preview, which is a test-fixture requirement with no home in the source tree.

**Minimal fix:** name the test runner, the location convention, and the one or two CI gates that make AD-1 and AD-3 enforceable rather than aspirational.

### LOW

#### F-17 — Frontmatter metadata is stale relative to the revision
`updated: '2026-07-28'` while the memlog records the re-distill on 2026-07-30; `status: draft` while eleven of twelve ADs are tagged `[ADOPTED]`. Trivial, but this is the field downstream readers use to decide whether they are looking at the current spine.

#### F-18 — AD-5 and AD-6 lack the `[ADOPTED]` tag every other AD carries
Ten of twelve ADs are tagged. AD-5 and AD-6 are not — and they are the two that carry FR-74a, the capability this spine was largely convened to resolve. The memlog shows both were decided (AD-6 as an explicit correction supported by the client's label photos), so this is almost certainly a transcription omission, but as written their binding force is ambiguous relative to their neighbors.

#### F-19 — Serwist's stack note argues for the library rather than stating the invariant
The note "`next-pwa` is archived/unmaintained, Serwist is its actively-maintained successor" is good rationale, but it lives in a Stack cell where the rest of the column states facts. Combined with F-9's substantive point (no PWA/offline *rule* anywhere), the effect is that NFR-6 reads as answered because a justification is present.

#### F-20 — Cross-artifact conflict: signature capture phase
EXPERIENCE.md marks the delivery signature pad as Phase 1 ("Firma de recibido digital… (Phase 1)"); PRD FR-45 and FR-81 place on-screen signature in Phase 2. Not the spine's finding to own, but it lands on the spine's plate via F-2 (a captured signature is another blob needing a home), so it is worth surfacing to whoever reconciles next.

---

## 3. What the revision got right

Recording this deliberately, because the failures above are concentrated in the new material and it would be easy to read this review as broader than it is.

- **AD-1 → AD-9 are solid spine work.** AD-1's rule is mechanically checkable and its concrete example (`kanban` reads order state through the `orders` interface, never by querying `Order`) is the right shape for a rule at this altitude. AD-2's reasoning is genuinely load-bearing rather than a preference restated — it identifies that Supabase's RLS advantage evaporates once auth isn't Supabase Auth, which correctly turns a coin-flip into a decision. AD-5/6/7 resolve the one hard technical question in this project (a serverless host cannot hold a device connection) with a topology that also respects a real client constraint (no new hardware), and AD-6's rejection of a per-tube Sample entity — grounded in the client's actual labels rather than in LIS orthodoxy — is the single best decision in the document.
- **Challenging the owner's stack rather than ratifying it.** Next.js "14+" → 16.2.x, NextAuth v5 → Better Auth (with the maintenance-mode reasoning stated), Supabase-or-Neon → Neon. The memlog shows each was verified with dated sources. Many spines rubber-stamp the owner's list.
- **AD-4's evidence trail.** The amendment explicitly separates what the PRD says ("unique per-tenant folio") from what the client's labels show (daily reset) and then explains why the composite key stays collision-safe (the date is embedded in the folio string). That is exactly the right response to the reconcile's finding 1.4 — it fixed the *epistemics*, not just the wording.
- **The `quimiaio-prompt-maestro.md` §10 supersession note.** A cited source is explicitly overridden in writing rather than silently diverged from. This is the discipline F-3 and F-9 are asking for, applied correctly elsewhere in the same document.
- **AD-9's "agents only in production" rule.** An enforceable invariant that prevents a specific, plausible, expensive mistake (exercising driver code against a live clinical analyzer).
- **The Zod broadening is correct in substance.** Extending validation from env config to every API request/response payload closes a real hole; the only complaint (F-9) is that its two sibling mandates from the same source sentence were not brought along.

---

## 4. Required before this leaves draft

Blocking:
1. **F-1** — define the non-session DB path (login, portal token, agent API key) inside AD-3, or every module invents one.
2. **F-2** — name the object store and add the attachment entity.
3. **F-3** — promote the order/study state model out of Deferred; correct the false justification.
4. **F-4** — mandate role separation and `FORCE ROW LEVEL SECURITY`, or AD-10 and AD-3 enforce nothing.

Strongly recommended before epics are authored: **F-5** (route/tenant topology), **F-6** (fix the poll interval and name the fetching mechanism), **F-7** (retention vs. recovery), **F-9** (companions + UI conventions + offline rule).

Cheap and worth doing in the same pass: **F-8**, **F-11**, **F-13**, **F-17**, **F-18**.
