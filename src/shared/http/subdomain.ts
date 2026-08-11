/**
 * Extracts the tenant slug from an incoming request's `Host` header
 * (design.md "Data Flow": subdomain -> tenantId bootstrap, D2). Pure and
 * DB-free — `src/middleware.ts` feeds the result into
 * `bootstrap.resolveTenantBySlug`.
 *
 * Supports both the production shape (`{lab}.quimiaio.com`) and the local
 * dev convention (`{lab}.localhost:3000`) — `localhost` alone (no
 * subdomain) and the bare root domain (`quimiaio.com`) both have exactly
 * two labels once a port is stripped, so a *count* alone cannot
 * disambiguate them; the special-case check below is deliberate, not an
 * oversight.
 */
export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0];
  const labels = hostname.split(".");

  if (labels.length < 2) return null; // "localhost" alone — no subdomain
  if (labels.length === 2 && labels[1] !== "localhost") return null; // "quimiaio.com" — root domain, no subdomain

  return labels[0];
}
