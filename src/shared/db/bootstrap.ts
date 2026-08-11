/**
 * Bootstrap mode — MODE 2 (design.md "Wrapper API", D3). The only unscoped
 * read in the codebase: resolving `tenantId` from a subdomain slug, before
 * any tenant context exists to open a scoped transaction with. Restricted by
 * the tenant-isolation spec to exactly this named flow, reading only the
 * columns needed (`id`, `isActive`) from the RLS-exempt, column-narrow-
 * granted `tenant` table (see the rls_roles migration's `GRANT SELECT
 * ("id", "slug", "isActive")` — this query never needs `slug` back since the
 * caller already has it, and never selects `name`, which the app role has no
 * grant on at all).
 */
import { base } from "./client";

export const bootstrap = {
  resolveTenantBySlug(slug: string) {
    return base.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
  },
};
