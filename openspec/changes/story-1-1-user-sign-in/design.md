# Design: Story 1.1 — User Sign-In

## Technical Approach

Bottom-up substrate build. The seam is `src/shared/db`: one Prisma Client Extension with **two entry modes** (AD-3), never a third. Better Auth's Prisma adapter binds to a *tenant-ambient proxy* over scoped mode — not a raw client, not bootstrap mode. Tenant resolution from subdomain runs on **every** request (not only sign-in), which is what makes Better Auth's `user` reads legal under RLS and makes `(tenantId, email)` uniqueness work without fighting Better Auth's own global-unique assumption.

Three AD amendments landed 2026-08-02 and are binding here: AD-2 threat-model addendum (Better Auth tables RLS-exempt), AD-8 multi-tenant uniqueness override, AD-9 test-time database.

## Architecture Decisions

| # | Choice | Rejected | Rationale | AD |
|---|--------|----------|-----------|-----|
| D1 | Better Auth adapter binds a **Proxy** that resolves the scoped client from AsyncLocalStorage per property access | Raw client (RLS returns 0 rows on `user`); bootstrap client (AD-3 forbids general unscoped reads) | `prismaAdapter(client)` takes the client once at module scope; a Proxy is the only way to give it a per-request identity | AD-3, AD-8 |
| D2 | Subdomain → `tenantId` bootstrap runs in middleware on **every** request | Bootstrap only at sign-in | Non-sign-in requests read `session` (exempt) → need `user` (RLS-forced) → need context first. Bonus: a tenant-A session replayed on tenant-B's host finds no `user` row → 401 | AD-3 |
| D3 | `tenant` table is RLS-exempt with a **column-narrow** `GRANT SELECT (id, slug, isActive)` | A `tenant_resolution` view | `FORCE ROW LEVEL SECURITY` subjects the *owner* too, so an owner-rights view is filtered as well — the view buys nothing and hides the exemption | AD-2, AD-3 |
| D4 | Uniqueness = `@@unique([tenantId, email])` + `@@unique([tenantId, nickname])`, **no** bare `email @unique` | Better Auth `username` plugin; patching its dedupe checks | Better Auth enforces uniqueness with a `findOne` before insert, not a DB constraint. Because its adapter only ever sees one tenant (D1+RLS), that check is *correct as written* — no override needed at its layer, only at Prisma's | AD-8 |
| D5 | `SELECT set_config('app.tenant_id', $1, true)` | `SET LOCAL app.tenant_id = ...` | `SET` cannot be parameterized → string interpolation → injection. `set_config(..., true)` is exactly `SET LOCAL` and takes bind params. Transaction-scoped, so pgbouncer-safe | AD-2 |
| D6 | Array form `$transaction([setConfig, query(args)])` inside `$allOperations` | Interactive `$transaction(async tx => ...)` in the hook | `query(args)` cannot be re-routed onto a different `tx` handle; the array form is the only shape that keeps `set_config` and the query on one connection | AD-3 |
| D7 | Nickname sign-in = resolve `nickname → email` inside a scoped tx, then call Better Auth's email sign-in | `username` plugin | The plugin reintroduces its own global-unique username assumption — the exact problem D4 just solved | AD-8 |
| D8 | One `AsyncLocalStorage<RequestContext>` in `src/shared/context/`, consumed by both `shared/db` and `shared/logging` | Separate stores per concern | Two stores drift; `tenant_id` on every log line and `app.tenant_id` in every tx must come from the same source | Conventions |
| D9 | Ephemeral Neon branch per **test run** (Vitest `globalSetup`), URL passed via `provide`/`inject` | Branch per test file (seconds each); local Docker Postgres | AD-9 forbids new test-only infra. `globalSetup` runs in a *different process* than workers — `process.env` mutations do not propagate; `provide`/`inject` is the supported channel | AD-9 |
| D10 | Two connection strings: pooled `DATABASE_URL` (app role) + direct `DIRECT_DATABASE_URL` (owner role, CLI only) | One URL | Role separation is AD-2's precondition and AD-10's. One URL means the app can connect as owner and silently bypass RLS | AD-2 |
| D11 | `isActive` rejection in `databaseHooks.session.create.before` | Post-signIn check in the action | A post-hoc check has already minted a session | AC-4 |

**Not a third mode.** Scoped mode ships two ergonomics over the same `set_config` contract: `db.scoped(ctx)` (per-operation auto-wrap, used by the Better Auth proxy) and `db.transaction(ctx, fn)` (interactive, needed later for AD-4/AD-10 paired `Result`+`AuditLog` writes). Same mode, one contract.

## Data Model

