---
review: version-and-reality-check
lens: 'Every committed decision must be web-researched or reality-checked, not asserted from training data: current library/framework versions, continued existence and fit of each named technology, and the live defaults of any starter it leans on.'
target: ARCHITECTURE-SPINE.md (architecture-quimiaio-2026-07-28)
reviewed: '2026-07-30'
method: live web research (WebSearch + WebFetch against vendor blogs, npm, GitHub, official docs)
verdict: MOSTLY VERIFIED — 2 high-severity staleness/under-pinning findings, 3 medium, 3 low
---

# Reviewer Gate — Version & Reality Check

## Scope of this lens

I did not review architecture quality, module boundaries, or data modelling. I checked one thing: **is every named technology and version claim in this spine still true on 2026-07-30, was it plausibly checked against reality rather than recalled, and has something better-fitting emerged since.**

Every row of the Stack table and every AD carrying a version or "current" status claim was independently researched. The two claims the brief singled out — Better Auth vs. Auth.js maintenance mode, and Serwist vs. next-pwa — were verified against primary sources rather than the spine's own assertion.

## Verdict

**The spine is unusually well-researched for its era-sensitive rows.** Two of its riskiest claims (shadcn/ui defaulting to Base UI, Auth.js in maintenance mode) are not only correct but *freshly* correct — the Base UI default landed in the same month the spine was written, which is not something a model recalls from training data. Serwist and Prisma 7 are likewise accurate.

The failures are concentrated in the rows nobody bothered to check because they *felt* safe: **TypeScript "5.x"** is two majors stale, and **Next.js "16.2.x"** is under-pinned across an active security release with a CVE that directly defeats this app's auth model. Five Stack rows carry no version at all, which is a strange thing for a document whose stated job is preventing divergence.

---

## Findings

### F1 — HIGH — TypeScript "5.x" is two majors stale and reads as a training-data default

**Spine claim:** Stack table — `TypeScript | 5.x, strict mode | Phase 1`

**Reality on 2026-07-30:**

