/**
 * Configuración hub route — `/configuracion` (Story 2.1, change 2/6 — Phase 5).
 * The admin-only landing page for the five supporting catalogs. Gated by
 * `requireCatalogAdmin()` at the page level, exactly like `/usuarios` uses
 * `requireAdmin()`: an unauthenticated visitor is redirected to sign in, a
 * non-admin gets a 404 (do not reveal the route to a caller who isn't allowed
 * to use it).
 *
 * The five cards are driven by `CATALOGS` (the single source of truth): one
 * card per registry entry, labeled with the catalog's Spanish `label` and
 * showing its active-row count from `getCatalogStats()`. A zero active count
 * renders the spec's literal "0 elementos"; each card links to its
 * per-catalog page via `catalogHref(slug)`. Verify against the spec
 * "Hub Page Lists All Five Catalog Kinds With Active Counts" scenarios.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UNRESOLVED_TENANT } from "@/middleware";
import { AppError } from "@/shared/http/errors";
import { requireCatalogAdmin } from "@/modules/catalog/server/require-catalog-admin";
import { getCatalogStats } from "@/modules/catalog/server/catalog-queries";
import {
  CATALOGS,
  catalogHref,
  type CatalogSlug,
} from "@/modules/catalog/registry";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function loadStats(): Promise<Record<CatalogSlug, number>> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) notFound();
  const requestId = requestHeaders.get("x-request-id") ?? randomUUID();

  try {
    return await requireCatalogAdmin(
      { headers: requestHeaders, tenantId, requestId },
      async (actor) =>
        getCatalogStats({ tenantId: actor.tenantId, role: actor.role }),
      { entity: "Catalog" },
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/sign-in");
    if (error instanceof AppError && error.status === 403) notFound();
    throw error;
  }
}

export default async function ConfiguracionPage() {
  const stats = await loadStats();
  const slugs = Object.keys(CATALOGS) as CatalogSlug[];

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <PageHeader
        title="Configuración"
        description="Administra los catálogos que usa el laboratorio."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slugs.map((slug) => {
          const kind = CATALOGS[slug];
          const count = stats[slug];
          const countLabel =
            count === 0
              ? "0 elementos"
              : `${count} ${count === 1 ? "elemento" : "elementos"}`;
          return (
            <Link
              key={slug}
              href={catalogHref(slug)}
              className="rounded-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{kind.label}</CardTitle>
                  <CardDescription>{countLabel}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