```prisma
generator client { provider = "prisma-client"; output = "../src/generated/prisma" }
datasource db    { provider = "postgresql" }   // url lives in prisma.config.ts (Prisma 7)

enum UserRole { admin recepcionista quimico }   // AD Deferred resolved: enum, not Role table

model Tenant {
  id        String   @id @default(cuid(2))
  slug      String   @unique          // {lab}.quimiaio.com
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  @@map("tenant")                     // RLS-EXEMPT (D3)
}

model User {
  id            String   @id @default(cuid(2))
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email         String                // NO @unique — D4
  nickname      String                // NO @unique — D4
  name          String
  emailVerified Boolean  @default(false)
  image         String?
  role          UserRole
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sessions      Session[]
  accounts      Account[]
  @@unique([tenantId, email])
  @@unique([tenantId, nickname])
  @@index([tenantId])
  @@map("user")                       // RLS + FORCE
}

// Better Auth core tables — RLS-EXEMPT by AD-2 addendum. Do not add policies.
model Session { id String @id; token String @unique; userId String; tenantId String
  expiresAt DateTime; ipAddress String?; userAgent String?
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId]) @@map("session") }

model Account { id String @id; accountId String; providerId String; userId String
  password String?                    // credential hash lives HERE, not on User
  accessToken String?; refreshToken String?; idToken String?
  accessTokenExpiresAt DateTime?; refreshTokenExpiresAt DateTime?; scope String?
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId]) @@map("account") }

model Verification { id String @id; identifier String; value String; expiresAt DateTime
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  @@index([identifier]) @@map("verification") }
```

`Session.tenantId` is deliberate: it lets middleware reject a cross-tenant session replay at the exempt-table layer, before any `user` read.

## RLS + Role Migration (SQL shape)

Hand-written migration, applied by the **owner** role only.

```sql
-- 1. Runtime role: non-owner, NOLOGIN here (password set out-of-band, never committed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quimia_app') THEN
    CREATE ROLE quimia_app NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO quimia_app;

-- 2. Tenant-owned tables (AD-2). Repeat this block for every future tenant table.
GRANT SELECT, INSERT, UPDATE, DELETE ON "user" TO quimia_app;
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- 3. Tenant registry: exempt, column-narrow read only (D3)
REVOKE ALL ON "tenant" FROM quimia_app;
GRANT SELECT ("id", "slug", "isActive") ON "tenant" TO quimia_app;

-- 4. Better Auth tables: NO RLS. Intentional (AD-2 addendum). Do not "fix" this.
GRANT SELECT, INSERT, UPDATE, DELETE ON "session", "account", "verification" TO quimia_app;
```

**Fail-closed property to assert in tests:** `current_setting('app.tenant_id', true)` returns `NULL` when unset; `"tenantId" = NULL` is `NULL`, so an unscoped query returns **zero rows, not all rows**.

Not Neon RLS / Neon Authorize (JWT-based). Plain Postgres RLS via `current_setting`, per AD-2.

## Wrapper API (`src/shared/db`)

```ts
// types.ts
export type TenantContext = { tenantId: string; role: UserRole | 'anonymous' }

// client.ts — module-private, never re-exported from the barrel
import { env } from '@/shared/config/env'          // import order guards P1010
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
export const base = new PrismaClient({ adapter })

// bootstrap.ts — MODE 2. The only unscoped read in the codebase.
export const bootstrap = {
  resolveTenantBySlug: (slug: string) =>
    base.tenant.findUnique({ where: { slug }, select: { id: true, isActive: true } }),
}

// scoped.ts — MODE 1
const cache = new Map<string, ScopedClient>()            // keyed `${tenantId}:${role}`
export function scoped(ctx: TenantContext): ScopedClient {
  return cached(ctx, () => base.$extends({
    query: { $allModels: { async $allOperations({ args, query }) {
      const [, , result] = await base.$transaction([
        base.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, TRUE)`,
        base.$executeRaw`SELECT set_config('app.role',      ${ctx.role},     TRUE)`,
        query(args),
      ])
      return result
    }}},
  }))
}
export function transaction<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>) {
  return base.$transaction(async (tx) => { await setConfig(tx, ctx); return fn(tx) })
}