- **TypeScript 6.0 shipped 2026-03-23** — the last release built on the original JavaScript codebase, carrying a deliberately large deprecation wave designed to prepare codebases for 7.0. ([Microsoft devblog](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [Visual Studio Magazine](https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx))
- **TypeScript 7.0 hit GA 2026-07-08** — the full Go-native compiler rewrite, ~8–12x faster type-checking (VS Code codebase: 125.7s on TS6 → 10.6s on TS7). ([Microsoft devblog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [The Register](https://www.theregister.com/devops/2026/07/09/speedier-type-checks-in-typescript-70-as-first-stable-go-release-ships/5268828))

So the spine names a version line that is **two majors behind**, three weeks after the successor went GA, with no note acknowledging either newer major exists. Next.js 16 only requires TypeScript >= 5.1.0 ([Next.js upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)), so "5.x" technically *builds* — but nothing in the spine demonstrates that was a decision rather than a default.

**Two secondary problems in the same row:**

1. **"strict mode" is now a redundant qualifier.** In TypeScript 7.0 strict mode and the 6.0 deprecations became *hard defaults*. Writing "5.x, strict mode" as an invariant describes a world that no longer needs the invariant stated.
2. **Do not resolve this by jumping to TS 7.** TypeScript 7.0's npm package ships the Go compiler and **no longer includes `lib/typescript.js`** (the JS Compiler API). Next.js depends on that API for TS detection, type-checking and `next.config.ts` — upgrading to `typescript@7.0.2` causes **`next build` to stop detecting TypeScript and abort**. Support has landed in `next@canary` behind an experimental flag (PR #95639), not in the 16.2 stable line. ([vercel/next.js discussion #95633](https://github.com/vercel/next.js/discussions/95633), [ecorpit on Next 16.3 + TS 7](https://ecorpit.com/nextjs-16-3-typescript-7-rust-go-toolchain-2026/))

**Recommended correction:** pin **TypeScript 6.x** (currently the last JS-API-compatible major, and the deliberate migration runway to 7), drop "strict mode" as a stated invariant or restate it as `"strict": true` in `tsconfig` for 6.x where it is still opt-in, and record a **TS 7 upgrade gate**: adopt only once Next.js ships non-experimental TS 7 support on a stable LTS line. Serwist has already moved to TypeScript 7.0 in its July 2026 maintenance release, so the ecosystem pressure is real and this gate will come due during Phase 1.

---

### F2 — HIGH — `Next.js 16.2.x` is under-pinned across an active security release, and one CVE directly defeats this app's auth model

**Spine claim:** Stack table — `Next.js (App Router) | 16.2.x | Phase 1`

**Reality on 2026-07-30:** the *line* is correct. **16.2 is Active LTS**, 15.5 is Maintenance LTS, and 16.3 exists only as canary/preview (`v16.3.0-canary.92`, `v16.3.0-preview.7`). Next.js 16 is the current major. ([Next.js EOL data](https://eosl.date/eol/product/nextjs/), [Next.js blog](https://nextjs.org/blog/july-2026-security-release))

The problem is the `.x`. On **2026-07-20** Vercel published the July 2026 security release patching **nine CVEs**, with fixes in **v16.2.11** (Active LTS) and v15.5.21. A `16.2.x` range permits 16.2.0 through 16.2.10 — every one of them unpatched. ([July 2026 Security Release](https://nextjs.org/blog/july-2026-security-release))

**The one that matters most for Quimia IO — CVE-2026-64642 (High):**

> "Next.js applications using App Router built with Turbopack and a single entry in `config.i18n.locales` are vulnerable to a middleware/proxy bypass. Accordingly, **any authentication or security checks that a middleware/proxy may perform are bypassed**." ([CVE-2026-64642](https://www.cve.org/CVERecord?id=CVE-2026-64642))

Read that against this spine. Quimia IO is App Router, Turbopack-era Next 16, a **single-locale (es-MX) Mexican lab system**, and AD-8 binds "all modules that perform session/role checks" — with NFR-1 tenant isolation and NFR-7 audit immutability sitting on top. This is the precise configuration the CVE describes, in an application where a middleware bypass means cross-tenant access to patient results.

Also relevant given the spine's Server-Actions-centric module design (AD-1: "each owns its routes, server actions"): **CVE-2026-64641** (DoS via crafted Server Action requests, blocks the whole process), **CVE-2026-64649** (SSRF in Server Actions), and **CVE-2026-64643** (unauthenticated disclosure of Server Function endpoint IDs).

**Recommended correction:** pin `next@>=16.2.11` explicitly in the Stack table, and add a one-line invariant that the app tracks the Next.js Active LTS security line (Vercel now uses a **preannounced** security release model, so this is schedulable rather than reactive). If a `config.i18n.locales` single-entry config is planned for es-MX, note CVE-2026-64642 as the reason the patch floor is non-negotiable.

---

### F3 — MEDIUM — Prisma 7 is correctly named, but its breaking-change surface is asserted away

**Spine claim:** `Prisma | 7.x (Rust-free, TS-native runtime) + Client Extension wrapper`, plus AD-3 mandating a single Prisma Client Extension wrapper doing `SET LOCAL app.tenant_id`.

**What checks out:**

- Prisma ORM 7.0 is real and shipped, with the Rust query engine replaced by a TypeScript implementation: up to 3.4x faster queries, bundle ~14MB → ~1.6MB. Current release line is 7.x (7.2.0 announced; 7.9/7.10-dev in the July 2026 changelog). ([Prisma 7.0 announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0), [Prisma 7.2.0](https://www.prisma.io/blog/announcing-prisma-orm-7-2-0), [Prisma changelog](https://www.prisma.io/changelog), [InfoQ](https://www.infoq.com/news/2026/01/prisma-7-performance/))
- **Client Extensions are safe to build on.** GA since 4.16.0, no preview flag, and in Prisma 7 they are explicitly *the* replacement for the removed `$use` middleware. AD-3's design is sound and forward-compatible. ([Prisma v7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7))
- **AD-3's `SET LOCAL`-inside-a-transaction pattern is the correct one for Neon.** Neon's pooler returns the backend connection to the pool after each transaction, so plain `SET` would leak a tenant id onto a connection later reused by a different tenant; `SET LOCAL` scoped to a transaction is the documented safe form, and Neon supports RLS reading `current_setting('app.tenant_id')`. The spine got the security-critical detail right. ([Neon + Prisma](https://neon.com/docs/guides/prisma), [RLS/pooling analysis](https://vibe-eval.com/safety/neon/))
- **"Prisma 7 is the right choice today"** is correct: *Prisma Next*, the TypeScript-native rewrite aimed at AI coding agents, is in early access and becomes **Prisma 8** at GA. Until then Prisma 7 is the production line. Worth logging as a Phase 2 watch item, because Prisma Next adds **native RLS policy authoring in the schema and in TypeScript** — which would eventually simplify AD-2/AD-3 considerably.

**What is asserted rather than researched:** Prisma 7 is a hard-breaking major, and none of its setup contract appears anywhere in the spine even though AD-3 makes the Prisma client the single chokepoint of the entire system:

- The `datasource` block **no longer takes a `url`** — connection config moves to `prisma.config.ts` plus an explicit driver adapter (`@prisma/adapter-pg` for Postgres).
- The generator **`output` path is now required**, and the client must be imported from that path, not `@prisma/client`.
- Prisma 7 **no longer auto-loads environment variables** — they must be loaded explicitly before client construction.
- ESM-related breaking changes.

([Prisma v7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [prisma/prisma#28573](https://github.com/prisma/prisma/issues/28573))

This is not academic: the **Better Auth + Prisma 7 + `@prisma/adapter-pg`** combination this spine commits to has a live failure report — `P1010 "User was denied access"` at runtime while `db push` succeeds — rooted in exactly these import/env-loading changes. ([better-auth discussion #6529](https://github.com/better-auth/better-auth/discussions/6529), [better-auth#6112 "Documentation Update for Prisma v7 Patterns"](https://github.com/better-auth/better-auth/issues/6112))

**Recommended correction:** AD-3 should state the Prisma 7 contract explicitly, because it is the thing every module depends on and the thing an AI-assisted build will get wrong from training-data recall: `prisma.config.ts` + `@prisma/adapter-pg`, required generator `output`, client imported from that output path, explicit env loading. Also drop or soften **"Rust-free"** — it is Prisma's own marketing framing and is contested in detail ([counter-analysis](https://zenn.dev/sora_kumo/articles/prisma-7-rust-free?locale=en)); "TypeScript-native client runtime" is the claim that survives scrutiny.

---

### F4 — MEDIUM — "React-PDF / jsPDF" names two mutually-exclusive packages, one of which cannot do the job

**Spine claim:** `React-PDF / jsPDF | unpinned | Phase 1 — tickets, work orders, container labels`

"React-PDF" is not one library. Two unrelated packages answer to that name:

| Package | Maintainer | Current | What it does |
| --- | --- | --- | --- |
| `react-pdf` | wojtekmaj | **10.4.1** | **Displays** existing PDFs in React |
| `@react-pdf/renderer` | diegomura | **4.5.1** | **Creates** PDFs from React components |

([react-pdf npm](https://www.npmjs.com/package/react-pdf), [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer), [PkgPulse comparison](https://www.pkgpulse.com/blog/react-pdf-vs-react-pdf-renderer-vs-jspdf-pdf-in-react-2026))

The spine's use case — printing container labels, payment tickets and work orders on order save (FR-22) — is **generation**. A developer or coding agent reading "React-PDF" will plausibly `npm i react-pdf` and install a viewer. Given AD-1's whole premise is preventing divergence between modules built by different agents, an ambiguous package name in the Stack table is the exact class of defect this document exists to eliminate.

Second problem: the slash. Two PDF libraries with no rule for choosing between them means `orders` prints labels with jsPDF and some later module renders work orders with `@react-pdf/renderer`, and FR-22's output diverges. Pick one, or state the boundary (e.g. `@react-pdf/renderer` for document-shaped output, jsPDF only for direct thermal/label byte output).

Compatibility, for the record, is fine: `@react-pdf/renderer` supports React 19 since v4.1.0; jsPDF is at **4.2.1** and framework-agnostic; the old Next.js App Router crash with react-pdf was fixed in 14.1.1, well below Next 16. ([react-pdf.org compatibility](https://react-pdf.org/compatibility), [jspdf npm](https://www.npmjs.com/package/jspdf))

**Recommended correction:** replace the row with the exact package name and a pinned major — `@react-pdf/renderer ^4.5` — and either drop jsPDF or scope it explicitly.

---

### F5 — MEDIUM — qrcode.react is effectively unmaintained, and it sits in the patient-facing portal

**Spine claim:** `qrcode.react | unpinned | Phase 1 — patient-portal QR`

**Reality:** latest published version is **4.2.0, roughly two years old**. No npm release in over 12 months; Snyk's assessment is that it "could be considered as a discontinued project or one that receives low attention from its maintainers." ([qrcode.react npm](https://www.npmjs.com/package/qrcode.react), [Snyk](https://security.snyk.io/package/npm/qrcode.react), [changelog](https://github.com/zpao/qrcode.react/blob/trunk/CHANGELOG.md))

This is not a five-alarm fire — it still pulls ~6.3M weekly downloads with 1,300+ dependent projects, and a QR renderer is a small, stable problem. But three things make it worth flagging:

1. It is **unpinned** in a spine whose purpose is invariants, on a package whose maintainer is absent.
2. It is the only third-party dependency on the **public patient/doctor portal** (`r/[token]`) — the app's one unauthenticated surface.
3. **No React 19 support statement exists** from the maintainer, and this stack is React 19.2 under Next 16. Working-in-practice is likely; guaranteed-by-maintainer is not.

Notably, the spine's *own reasoning pattern* would have caught this: it correctly rejected `next-pwa` for being archived (F-verified below), but applied no such maintenance check to qrcode.react. The lens was applied inconsistently.

**Recommended correction:** pin it, and record the maintenance risk with a named fallback. Live alternatives: [`react-qr-code`](https://www.npmjs.com/package/react-qr-code), [`@qrcode/react`](https://www.npmjs.com/package/@qrcode/react). Or generate portal QRs server-side with the plain [`qrcode`](https://www.npmjs.com/package/qrcode) package and ship an `<img>`, removing a client dependency from the public surface entirely.

---

### F6 — LOW — Node 24 LTS is accurate today and expires mid-project

**Spine claim:** `Node.js | 24 LTS | Phase 1 — on-site equipment-interfacing agent runtime`, echoed in AD-5 and the dependency diagram ("Node 24 agent process").

**Accurate as of 2026-07-30:** Node.js 24 is **Active LTS**, Node 22 is Maintenance LTS, Node 26 (released 2026-05-05) is Current. For production stability, Node 24 is the correct pick today. ([endoflife.date/nodejs](https://endoflife.date/nodejs), [Node.js 26 release](https://www.inmotionhosting.com/support/news/nodejs-v26-released/))

**The forward-looking gap:** Node 24 leaves Active LTS on **2026-10-28**, when Node 26 takes over. The spine's scope line commits to "17-week build ... through production go-live" from 2026-07-28 — landing around late November. **The on-site agents go live on lab PCs onto a runtime that has already dropped to Maintenance LTS**, and these are unmanaged client machines (AD-7 explicitly avoids certificate management for that reason), i.e. the machines least likely to get a runtime upgrade later.

Also worth knowing: **October 2026 changes the Node release model entirely** — one major per year, version numbers aligned to the calendar year, and every release becomes LTS. Node 26 is the last release under the old model. ([Evolving the Node.js Release Schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule), [nodejsdesignpatterns.com](https://nodejsdesignpatterns.com/blog/nodejs-release-schedule-changes/))

**Recommended correction:** keep Node 24 (correct today), but note the Oct 2026 transition and decide now whether the agents install on 24 and get a planned bump, or target 26 given go-live timing. On unmanaged lab PCs, "we'll upgrade later" tends to mean never.

---

### F7 — LOW — AD-9's branch-per-PR topology vs. Neon's current branch limits

**Spine claim:** AD-2 and AD-9 lean on Neon's copy-on-write branching for the per-module SPEC→SCHEMA flow and an "ephemeral Neon branch per PR."

**Neon is healthy and the capability is real.** Acquired by Databricks (~$1B, May 2025) but very much alive and improved: compute pricing down 15–25%, storage down ~80% to $0.35/GB-month, Scale tier gained SOC 2 Type 2 and HIPAA eligibility — the last being genuinely relevant to a clinical lab system. Branch-per-PR is explicitly a supported pattern, and point-in-time restore / continuous backup (AD-12, NFR-8) is intact. ([Neon after Databricks](https://www.buildmvpfast.com/blog/neon-serverless-postgres-databricks-comparison-pricing-2026), [Neon pricing 2026](https://www.saaspricepulse.com/tools/neon))

**The unverified operational detail:** Neon's free tier now caps **10 branches per project** (alongside 100 CU-hours/month and 0.5 GB storage per project). A per-PR ephemeral branch strategy hits that ceiling quickly without automated cleanup on PR close. ([Neon free tier 2026](https://agentdeals.dev/vendor/neon), [pricing breakdown](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/))

Also unevaluated: **Neon Auth** now ships on the free tier (60K MAU). Not a reason to revisit AD-8 — Better Auth is the stronger call for a self-owned RBAC/multi-tenant model, and AD-2's whole point is that the app must not depend on host-provided auth session variables — but it is an option that did not exist when this kind of decision was last made in training data, and the spine does not mention it.

**Recommended correction:** one line in AD-9 stating branch cleanup on PR close, or the tier the project runs on.

---

### F8 — LOW — Five Stack rows pin nothing, and one row assigns one version to two products

Two precision defects in the Stack table:

**"v4" attached to "Tailwind CSS + shadcn/ui".** v4 is Tailwind's version. shadcn/ui has no v4 — it is unversioned, distributed by copy-in via the CLI. The row conflates two products under one number. (Tailwind v4 itself is *correct*: current is **4.3.3**, released 2026-07-16, and **there is no v5** — ([endoflife.date/tailwind-css](https://endoflife.date/tailwind-css), [eosl.date](https://eosl.date/eol/product/tailwind-css/)).)

**Five rows carry "current" or "unpinned" as their version:** Better Auth, Serwist, Resend, qrcode.react, React-PDF/jsPDF. For a document whose declared `purpose: build-substrate` and whose stated reason for existing is preventing divergence between modules built by different agents at different times, "current" is not a version — it means whatever npm serves on the day each module gets built. That is the divergence this spine was written to prevent, spelled out in its own Stack table.

Two of those unpinned rows have specific reasons to be pinned:
- **Better Auth** issued a **security update in June 2026**; 1.6.14 is the stated stable floor and stable projects are told to stay on the latest 1.6.x. Current is **1.6.25**; 1.7.0-rc.0 is in beta. "current" would silently pull a release candidate at the wrong moment. ([Better Auth security update June 2026](https://better-auth.com/blog/security-update-june-2026), [npm](https://www.npmjs.com/package/better-auth))
- **qrcode.react** — see F5.

**Recommended correction:** pin a major/minor floor per row (`better-auth ^1.6.14`, `@serwist/next ^9.5`, `@react-pdf/renderer ^4.5`, etc.). Ranges are fine; absence is not.

---

## Verified accurate — claims that survived independent checking

These were checked and hold. Recorded so a later reader does not re-litigate them.

### AD-8 — "Auth.js v5 / NextAuth is in maintenance mode" — CONFIRMED, and the spine understates it

The brief asked me to verify this independently rather than trust the spine. **It is true, from the primary source — the NextAuth repo itself.**

In [nextauthjs/next-auth discussion #13252, "Auth.js is now part of Better Auth"](https://github.com/nextauthjs/next-auth/discussions/13252) (posted 2025-09-26), the Auth.js maintainers write that "our pace slowed over the past year. Maintainers moved roles, time was tight, and the surface area outgrew what we could responsibly support," that "maintenance will continue for security and urgent issues," and — decisively — that **"if you're starting something new (or planning a refresh), we recommend Better Auth as the best way forward for most teams."** Maintainer Bekacru adds: "We don't have any immediate plans for v5."

The spine says Auth.js's "own maintainers have placed [it] in maintenance mode and redirect new projects away from." That is accurate to the source. If anything it is *conservative* — the situation is not merely maintenance mode, it is a **stewardship handover to the Better Auth team**, with Auth.js positioned as a legacy option for existing codebases. Corroborated by [independent 2026 comparisons](https://www.buildmvpfast.com/blog/better-auth-vs-clerk-vs-authjs-nextjs-decision-tree-2026). AD-8 is well-founded; only the version pin (F8) needs attention.

### Serwist / `@serwist/next` — "next-pwa is archived, Serwist is its successor" — CONFIRMED

Also verified independently rather than from the spine's assertion. The chain is real and traceable:

- `shadowwalker/next-pwa` — last release **2022-12-18**; the repo's own [issue #503](https://github.com/shadowwalker/next-pwa/issues/503) is titled "Last release was in Dec 18, 2022, please use DuCanhGH/next-pwa," and [issue #508](https://github.com/shadowwalker/next-pwa/issues/508) is "Is this package still developed?"
- The [serwist/next-pwa GitLab repo is explicitly archived](https://gitlab.com/serwist/next-pwa), moved to GitHub under DuCanhGH.
- DuCanhGH then built **Serwist** as the Workbox-based successor, which is how the ecosystem now describes it. ([Serwist as next-pwa successor](https://javascript.plainenglish.io/building-a-progressive-web-app-pwa-in-next-js-with-serwist-next-pwa-successor-94e05cb418d7))

**And it is genuinely actively maintained**, not merely nominally: `serwist` **9.5.12** shipped **2026-07-22** (eight days before this review), including a bump to TypeScript 7.0; `@serwist/next` is at **9.5.11**. ([serwist npm](https://www.npmjs.com/package/serwist), [@serwist/next npm](https://www.npmjs.com/package/@serwist/next), [releases](https://github.com/serwist/serwist/releases))

The spine's NFR-6 choice is correct and current. Note the irony flagged in F1: Serwist has already moved to TypeScript 7 while this spine pins TypeScript 5.

### shadcn/ui defaults to Base UI over Radix — CONFIRMED, and impressively fresh

This is the strongest evidence the spine's author actually researched rather than recalled. Base UI became the shadcn/ui default in **July 2026** — the same month the spine was written — per shadcn's own changelog: [July 2026 — Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default).

`npx shadcn init` now selects Base UI; docs default to the Base UI tab; the community chose it 2:1 over Radix on `shadcn/create`; `@base-ui/react@1.6.0` has 6M+ weekly downloads and primitives Radix never shipped (Combobox, Autocomplete, Number Field, Checkbox Group, object-valued Select). **Radix is not deprecated** — still fully supported, every component ships for both, and non-interactive CI can pin the old default with `shadcn init -b radix`.

The spine's parenthetical "(defaults to Base UI over Radix)" is exactly right, including the word "defaults." This is a live starter default correctly captured. Worth adding the `-b radix` escape hatch as a note if any tooling runs `shadcn init` non-interactively.

### Resend — healthy, no action

Active and shipping: Broadcast API (Feb 2026), n8n integration (Feb 2026), official Vercel Chat SDK adapter (Mar 2026), Java SDK. **99.98% uptime April–July 2026.** ([Resend changelog](https://resend.com/changelog), [status](https://resend-status.com/)) Only the missing pin (F8) applies.

### Vercel, Railway/VPS — no claims to check

Vercel carries no version and Railway is a Phase 2 rehost target. Nothing stale.

### Phase 2 rows — exist, with context the spine will need later

Both are flagged **Phase 2 only**, so no Phase 1 exposure. Recording current reality so the Phase 2 decision starts from facts:

- **Twilio (WhatsApp):** alive and a leading BSP, but the ground has moved. Meta **deprecated the on-premises WhatsApp Business API on 2025-10-23** — Cloud API is now the only supported architecture — and **conversation-based pricing was replaced by per-message pricing effective 2025-07-01**. Twilio sits on top of Cloud API and adds roughly $0.005–$0.010/message over Meta's base rate. The un-evaluated alternative is **going direct to WhatsApp Cloud API**, which did not meaningfully exist as the default path in older guidance. Also note the **2026-01-15 ban on general-purpose AI chatbots** on WhatsApp Business — irrelevant to transactional result notifications, relevant if Phase 2 ever adds a conversational agent. ([Cloud API vs Business API migration](https://ominiflow.com/blog/whatsapp-cloud-api-vs-business-api), [Twilio WhatsApp 2026](https://chatarmin.com/en/blog/twilio-whats-app-api), [TechCrunch on the chatbot ban](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform))
- **Stripe:** current API version **`2026-06-24.dahlia`**; Mexico support has expanded (Stripe Tax now covers Mexico-located businesses; revenue sharing available in Mexico). Fine for Phase 2, and relevant to the deferred CFDI work. ([Stripe versioning](https://docs.stripe.com/api/versioning), [Sessions 2026 announcements](https://stripe.com/blog/everything-we-announced-at-stripe-sessions-2026), [Stripe MX pricing](https://stripe.com/en-mx/pricing))

---

## What this lens could not check

Two honest gaps, so nobody mistakes silence for verification:

1. **No starter is named.** The spine never states whether the project bootstraps from `create-next-app`, `shadcn/create`, or a hand-rolled tree, so I could verify shadcn/ui's live init default (correct) but had nothing to check `create-next-app`'s current defaults against. For a greenfield build, the starter's live defaults are a genuine source of drift — name it.
2. **The BS-240Pro protocol open item is correctly left open.** The spine lists it under Deferred as unconfirmed, requiring the client's actual host-interface manual. That is the right posture and not a staleness defect — flagging only that it remains the single largest unverified technical dependency in FR-74a, and no amount of web research substitutes for that manual.

---

## Priority order for remediation

| # | Severity | Fix |
| --- | --- | --- |
| F2 | HIGH | Pin `next@>=16.2.11`; note CVE-2026-64642 (single-locale + Turbopack middleware bypass) as the reason |
| F1 | HIGH | Move TypeScript pin to **6.x**; drop/restate "strict mode"; add an explicit TS 7 upgrade gate tied to non-experimental Next.js support |
| F3 | MEDIUM | Add the Prisma 7 setup contract to AD-3 (`prisma.config.ts`, `@prisma/adapter-pg`, required generator `output`, explicit env loading); soften "Rust-free" |
| F4 | MEDIUM | Replace "React-PDF / jsPDF" with `@react-pdf/renderer ^4.5`; drop or scope jsPDF |
| F5 | MEDIUM | Pin qrcode.react, record its maintenance risk, name a fallback (or generate QR server-side) |
| F8 | LOW | Pin the five "current"/"unpinned" rows (Better Auth floor `^1.6.14`); split the Tailwind/shadcn row |
| F6 | LOW | Note Node 24's 2026-10-28 Active-LTS exit against go-live timing; decide 24-with-planned-bump vs. 26 |
| F7 | LOW | State branch cleanup on PR close (or the Neon tier) in AD-9 |
