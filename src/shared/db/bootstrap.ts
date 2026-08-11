/**
 * Bootstrap mode — MODE 2 (design.md "Wrapper API", D3). Unscoped reads
 * against tables that need no tenant context at all — either because no
 * context exists yet (subdomain resolution) or because the table itself
 * carries no RLS policy to bypass (Better Auth's `session` table,
 * tenant-isolation spec's "Better Auth's Own Tables Are RLS-Exempt by
 * Design"). Every read here is named, narrow (selects only the columns the
 * caller needs), and justified individually below — this is not a general
 * unscoped-query escape hatch.
 */
import { base } from "./client";

export const bootstrap = {
  /**
   * Resolves `tenantId` from a subdomain slug, before any tenant context
   * exists to open a scoped transaction with (design.md "Data Flow").
   * Reads only the columns needed (`id`, `isActive`) from the RLS-exempt,
   * column-narrow-granted `tenant` table (rls_roles migration's `GRANT
   * SELECT ("id", "slug", "isActive")` — this query never needs `slug`
   * back since the caller already has it, and never selects `name`, which
   * the app role has no grant on at all).
   */
  resolveTenantBySlug(slug: string) {
    return base.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
  },

  /**
   * Resolves the tenant a session TOKEN was minted for, without needing
   * (or trusting) any tenant context — `session` carries no RLS policy
   * (AD-2 addendum: "the token is the capability"), so this is a plain,
   * narrow read, not a bypass of anything. `src/middleware.ts` uses this
   * for the cross-tenant session-replay check (D2 bonus): Better Auth's
   * own `auth.api.getSession()` cannot be reused for this specific check
   * because it ALSO joins/loads the session's `user` row under whatever
   * tenant context is active — when that context is the WRONG tenant, the
   * `user` join is RLS-blocked and Better Auth treats the whole session as
   * not found, which is indistinguishable from "no session at all" and
   * defeats the very check this function exists for.
   */
  findSessionTenantByToken(token: string) {
    return base.session.findUnique({
      where: { token },
      select: { tenantId: true },
    });
  },
};