// ambient.ts — the Better Auth binding (D1)
export const authPrisma = new Proxy({} as PrismaClient, {
  get: (_, prop) => Reflect.get(scoped(currentContext().tenant), prop),  // throws if no context
})
```

`$allModels` does **not** intercept `$queryRaw`/`$executeRaw`. Modules are forbidden raw SQL; only `src/shared/db` may use it (same ESLint boundary as `prisma.<model>`).

## Better Auth Config (`src/modules/auth/server/auth.ts`)

```ts
export const auth = betterAuth({
  database: prismaAdapter(authPrisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 12, autoSignIn: true },  // NFR-2, central (AD-8)
  user: { modelName: 'user', additionalFields: {
    tenantId: { type: 'string',  required: true, input: false },
    nickname: { type: 'string',  required: true, input: false },
    role:     { type: 'string',  required: true, input: false },
    isActive: { type: 'boolean', required: true, input: false, defaultValue: true },
  }},
  session: {
    additionalFields: { tenantId: { type: 'string', required: true, input: false } },
    cookieCache: { enabled: false },     // re-read user each request → isActive/role stay authoritative
  },
  databaseHooks: { session: { create: { before: async (s) => {
    const u = await scoped(currentContext().tenant).user.findUnique({ where: { id: s.userId } })
    if (!u?.isActive) throw new APIError('UNAUTHORIZED', AUTH_GENERIC)     // D11
    return { data: { ...s, tenantId: currentContext().tenant.tenantId } }
  }}}},
  advanced: { database: { generateId: () => createId() } },                 // cuid2
})
```

**Generic failure (AC-4).** One code `AUTH_INVALID_CREDENTIALS`, one message, for all of: unknown tenant, inactive tenant, unknown identifier, wrong password, inactive user. When the identifier resolves to nothing, still run a dummy password verify to avoid a timing oracle.

## Data Flow

```mermaid
sequenceDiagram
  participant B as Browser {lab}.quimiaio.com
  participant M as middleware
  participant A as modules/auth action
  participant W as shared/db
  participant P as Postgres (Neon)

  B->>M: POST /sign-in {identifier, password}
  M->>W: bootstrap.resolveTenantBySlug(lab)
  W->>P: SELECT id,isActive FROM tenant WHERE slug=$1   [RLS-exempt, 3 cols]
  P-->>W: {tenantId, isActive}
  M->>M: runWithContext({requestId, tenantId, role:'anonymous'})
  M->>A: handler (inside ALS)
  A->>W: transaction(ctx, tx => tx.user.findUnique nickname->email)
  W->>P: set_config('app.tenant_id',..,TRUE); SELECT ... FROM "user"  [RLS]
  A->>A: auth.api.signInEmail({email, password})
  A->>W: authPrisma proxy -> scoped(ctx)
  W->>P: read account (exempt) / user (RLS) ; hook checks isActive
  W->>P: INSERT session (exempt, carries tenantId)
  A-->>B: 200 + session cookie  |  401 {error:{code:'AUTH_INVALID_CREDENTIALS'}}
