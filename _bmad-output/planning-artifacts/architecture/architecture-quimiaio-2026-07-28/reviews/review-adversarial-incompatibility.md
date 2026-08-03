---
title: "Adversarial Incompatibility Review — ARCHITECTURE-SPINE (Quimia IO)"
reviewer_lens: "Construct two units one level down that each obey every AD to the letter yet still build incompatibly"
target: architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md
status: final
created: 2026-07-29
---

# Adversarial Incompatibility Review — Architecture Spine

**Lens.** I am not checking whether the 12 ADs are individually correct or well-reasoned — they mostly are. I am attacking the spine as an adversary who *wants* two builders to diverge: for each candidate seam, I construct two concrete units one level down (epic / module / SPEC→SCHEMA pass), prove each unit obeys **every** AD-1 through AD-12 literally, and then show they still produce incompatible builds — clashing shared-data shapes, two owners of one entity, or conflicting state-mutation paths. Every such pair is a hole that a new or tightened AD must close.

**Verdict up front.** The spine's *technology* decisions are tight and hard to diverge from (AD-2, AD-7, AD-8, AD-9, AD-11, AD-12 leave almost no room). Its *ownership and mutation* decisions are not. AD-1 states an ownership **rule** but the spine never publishes an ownership **table**, so "another module's data" is undefined for every model the source tree doesn't explicitly assign — which is most of them, including `Result`, the entity two modules are both told to write. I constructed **8 incompatible-build pairs**, of which 2 are release-blocking and 1 is an outright AD-vs-AD contradiction.

---

## 0. Root cause behind most findings

AD-1 says: *"Cross-module access happens only through an explicit interface/service call — direct reads or writes into another module's Prisma models are forbidden."*

This rule is only enforceable if there is a total function `model → owning module`. The spine provides that function **partially and only in prose comments** inside the Source Tree:

| Model | Owner declared where | Declared how |
| --- | --- | --- |
| `Order`, `OrderItem`, `Payment` | Source tree | `orders/ # folio, OrderItem, Payment; owns Order data` — explicit |
| `Study`, `Analyte`, `AnalyteRef`, `StudyAnalyte` | Source tree | `catalog/ # Study, Analyte, AnalyteRef, StudyAnalyte` — explicit |
| `Patient` | nowhere | inferred from module name only |
| `Tenant` | nowhere | — |
| `User` | nowhere | `auth/ # login, session, role checks` — "checks", not "owns" |
| **`Result`** | **nowhere** | `results-capture/ # capture + validation UI/logic` — "UI/logic", conspicuously **not** "owns Result data" |
| `AuditLog` | nowhere (model itself Deferred) | — |
| `CashSession`, `Doctor`, `Role` | nowhere (Deferred) | — |

Note the asymmetry: the two modules whose ownership the spine *did* nail down got explicit "owns X data" / model-list comments. `Result` — the single most contended row in the system, written by two modules by design — got neither. That is not a nitpick; it is the generator of F1, F2, F5 and F8 below.

Second root cause: the **dependency-direction diagram declares edges for only 3 of 11 modules** (`kanban→orders`, `results→orders`, `equipment→orders`+`catalog`). `cash`, `doctors`, `delivery`, `audit`, `patients`, `auth` have **zero** declared edges. A builder cannot violate a dependency rule that was never stated, so any direction they pick is AD-1-compliant — including directions that invert (F8).

---

## F1 — `Result` has no owner, and AD-6 actively licenses a second write path `[CRITICAL]`

### The two units

**Unit A — Epic "Results Capture & Validation" (FR-27…FR-35), weeks 8–10.**
Reads AD-4 ("the owner's draft schema … is the base ERD") and takes `Result` into `src/modules/results-capture/`, since it is the module that captures and validates results. Builds:

```prisma
model Result {
  id          String @id @default(cuid())
  orderItemId String
  analyteId   String
  value       String?
  source      ResultSource   // AD-4 correction (2)
  status      ResultStatus
  @@unique([orderItemId, analyteId])   // one row per analyte per order item
}
```

…with `ResultService.upsertValue(orderItemId, analyteId, value, source)`. The unique constraint is the *natural* modeling choice for a capture form: one analyte, one field, one row; editing is an `UPDATE`. It exposes `IResultWriter` for anyone else, satisfying AD-1.

**Unit B — Epic "Equipment Interfacing" (FR-74a), same 17-week window.**
Reads AD-6 verbatim: *"The ingestion API resolves the `Order` by `(tenantId …, folio)`, validates that the analyte belongs to a `Study` the order actually requested, **then writes a `Result` with `source = INSTRUMENT`**."* It therefore writes `Result` itself — through the AD-3 wrapper, as mandated. Because a BC-5150 re-run/re-transmit is routine lab reality and destroying the first transmission would be a traceability defect, it models an instrument post as an **append-only event**:

