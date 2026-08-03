# Reconciliation: `quimiaio-prompt-maestro.md` vs PRD + Addendum

**Source:** `C:\Projects\QuimiaIO\quimiaio-prompt-maestro.md` (v2.0)
**Targets:** `prd.md` + `addendum.md` in `prd-quimiaio-2026-07-05/`

## Covered Summary

The PRD/addendum pair captures the overwhelming majority of the source document with high fidelity. All 15 modules are represented at the capability level, all 9 business rules in source §11 are reproduced exactly (including the specific numeric thresholds: 3 payment methods, 30-day quotation expiry, 45/90-minute Kanban alerts, altitude auto-adjustment), the patient portal (§7) and WhatsApp flows (§8) are functionally complete, and the phasing decisions (Phase 1 operational core vs. Phase 2 SaaS mechanics) are deliberate, explicit, and consistently applied — nothing was silently deferred without a phase tag or an `[ASSUMPTION]` marker. The addendum correctly quarantines all HOW-level content (tech stack, Prisma schema draft, file structure, design tokens, SDD methodology) and is transparent about its own gaps (e.g., missing Prisma models for Caja, quotations, companies, doctors, inventory, audit log, CFDI). Plan pricing ($799/$1,299/$2,099/+$399) and the Phase 1 budget/timeline ($32,000 MXN, 17 weeks) are reproduced without numeric drift. The residual gaps below are narrow: a handful of qualitative UX details from the source's "Mejoras" callouts, one plan-limit omission, one entity-field omission (doctor price lists, company type/commission), and two small wording divergences.

## Gaps

1. **Clínico plan branch limit dropped.** Source §5 table states Plan Clínico allows `1+1` sucursales (branches). PRD §10 (Business Model) and FR-62 state Reactivo's "1 branch" and Red's "up to 5 branches" explicitly, but say nothing about Clínico's branch allowance — it's the only plan whose branch limit is omitted.
   *Suggested placement:* PRD §10 / FR-62 — add "Clínico: 1 branch + 1 additional" (or clarify what "1+1" means with the client) alongside the other two plans.

2. **Doctor-specific price lists missing.** Source §6 Módulo 7 (Doctores) explicitly lists "Lista de precios especial por doctor (opcional)" as a function, parallel to the company price lists. FR-73 covers only "exclusive price lists per company" and doctor commissions — doctor-level price lists never appear in the PRD or addendum, and are not in the addendum's rejected/deferred list.
   *Suggested placement:* FR-73 (Phase 2) — extend to "exclusive price lists per doctor and per company."

3. **Patient-portal single-use token option dropped.** Source Módulo 6 "Mejoras" says the portal uses "token de 1 uso o con expiración" (a one-time-use token OR an expiring token — two distinct security models). FR-44 and §7 of the PRD only describe the expiration model (configurable 24h/7 days); the single-use alternative is never mentioned.
   *Suggested placement:* FR-44 — add single-use token as an alternative/complementary access-control mode.

4. **Dashboard mini-Kanban widget dropped.** Source Módulo 1 lists "Pipeline Kanban resumen (mini vista)" as a dashboard component. FR-51 enumerates KPI cards, 7-day chart, top-5 studies, and alerts, but never mentions the embedded mini-Kanban summary.
   *Suggested placement:* FR-51 — add the mini-Kanban summary widget (Phase 1, since Kanban itself is Phase 1 per §6.7).

5. **Fuzzy search nuance weakened.** Source Módulo 3 "Mejoras" specifically calls out "Búsqueda de estudios instantánea (fuzzy search)" — typo-tolerant matching, not just prefix/substring search. FR-18 only says "adding studies via instant search by code or name," which reads as exact/prefix search and drops the fuzzy-matching quality bar.
   *Suggested placement:* FR-18 or NFR-5 (Performance) — note fuzzy/typo-tolerant matching as an explicit requirement, not just speed.

6. **Company type and company-level commission omitted.** Source Módulo 8 (Empresas) lists fields "tipo (Empresa / Laboratorio)" and "comisión %" for companies — i.e., companies can also earn referral commissions, and are classified as either a generic company or a referring lab. FR-73 covers company CRUD, credit control, price lists, and account statements, but attributes commissions only to doctors ("doctor commissions (% of referred sales)"); the company `tipo` classification and company-level commission % never appear.
   *Suggested placement:* FR-73 — add the company type field and clarify whether companies (not just doctors) can carry a referral commission %.

7. **Role-based partial dashboard access dropped.** Source Módulo 1 states "Roles con acceso: Admin, Químico (parcial), Recepcionista (parcial)" — the dashboard has role-scoped partial views. PRD's FR-3 (generic RBAC) and FR-51 (dashboard) don't call out that Químico/Recepcionista see a reduced dashboard.
   *Suggested placement:* FR-51 — note partial/role-scoped dashboard views. (Minor.)

8. **User photo field omitted.** Source Módulo 12 lists `foto` as a User field (also present in the source Prisma schema §9, `User.photo`). Neither FR-1/FR-2 (auth/users) nor the addendum's schema-gap note mentions optional user photos.
   *Suggested placement:* FR-2 — add optional user photo. (Minor.)

9. **Minor print-affordance UX details dropped.** Source Módulo 7 ("CRUD completo con botón imprimir tabla" for doctors) and Módulo 10 ("Imprimir detalle por sucursal" in Caja) mention specific print buttons that aren't named in FR-25 or FR-48/49. Likely fine to leave to the design phase, but flagged since they're explicit source callouts with no FR trace and no rejection note. (Minor.)

## Contradictions

- **Unsourced SAT product key.** FR-82 and the §8 Regulatory Landscape table state "SAT product key 85121800 preconfigured" for CFDI. This specific code does not appear anywhere in `quimiaio-prompt-maestro.md` — it's new information introduced by the PRD without a source citation or an `[ASSUMPTION]` tag. It should either be tagged as an assumption to verify or sourced/confirmed with the client before being stated as settled fact.

- **Audit action wording diverges from source.** Source §11 Módulo 14 says the audit log records "Creación/eliminación de usuarios" (user creation/**deletion**). PRD FR-52 says "user creation/**deactivation**." This is a meaningful behavioral difference (hard delete vs. soft delete) — likely the PRD's version is the technically correct choice (audit trails shouldn't reference hard-deleted rows), but it silently changes the source's stated behavior without flagging the deviation.

## Verdict

No functional capability, module, or business rule from the source is missing outright — coverage is thorough and the phasing decisions are sound and well-justified. The issues found are all narrow: one plan-limit omission (Clínico branch count), a small number of entity-field/UX details dropped from the source's "Mejoras" and field-list callouts (doctor price lists, company type/commission, dashboard mini-Kanban, fuzzy search, portal single-use token, user photo, print buttons), and two low-risk wording divergences (an unsourced SAT product key, and creation/deletion vs. deactivation in the audit log). None of these block downstream spec/design work, but items 1–6 above are worth folding into the PRD or addendum before they're used as the baseline for FR/spec generation, since they represent explicit source statements that never landed anywhere and were never explicitly rejected.