```

Subsequent request: middleware resolves tenant → reads `session` by token (exempt) → asserts `session.tenantId === resolvedTenantId` → opens scoped context with `user.role`.

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `package.json`, `tsconfig.json`, `next.config.ts` | Create | Next.js >=16.2.11, TS 6 strict |
| `prisma.config.ts` | Create | Prisma 7 config; loads env via `@next/env` before anything else |
| `prisma/schema.prisma` | Create | Models above; generator `output = ../src/generated/prisma` |
| `prisma/migrations/*_init/migration.sql` | Create | Generated DDL |
| `prisma/migrations/*_rls_roles/migration.sql` | Create | Hand-written: role + RLS block above |
| `scripts/db/provision-app-role.ts` | Create | Idempotent `ALTER ROLE quimia_app LOGIN PASSWORD` from env |
| `src/shared/config/env.ts` | Create | Zod env; **only** module reading `process.env` |
| `src/shared/context/request-context.ts` | Create | `AsyncLocalStorage<{requestId, tenant?}>` (D8) |
| `src/shared/db/{types,client,bootstrap,scoped,ambient,index}.ts` | Create | Wrapper; `index.ts` is the sole export surface |
| `src/shared/logging/logger.ts` | Create | pino JSON; base fields from D8 store |
| `src/shared/http/errors.ts` | Create | `AppError`, `toErrorResponse`, `{error:{code,message,details?}}` |
| `src/middleware.ts` | Create | requestId, subdomain, bootstrap, `runWithContext` |
| `src/modules/auth/server/auth.ts` | Create | Better Auth config above |
| `src/modules/auth/server/sign-in.action.ts` | Create | nickname→email resolve + generic failure |
| `src/modules/auth/ui/sign-in-form.tsx` | Create | shadcn form, Zod-validated |
| `src/app/api/auth/[...all]/route.ts` | Create | Better Auth handler mount |
| `eslint.config.mjs` | Create | `no-restricted-imports` on `src/generated/prisma` outside `src/shared/db` |
| `vitest.config.ts`, `tests/setup/*` | Create | Neon-branch harness below |
| `.env.example` | Create | Both URLs, `NODE_EXTRA_CA_CERTS` note |

## Test Infrastructure — Ephemeral Neon Branch (AD-9)

Blocks the first red test, so it is Task 1 scaffolding, exempt from TDD (you cannot test-drive the harness). **First RED test is the RLS negative path**, not a unit test.

```ts
// tests/setup/neon-global-setup.ts   (Vitest globalSetup — runs in its OWN process)
export async function setup({ provide }: GlobalSetupContext) {
  const name = `test-${process.env.GITHUB_RUN_ID ?? 'local'}-${Date.now()}`
  const r = await fetch(`https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches`, {
    method: 'POST', headers: { Authorization: `Bearer ${NEON_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch: { name, parent_id: NEON_PARENT_BRANCH_ID }, endpoints: [{ type: 'read_write' }] }),
  })
  const { branch, connection_uris } = await r.json()
  const ownerUrl = connection_uris[0].connection_uri                       // owner/migration role
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: { ...process.env, DIRECT_DATABASE_URL: ownerUrl } })
    const pw = randomUUID()
    execFileSync('npx', ['tsx', 'scripts/db/provision-app-role.ts'], { env: { ...process.env, DIRECT_DATABASE_URL: ownerUrl, APP_DB_PASSWORD: pw } })
    provide('appDatabaseUrl',   withRole(ownerUrl, 'quimia_app', pw))      // D9 — NOT process.env
    provide('ownerDatabaseUrl', ownerUrl)
  } catch (e) { await deleteBranch(branch.id); throw e }
  return () => deleteBranch(branch.id)                                     // runs on pass AND fail
}
```

```ts
// tests/setup/env.ts   (setupFiles — runs IN the worker, before src imports)
process.env.DATABASE_URL = inject('appDatabaseUrl')
```

Gotchas a dev agent will hit:
- `globalSetup` runs in a separate process — `process.env` writes there are invisible to workers. Use `provide`/`inject` (D9).
- `tests/setup/env.ts` must assign `DATABASE_URL` **before** any import of `src/shared/db` (that module builds the adapter at import time).
- Neon SQL-created roles do not appear in the Neon console. Expected, not a failure.
- One branch per run, not per file. Per-test isolation via a unique tenant slug per test + `TRUNCATE "user","session","account","tenant" CASCADE` in `afterEach`.
- Add a scheduled CI job deleting `test-*` branches older than 6h — killed runs leak branches into the free-tier cap (AD-9 Deferred).

| Layer | What | Approach |
|-------|------|----------|
| Unit | Zod env parse; subdomain extraction; error envelope; generic-failure mapping | Vitest, no DB |
| Integration (RLS) | **Tenant-A context returns 0 tenant-B rows**; unset context returns 0 rows (fail-closed); `WITH CHECK` blocks cross-tenant insert; app role cannot bypass (`FORCE` proves it) | Vitest + Neon branch, real Postgres. No mocks (AD-9) |
| Integration (auth) | Same email in two tenants both sign in; wrong password / inactive user / inactive tenant → identical envelope; cross-tenant session replay → 401 | Vitest + Neon branch |
| E2E | Sign-in happy path + invalid credentials | Playwright against a preview deploy |

## P1010 Mitigations (resolved)

| Cause | Mitigation |
|-------|-----------|
| Prisma 7 no longer auto-loads env | `src/shared/config/env.ts` is the single `process.env` reader; `src/shared/db/client.ts` imports it, so the import graph guarantees order. `prisma.config.ts` and `tests/setup/env.ts` call `loadEnvConfig()` from `@next/env` first |
| SSL cert against Neon | Default `sslmode=require` on the system CA store. If the runtime rejects, set `NODE_EXTRA_CA_CERTS` at **process start** (npm script / Vercel env — it is read before Node boots, cannot be set from JS). Never `rejectUnauthorized: false` |
| Wrong client instance | Generator `output = ../src/generated/prisma`; `src/shared/db/client.ts` and Better Auth both import from that path. ESLint forbids that import anywhere except `src/shared/db` |
| Owner-role connection | `DATABASE_URL` = pooled app role; `DIRECT_DATABASE_URL` = owner, CLI/migrations only. Runtime never reads the direct URL |

## Migration / Rollout

Greenfield. Forward-only: `init` DDL, then `rls_roles`. Rollback = drop the Neon branch (pre-merge) or run the down migration as the owner role (post-merge). No data, no consumers.

## Open Questions

- [ ] Neon plan tier vs. branch-per-PR **and** branch-per-test-run concurrency. Free tier caps ~10 concurrent branches; this design now consumes them from two directions. Not a blocker for a solo dev, but confirm the tier before CI parallelism grows (AD-9 Deferred).
- [ ] `account.password` (the credential hash) lives on an RLS-exempt table. AD-2's addendum rationale ("the token is the capability") covers `session` cleanly but is weaker for `account`, which is keyed by `userId`. The residual exposure requires the app role to already be compromised, and the value is a hash — accepted for Phase 1, flagged for revisit if column-level grants become cheap.