```prisma
model Result {
  // no unique constraint — an instrument may post the same analyte N times
  receivedAt DateTime @default(now())
}
// "current value" = latest row per (orderItemId, analyteId) by receivedAt
```

### Proof both units are AD-compliant

| AD | Unit A | Unit B |
| --- | --- | --- |
| AD-1 | Owns `Result` in its own slice; exposes an interface | Never touches `Order`/`Study` directly — resolves them *through* `orders`/`catalog` interfaces exactly as the dependency diagram draws it |
| AD-3 | All writes via wrapper | All writes via wrapper |
| AD-4 | Ratifies draft `Result` + adds `source` | Ratifies draft `Result` + adds `source` |
| AD-6 | Supports mixed MANUAL/INSTRUMENT in one order | Is the literal implementation of AD-6's sentence |
| AD-10 | Writes `AuditLog` via the single entrypoint | Same |

Neither unit breaks a single rule. AD-6 does not say "calls the results-capture interface to write a Result"; it says the ingestion API **writes** it. AD-1's counter-example is `kanban`/`Order` — a *read*. Nothing in the spine tells `equipment-interfacing` that `Result` is somebody else's model, because the spine never says whose it is.

### The incompatible build

1. **Schema-level contradiction on one table.** `@@unique([orderItemId, analyteId])` versus deliberate append-many. These are not two behaviours; they are two mutually exclusive migrations. Whichever lands first breaks the other module at `prisma migrate` time — and the loser's *entire read model* ("the value" = the row, vs. "the value" = latest of N) is invalid.
2. **A clinical-safety mutation conflict with no rule.** EXPERIENCE.md is explicit: *"The tag never locks the field: a químico can still correct an `Automático` value if the instrument mis-read something."* Now sequence it: chemist corrects Hemoglobina 14.2 → 13.8 at 14:32; the BC-5150 re-transmits the original 14.2 at 14:33 (rerun, QC repeat, or the analyzer's own retry). Under Unit A's upsert, the instrument silently overwrites the human's correction and the value still renders tagged `Automático`. Under Unit B's append, the corrected human value is silently superseded by a newer instrument row — same outcome, different mechanism. **No AD states an instrument-vs-manual precedence rule.** A wrong haemoglobin on a validated, portal-visible report is the failure mode.
3. **Third legal reading — ownership partitioned by `source`.** A builder can read AD-4's `source` enum plus AD-6's write grant as: *`MANUAL` rows belong to `results-capture`, `INSTRUMENT` rows belong to `equipment-interfacing`; each owns its partition and AD-1 is satisfied at row granularity.* Nothing in AD-1 defines "a module's data" at table rather than row granularity. This produces two write paths, two audit-emission sites, and two definitions of "current".

### Close it

> **AD-13 (new) — `Result` ownership and single write path.** `results-capture` is the sole owner of the `Result` model and the sole writer of `Result` rows. `equipment-interfacing` does **not** write `Result`; it validates and normalizes an inbound instrument message and calls `resultsCapture.ingestInstrumentResult({orderItemId, analyteId, value, instrumentId, observedAt})`. Amend AD-6's wording from "then writes a `Result`" to "then hands the normalized reading to the `results-capture` interface, which writes the `Result` with `source = INSTRUMENT`."
>
> **AD-14 (new) — Instrument/manual precedence.** A manual value entered or corrected by a químico is authoritative over any subsequent instrument post for the same `(orderItem, analyte)`. A later instrument post for an analyte that already carries a manual correction is stored as a non-current observation and surfaced as a discrepancy on the capture screen; it never silently replaces the human value. Define `Result` cardinality explicitly (one current row + observation history, or versioned rows) in AD-13's ownership decision — not per module.

---

## F2 — Correcting a `Result` post-validation: mutate-in-place vs. version, and an audit payload with no contract `[CRITICAL]`

The already-decided behaviour (EXPERIENCE.md, State Patterns) is unambiguous:
- *"A validated study can only be invalidated via a mandatory logged reason, then recaptured."*
- *"every result edit (interfaced or manual, including a post-validation correction) records who/when/**before/after**"* — and *"Both surfaces read the same underlying change record."*
- Calculated-analyte recalculation **auto-invalidates** the whole study.

AD-10 puts DB-level teeth on `AuditLog` immutability. It says **nothing** about whether the `Result` row itself is ever mutated. So:

### The two units

**Unit A — `results-capture`.** Reasons: AD-4 ratified the draft, and the draft's `ResultStatus` enum literally contains `INVALIDATED`. A status field that can transition to `INVALIDATED` is a mutable row. So a correction is `UPDATE Result SET value=…, status=…` plus one `AuditLog` insert carrying before/after. **Fully AD-10-compliant** — AD-10 forbids updating `AuditLog`, not `Result`.

**Unit B — `audit` module (FR-52, FR-53, + EXPERIENCE.md's per-analyte correction-history popover).** Reasons: NFR-7 + the client's ISO 15189 pursuit means the *clinical value* history must be reconstructible, and treats itself as the system of record for prior values. Builds `AuditLog { entity, entityId, field, before, after, actorId, reason, at }` and a query API for the popover. **Also fully AD-10-compliant.**

**Unit C (equally legal) — a compliance-minded `results-capture` author, or the `delivery`/portal epic.** Reasons: an immutable clinical record means `Result` rows are append-only with `version` / `supersededById`; current = max version; `INVALIDATED` is the terminal state of a superseded row. **Also AD-4-compliant**, because AD-4 "ratifies" a draft whose `status` field is evidence for *both* readings.

### The incompatible builds

1. **A vs. C is a different ERD for `Result`.** Versioning adds columns, changes uniqueness, and changes **every** read path: the results PDF, the patient portal (`r/[token]`), FR-16's trend chart over historical results, FR-45's "previous comparable results", and delivery. Two modules cannot half-agree on this. And it compounds F1 directly: append-vs-upsert (F1) and version-vs-mutate (F2) are the *same* unresolved question reached from two different directions, which is exactly why two independent builders will land on opposite sides of it.
2. **A vs. B is a shared-data-shape clash on `AuditLog.before`/`after`.** Unit A serializes whatever shape `results-capture` happens to hold; Unit B parses per its own assumed shape. For a numeric analyte, "13.8" survives naively. For the analyte types EXPERIENCE.md actually designed, it does not: an image-analyte correction is a **reordered list of N evidence items each with an optional caption**, and a document-analyte correction is constrained rich text. `before`/`after` for a gallery reorder is a list-diff, not a scalar. The spine's Consistency Conventions table pins ID format, date format, and the API error envelope — and says **nothing** about audit-entry payload shape. Two modules, one column, two payload contracts.
3. **The audit *event catalog* has no owner.** AD-10 mandates a single write **path**; it never mandates a single event **schema or registry**. FR-52 enumerates 6 event kinds. EXPERIENCE.md independently requires at least three more: every manual Kanban drag (from-state/to-state), per-analyte correction history, and the calculated-analyte auto-invalidation cascade. FR-3 adds "unauthorized actions are blocked and **logged**". So `kanban`, `results-capture`, `cash`, `orders` and `auth` will each mint their own `action` strings and their own `details` payloads through a shared entrypoint — a single pipe carrying five private formats. FR-53's admin filter then cannot render a uniform log, which is the entire deliverable of Módulo 14.
4. **AD-10 currently guarantees the immutability of a table nobody has designed.** `AuditLog` is in the **Deferred** section ("not yet drafted … deferred to each module's own SPEC→SCHEMA authoring time") while AD-10 already commits a DB-grant strategy against it. The grant cannot be written until the model exists, and the model's shape is being left to whichever module gets there first — i.e. the spine's hardest guarantee rests on its softest artifact. Meanwhile the thing NOM-024 and ISO 15189 actually care about — the clinical result value — has **no** immutability decision at all.

### Close it

> **AD-15 (new) — Result correction semantics.** State explicitly whether a post-validation correction mutates the `Result` row (with the change record in `AuditLog`) or writes a new version (with `supersededById`), and make it binding on every read path. Recommendation: append-only versioning for `Result.value`, because it is the only shape that satisfies NFR-7 for the *clinical* record, survives the F1 instrument-repost case, and makes the correction-history popover a query over `Result` rather than a text-parse of `AuditLog`.
>
> **AD-16 (new) — Audit event contract.** `AuditLog` is owned by the `audit` module and drafted **before** any module that emits to it (i.e. before week 5, not at `audit`'s own week 13–14 slot). Emitting modules call a typed, discriminated-union `audit.record()` whose event catalog lives in `audit` and is extended only by adding a variant there. `before`/`after` are typed per variant, never free-form strings.

---

## F3 — AD-3 and AD-8 contradict each other at the auth boundary, and `app.role`'s domain is undefined `[HIGH — AD-vs-AD]`

This is the one finding where two ADs collide directly rather than leaving a gap.

- **AD-3:** *"the only path to the database is one Prisma Client Extension wrapper … It opens a transaction and runs `SET LOCAL app.tenant_id` / `app.role` **from the authenticated session** before any query. Direct `prisma.<model>` calls outside the wrapper are forbidden."*
- **AD-8:** *"authentication and session management use Better Auth exclusively."*

Better Auth owns its own core tables (user / session / account / verification), generated into `schema.prisma` and read/written through its own Prisma adapter on essentially every request. At **login** there is no authenticated session yet — so the wrapper's stated precondition ("from the authenticated session") is unsatisfiable for the very queries that create the session. If RLS is active on those tables and the wrapper cannot set a tenant, the credential lookup returns zero rows and login is impossible.

### The two units

**Unit A — `auth` epic, weeks 1–2 (the first module built).** Resolves the deadlock by exempting Better Auth's tables from RLS and handing Better Auth a plain `PrismaClient`, documenting it as a bounded exception. Tenant scoping for auth is done in application code from the subdomain. **AD-8-compliant, and a documented hole in AD-3 / NFR-1.**

**Unit B — any later module (or a security review) reading AD-3 as absolute.** Routes Better Auth through the extended client and enables RLS on its tables, resolving tenant from the subdomain *before* the session exists. This requires a two-phase wrapper (pre-auth tenant-only context, post-auth tenant+role context) — a **different wrapper API** from Unit A's, and AD-3 describes only one phase.

Both are legal readings. They produce different `shared/db` public surfaces, different RLS coverage, and a different answer to NFR-1's "every table carries `tenant_id` and RLS policies are active from day one."

### The compounding hole: what is `app.role`?

AD-2 and AD-3 both commit to `SET LOCAL app.role`, read by RLS via `current_setting()`. **Neither AD states the value domain.** With the `Role` model sitting in **Deferred**, two units answer differently:

**Unit A (`auth`, weeks 1–2):** AD-8 says Better Auth *exclusively*, and Better Auth's admin plugin models role as a **string on the user record**. So `app.role` = `'admin' | 'recepcionista' | 'quimico'`, and week-1 RLS policies are written as `current_setting('app.role') = 'admin'`.

**Unit B (`Usuarios y Roles` surface, FR-2/FR-3, and Phase 2's FR-70 permission matrix that EXPERIENCE.md has *already designed* grouped-by-module):** needs `Role` as a tenant-scoped relational entity with a permission set — exactly the draft schema's `User.roleId String` + `role Role @relation(...)`. So `app.role` should be a `Role.id`, or role should not be in `current_setting()` at all because permissions are now rows.

**Blast radius:** RLS policies are global DDL, not module-local code. They are the one artifact in this system that *cannot* be refactored per module at each module's own SPEC→SCHEMA time. If week-1 `auth` writes policies against a hardcoded role-string domain and week-13 `usuarios` introduces tenant-defined roles, every policy in the database is silently wrong — and "silently wrong RLS" is precisely the NFR-1 failure the whole AD-2/AD-3 pair exists to prevent. There is also a second identity clash underneath: Better Auth's `user` shape vs. the ratified draft's `User` (nickname, bcrypt `password`, `photo`, `active`, `roleId`, `branchId`) — two tables or one, decided by whoever ships first.

### Close it

> **AD-17 (new) — Auth-boundary carve-out and identity ownership.** State explicitly: (a) which tables Better Auth owns and whether they are RLS-governed; (b) that the AD-3 wrapper exposes a documented **pre-authentication tenant-only** context phase, resolved from the subdomain, so AD-3 and AD-8 stop contradicting; (c) whether the app's `User` is Better Auth's user record extended, or a separate profile row joined to it — and which module owns it.
>
> **AD-18 (new) — `app.role` value domain.** Pin the exact domain and stability contract of `current_setting('app.role')` **before the first RLS policy is written in week 1**. Given Phase 2's FR-70, the safe choice is a stable coarse role key (`admin|recepcionista|quimico`) used *only* for RLS, with granular permissions resolved in application code against the `Role` model — so introducing tenant-defined roles later never rewrites a policy. Additionally: promote `Role` out of Deferred, or forbid RLS policies from referencing role until it is drafted.

---

## F4 — `Order.branchId`: AD-4 ratifies a draft the Deferred section simultaneously retracts `[HIGH]`

Direct internal inconsistency in the spine. AD-4 ratifies "the owner's draft schema (`§9` — Tenant, User, Patient, **Order**, OrderItem, …)" as the base ERD, with exactly two named corrections. The draft `Order` includes `branchId String` — **non-nullable**. The Deferred section then says: *"Company, Quotation, Inventory, CFDI models, **and branch-scoping fields (`User.branchId`, `Order.branchId`)** … Phase 2 scope."*

So is `Order.branchId` in the ratified base ERD (AD-4 ratifies the draft whole, with only two exceptions, and this isn't one of them) or out of it (Deferred removes it)? AD-4 provides no rule for reconciling itself with Deferred.

### The two units

**Unit A — `orders` epic, weeks 5–7.** Follows Deferred, drops `branchId`. Single-branch Phase 1 client; nothing to scope. Legal.

**Unit B — `cash` epic, weeks 13–14 (FR-46/47/48).** Cannot drop branch, because both PRD and UX define Caja **per branch** and EXPERIENCE.md is emphatic and detailed about it: *"per branch, one active cash session per branch per 24h calendar day … whichever user is first to register a patient or order **at that branch** … once opened, it runs for everyone **at that branch**."* FR-24's gate is per-branch, FR-46 requires `(initial fund, user, branch)`, FR-48 needs per-seller detail within a branch session. So `cash` invents a branch key — either a `Branch` model plus `CashSession.branchId`, or a hardcoded singleton branch constant.

### The incompatible build

`Order` has no branch key and `CashSession` does. FR-47 — *"Every payment registers against the open session"* — now has **no join path** from an order/payment to the correct session. Unit B must either (a) reach into `orders` and demand a column on a model it does not own — a scenario AD-1 has no mechanism for (see F8), or (b) resolve the session by "the one open session, period", which quietly hardcodes single-branch into the cash ledger and makes the Phase 2 multi-branch story a data migration rather than the "additive, not a fork" change EXPERIENCE.md promises. Either way, week-5 `orders` froze a schema that week-13 `cash` needs changed, and the eight weeks between them is where the divergence hides.

**Same pattern, milder instance — `Doctor`.** The ratified draft `Order` carries `doctorId String?`; `Doctor` is Deferred. `orders` ships in weeks 5–7 with a dangling nullable FK to a model the `doctors` module will shape later, and `doctors` must then fit its model to whatever `orders` guessed the FK target's key and tenant-scoping to be. Nullable, so recoverable — but it is the same generator.

### Close it

> **Tighten AD-4:** add an explicit reconciliation rule — *"Where a field of a ratified draft model appears in the Deferred section, Deferred wins and the field is absent from the Phase 1 ERD"* — plus a per-model field-level ratification list rather than a model-name list. Then decide `branchId` deliberately: recommendation is to **keep** `Order.branchId` and a singleton `Branch` row in Phase 1, since the Phase 1 cost is one column and the Phase 2 cost of retrofitting it is a migration across `Order`, `Payment`, `CashSession`, and every report.

---

## F5 — Pipeline state: stored vs. derived, and a correction-only drag that derivation cannot express `[HIGH — three-way]`

AD-11 decides the *transport* for live views (polling). It decides nothing about who owns pipeline state or how it is represented. AD-1 makes `kanban` a pure reader — good, and genuinely closed. But it never says who **writes** `Order.status`.

Three legal units:

**Unit A — `results-capture`.** FR-31: *"Validating a study … advances the order in the pipeline when all its studies are validated."* So on Validar it computes "all studies validated" and calls `orders.advanceTo(VALIDATED)`. Treats `Order.status` as a stored column each business-event owner pushes. It also needs `OrderItem.status` — whose `ItemStatus` **values are Deferred** — so it invents `{PENDING, IN_PROGRESS, VALIDATED, INVALIDATED}` mirroring `ResultStatus`.

**Unit B — `orders`** (declared owner of `Order` data). Reasons that a stored column plus per-study derivation is two sources of truth that will drift, and that EXPERIENCE.md's *"the order-level Kanban column reflects the **least advanced study still open**"* is literally a derivation rule. So it implements `Order.status` as **derived** — a computed property or SQL view over item states — and drops the stored column. Legal: AD-1 makes `orders` the owner, free to shape its own model, and AD-4 does not specifically defend `Order.status`.

**Unit C — `kanban`.** Must implement EXPERIENCE.md's *"Cards are also draggable between columns, but only as a correction/override of an automatic transition."* If status is derived (Unit B), a manual drag is **unrepresentable**: you cannot drag an order to Validado while a study is still open, because the derived value immediately recomputes. The correction gesture therefore requires a stored override column or an override record — a fourth shape neither A nor B built.

### The incompatible build

- A ships writes to a column B deleted (or B ships a view A tries to `UPDATE`). Hard break.
- The `ItemStatus` / `ResultStatus` / `OrderStatus` layering is undecided, so: per-study validation validates every analyte in a study at once (EXPERIENCE.md), and `results-capture` may record that by setting `Result.status = VALIDATED` on each analyte while treating `OrderItem.status` as derived. `delivery` (FR-41/FR-43) and `kanban` then read `OrderItem.status` as authoritative, find it `PENDING` forever, and **the order never leaves "En análisis."** Both modules obeyed every AD; the pipeline is dead. This is the cheapest-to-cause, hardest-to-notice failure in this review, because it only manifests once two modules are integrated.
- The correction-drag override has no home, so `kanban` invents one — a stored `Order.statusOverride`, or an `audit`-only record with no effect on the board (which would silently make the documented gesture a no-op).

### Close it

> **AD-19 (new) — Pipeline state ownership and representation.** `orders` owns pipeline state and is its sole writer. Declare explicitly: (a) `Order.status` is stored, written only by `orders` in response to business events reported through its interface; (b) `OrderItem.status` is the per-study sub-state, with its `ItemStatus` values **defined now** (promote out of Deferred — it is load-bearing for FR-31, delivery, and the board), and the order-level value is recomputed by `orders` on every item transition per the least-advanced rule; (c) the correction-only manual transition is a distinct, audit-logged `orders` operation with its own override field, not a raw status write. `Result.status` governs the analyte only and never drives the board.

---

## F6 — AD-11's polling choice creates a blind-overwrite window that no AD closes `[MEDIUM-HIGH]`

**First, honestly: the angle in the brief is partly closed.** AD-11 explicitly *binds* "`results-capture`/`kanban` live views" and forbids any module introducing persistent server-push in Phase 1. So a builder cannot legally give `results-capture` a WebSocket while `kanban` polls. Credit where due — that seam is sealed.

The real hole is adjacent: **AD-11 governs transport, not concurrency.** And the polling choice has an unlogged consequence.

### The two units

**Unit A — `results-capture`.** Implements Guardar as a full-form submit of every analyte in the study — the natural shape for a Tab-driven keyboard form (FR-30) — with no optimistic-concurrency token. It is also constrained by the PWA rule (EXPERIENCE.md): on connectivity loss, locally-entered data is **held in place** and Guardar is blocked *until the connection returns*, so a client can legitimately hold form state for minutes and then submit it.

**Unit B — `equipment-interfacing`.** Posts one analyte at a time, asynchronously, whenever the analyzer produces it.

### The incompatible build

A chemist opens Biometría Hemática at 14:30. The BC-5150 posts Plaquetas at 14:31. The chemist presses Guardar at 14:32, submitting the whole form — including the empty/stale Plaquetas field she loaded at 14:30. Last-write-wins silently reverts an instrument value, and — depending on how `source` is set on a full-form write — may re-tag it `Automático` while holding a human-blank or human-stale number. With a push channel the form would have refreshed; with polling, the *read* refreshes but the *pending form state* does not. Two staff on the same order produce the same class of blind overwrite (EXPERIENCE.md's Caja section confirms 2–3 people work a shift simultaneously). No AD requires an optimistic-concurrency token, a field-level (rather than form-level) write granularity, or a merge rule. Both units are AD-compliant.

### Secondary: three uncoordinated pollers against one connection pool

NFR-5 requires Kanban state within 5 seconds, and AD-11 says polling happens "at an interval inside the NFR-5 SLA window" — i.e. ≤5s. But *how many* pollers, at what granularity, is unowned. `kanban` polls its board; `dashboard`/FR-51 polls its KPI set plus its own mini-pipeline summary; `results-capture` polls its live view. Three independent ≤5s pollers per client, ~5 concurrent staff, on Vercel serverless — against AD-3's wrapper, which **opens a transaction per request** (mandatory, since `SET LOCAL` requires one). The Stack table names Prisma 7 and Neon but contains **no pooling decision** (no pgbouncer/pooled-connection-string/driver-adapter choice). Serverless + per-request transactions + uncoordinated ≤5s polling is a known pool-exhaustion shape. Two modules each choosing their own interval and endpoint granularity is a legal divergence with a shared-resource failure mode — the system degrades from a decision no single module made.

### Close it

> **Tighten AD-11:** specify (a) one shared polling client/interval and a single aggregate live-state endpoint per surface, so poller count is a decision and not an accident; (b) the Neon connection-pooling mode that AD-3's per-request transaction requires under Vercel serverless.
>
> **AD-20 (new) — Write granularity and concurrency on `Result`.** Captura writes are **per-analyte**, not per-form, and carry an optimistic-concurrency token (`updatedAt`/version). A stale write is rejected and surfaced as a conflict on the field, never silently applied. This is the concurrency counterpart to F1/F2 and should be decided with them.

---

## F7 — `tubeType`/`tubeColor`: an ERD note that is neither ratified nor deferred, and contradicts FR-9 `[MEDIUM-HIGH]`

The ERD notes say: *"`Study` needs a `tubeType`/`tubeColor` catalog attribute (e.g. amarillo/lila/rojo) to drive how many container labels print per order and in which color (FR-22) — **catalog data, not a new entity**."*

This sits in limbo: it is not an AD, and — unlike the sibling `sampleTypeId`/`methodId`/`techniqueId`/`equipmentId` FKs — it is **not** in the Deferred section either. So it is a binding-looking sentence with no ratification status, on a model (`Study`) that AD-4 does claim as ratified with the draft's `containerId String` FK intact.

### The two units

**Unit A — `catalog` epic, weeks 3–5 (built *first*).** Follows FR-9 — *"Admin manages supporting catalogs: methods, techniques, equipment, **containers**, sample types"* — and maestro §9.7 Recipientes ("Tubo amarillo", "Frasco", "Laminilla"), and implements `Study.containerId → Container { id, tenantId, name, color }`. Tube colour is `Container.color`; one container per study.

**Unit B — a builder taking the ERD note literally.** Implements `tubeType` / `tubeColor` as **scalar attributes on `Study`**, because the note says "catalog data, **not a new entity**." No `Container` model.

### The incompatible build

1. **The ERD note contradicts FR-9.** "Not a new entity" forbids exactly the admin-managed containers catalog that FR-9 mandates and that the draft's `containerId` FK points at. `catalog` (week 3) must pick one; whichever it picks, the other requirement is unmet. Reviewers have already logged `containerId` as "the already-resolved gap" — but it is resolved *against* FR-9, and that trade was never surfaced as a correction the way AD-4's two corrections were.
2. **`Study` ends up with two competing sources of truth for one fact** if both land (a `containerId` FK *and* `tubeColor` scalars) — and the label-printing service returns different results depending on which one it reads.
3. **Label cardinality has three different rules across three binding artifacts, and no AD.**
   - FR-22: *"one per analyte/container required"* (per-analyte).
   - EXPERIENCE.md: *"one container/tube label per label the order's studies require"*, and Flow 1 renders *"2 container labels — one per tube colour the two ordered studies require"* (deduplicated per tube type).
   - AD-6: the barcode is *"identical across every tube of one order"* and tube colour is *"a phlebotomy draw-guide only, not instrument-read"* (cosmetic, no identity).

   `orders` (weeks 5–7) implements FR-22 by calling `catalog.getLabelSpecs(studyIds)` per AD-1 — and expects **a deduplicated set of distinct tube requirements with study attribution**, which is the EXPERIENCE.md rule. If `catalog` (already frozen in week 3) modelled one scalar `tubeColor` per `Study`, the common real case of a single study needing two different tubes (e.g. a chemistry panel needing both serum and a fluoride/oxalate tube for glucose) is **not expressible at all**, and the print-preview panel that EXPERIENCE.md designed specifically so Paola can catch *"a wrong tube colour from a miscatalogued study"* silently under-prints. A patient gets drawn into the wrong tube — the exact failure the preview exists to prevent.

### Close it

> **AD-21 (new) — Container/tube catalog and label cardinality.** Ratify `Container` as a real admin-managed catalog entity (per FR-9) with `Study` referencing the containers it requires as a **many-to-many** (a study may need more than one tube), and state the binding label-cardinality rule: **one label per distinct container required across the order's studies, deduplicated, each carrying its study attribution and catalog colour**, with the folio barcode identical on every label (consistent with AD-6). Then delete the "not a new entity" ERD note, or restate it as a logged correction with its FR-9 trade acknowledged.

---

## F8 — AD-1 has no mechanism for "module B needs a column on module A's model" `[MEDIUM]`

The generic form of F4, worth its own entry because it recurs across the money path and because the dependency diagram is silent for every module involved.

Source tree: `orders/ # folio, OrderItem, Payment` — `orders` owns `Payment`. But three modules mutate money state:

- `orders` — creates `Payment`, maintains the draft schema's denormalized `Order.paid` / `Order.debt`.
- `delivery` — FR-43: debt is settled **from the delivery screen** with multiple payment methods.
- `cash` — FR-47: *"Every payment registers against the open session."*

`delivery` is clean: per AD-1 it calls `orders.registerPayment()`. `cash` is not. FR-47 requires every `Payment` to be attributable to a `CashSession` — i.e. `cash` needs a `cashSessionId` **column on a model `orders` owns**. AD-1 governs *access* ("go through the interface") and says nothing about *schema extension*. Two legal resolutions:

**Unit A:** `orders.Payment` gains `cashSessionId`. Now `orders` depends on `cash` — an edge the dependency diagram does not draw, pointing the *opposite* way from the natural direction (cash reporting reads orders, not vice versa), and it makes `orders` (week 5) depend on a `CashSession` model that is **Deferred** and won't be drafted until week 13.

**Unit B:** `cash` keeps its own `CashMovement` mirror rows and reconciles against `orders` through the interface. Now there are **two ledgers**, guaranteed to diverge on any partial payment, refund, or debt settlement — and FR-48's *"theoretical vs counted"* becomes ambiguous about which ledger is "theoretical," which is the single number the corte de caja exists to produce. G5 ("discrepancy incidents <2% of sessions") then measures a reconciliation artifact rather than a cash discrepancy.

Both obey AD-1. Neither is signalled as wrong by anything in the spine, because **`cash`, `delivery`, `orders`→`cash`, `audit`, `patients` and `doctors` have zero declared edges** in the dependency diagram.

### Close it

> **Tighten AD-1:** publish (a) a complete **model → owning module** table covering all 11 modules and every model including the Deferred ones, and (b) the complete allowed dependency-edge set, with the rule that a module needing a field on another module's model must have that field added by the **owner**, in the owner's SPEC→SCHEMA pass, with the edge declared in the diagram. Decide the `Payment`↔`CashSession` direction and the single money ledger now, not in week 13.

---

## Angles probed and found genuinely closed

Stated for completeness, so the findings above are not read as a blanket indictment:

- **AD-11 vs. a second real-time mechanism.** Closed. AD-11 names `results-capture` *and* `kanban` in its binds and forbids any module introducing persistent server-push in Phase 1. A builder cannot legally split the transport story. (The hole is concurrency, not transport — F6.)
- **AD-7 agent auth.** Closed and unusually tight: per-instrument API key + HMAC over body+timestamp, with bearer and mTLS explicitly excluded. A second agent cannot invent a different scheme.
- **AD-5 / AD-9 connection direction.** Closed and restated three times (AD-5, the dependency diagram, the container view): agents are outbound-only, agents run in production only, dev/preview use simulated messages. Hard to diverge from.
- **AD-2 / AD-12 Neon.** Closed. Host, RLS mechanism (`current_setting()`, not Supabase `auth.uid()`), branching, and backup strategy are all pinned to one vendor capability. (`app.role`'s *value* is the hole — F3 — not the mechanism.)
- **`kanban` never owning `Order`.** Closed — this is AD-1's own worked example, and it is the one ownership question the spine answers unambiguously. Which is precisely why the *unanswered* ones (F1, F5, F8) read as omissions rather than deliberate latitude.

---

## Summary

| # | Incompatible-build pair | Tier | Closing AD |
| --- | --- | --- | --- |
| F1 | `results-capture` (upsert, unique per analyte) vs. `equipment-interfacing` (append-only) both writing `Result` — AD-6 licenses the second write path; no instrument-vs-manual precedence rule | **CRITICAL** | AD-13, AD-14; amend AD-6 |
| F2 | `results-capture` mutating `Result` in place vs. versioning it; plus `AuditLog` `before`/`after` with no payload contract and no event catalog owner, on a model that is Deferred | **CRITICAL** | AD-15, AD-16 |
| F3 | AD-3 ("only path is the wrapper, from the authenticated session") vs. AD-8 (Better Auth's own adapter, pre-session queries); `app.role` domain undefined while `Role` is Deferred, with RLS-wide blast radius | **HIGH** (AD-vs-AD) | AD-17, AD-18 |
| F4 | AD-4 ratifies draft `Order` (incl. non-nullable `branchId`) while Deferred retracts `branchId` — `orders` (wk 5) drops it, `cash` (wk 13) requires it, FR-47 loses its join path | **HIGH** | tighten AD-4 |
| F5 | `Order.status` stored (`results-capture`) vs. derived (`orders`) vs. override-capable (`kanban`'s correction drag); `ItemStatus` values Deferred → order can silently never leave "En análisis" | **HIGH** | AD-19 |
| F6 | Polling (AD-11) + full-form Guardar + async instrument posts = silent blind overwrite of instrument values; plus three uncoordinated ≤5s pollers against per-request transactions with no pooling decision | **MED-HIGH** | AD-20; tighten AD-11 |
| F7 | ERD note's "`tubeType`/`tubeColor`, not a new entity" vs. FR-9's containers catalog and the draft's `containerId`; three conflicting label-cardinality rules, catalog frozen in wk 3 before FR-22 is specced in wk 5 | **MED-HIGH** | AD-21 |
| F8 | `cash` needs `cashSessionId` on `orders`-owned `Payment`: either an undeclared inverted dependency or two divergent money ledgers | **MEDIUM** | tighten AD-1 |

### Minimum set to add before any module's SPEC→SCHEMA pass

The single highest-leverage action is not any individual AD but the missing artifact underneath all of them: **a complete model → owning module table plus the full dependency-edge set.** Six of the eight findings (F1, F2, F4, F5, F7, F8) collapse or become trivially detectable once that table exists.

After that, in build order:

1. **Before week 1** (RLS is global DDL and cannot be refactored per module): AD-17, AD-18.
2. **Before week 3** (`catalog` freezes first): AD-21.
3. **Before week 5** (`orders` freezes second): AD-4 reconciliation rule + `branchId` decision; AD-19 incl. `ItemStatus` values; the `Payment`↔`CashSession` direction; and AD-16, so `AuditLog` exists before the first module emits to it.
4. **Before week 8** (`results-capture`): AD-13, AD-14, AD-15, AD-20 — these four are one coupled decision about `Result` cardinality, mutability, precedence, and write granularity, and should be made together rather than discovered one module at a time.

### A note on the Deferred section as a mechanism

The spine's stated policy — *"deferred to each module's own SPEC→SCHEMA authoring time, not decided upfront in this spine"* — is sound for models used by exactly one module. It is unsafe for **shared** models, and the current Deferred list is mostly shared ones: `Role` (needed by `auth` in week 1 *and* RLS policies *and* the Phase 2 permission matrix), `AuditLog` (every module emits to it; AD-10 already commits a strategy against it), `CashSession` (needed by `orders`, `delivery`, `cash`), `ItemStatus` (needed by `results-capture`, `orders`, `kanban`, `delivery`), `branchId` (`orders`, `cash`, `auth`). For these, "deferred" resolves in practice to "invented by whichever module gets there first, and inherited unexamined by everyone after" — which is the divergence risk AD-1 exists to prevent, reintroduced through the back door. Recommend splitting Deferred into **single-owner deferred** (genuinely safe to postpone: `Doctor`, `Quotation`, `Inventory`, `CFDI`, altitude engine, FR-74b, BS-240Pro protocol) and **shared-contract deferred** (must be drafted in this spine or in a dedicated pre-week-1 pass).
