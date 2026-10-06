/**
 * Per-catalog CRUD route — `/configuracion/[catalog]` (Story 2.1, change 2/6
 * — Phase 5). Resolves the `[catalog]` slug against the `CATALOGS` registry
 * (an unknown or non-canonical slug — `tiposDeMuestra`, `inexistente` — returns
 * `notFound()`), then applies the same admin gate as the hub
 * (`requireCatalogAdmin()`: 401 -> redirect to sign in, 403 -> 404), then
 * lists that catalog's rows ordered by name ascending and renders the shared
 * `CatalogTable` + `CatalogCreateDialog`. Verify against the spec
 * "Per-Catalog Page Enforces Admin Gate And Resolves The Slug" and "Canonical
 * Catalog Slug Contract" scenarios.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UNRESOLVED_TENANT } from "@/middleware";
import { AppError } from "@/shared/http/errors";
import { requireCatalogAdmin } from "@/modules/catalog/server/require-catalog-admin";
import {
  listCatalogRows,
  type SerializedCatalogRow,
} from "@/modules/catalog/server/catalog-queries";
import {
  CATALOGS,
  type CatalogKindDef,
} from "@/modules/catalog/registry";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogCreateDialog } from "@/modules/catalog/ui/catalog-create-dialog";
import { CatalogTable } from "@/modules/catalog/ui/catalog-table";

/** Registry lookup for the `[catalog]` segment: only a canonical slug
 *  resolves to a definition; anything else (including the camelCase
 *  `tiposDeMuestra` spelling) is `undefined` and 404s. */
function resolveCatalog(slug: string): CatalogKindDef | undefined {
  return (CATALOGS as Record<string, CatalogKindDef | undefined>)[slug];
}

async function loadRows(
  kind: CatalogKindDef,
): Promise<SerializedCatalogRow[]> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) notFound();
  const requestId = requestHeaders.get("x-request-id") ?? randomUUID();

  try {
    return await requireCatalogAdmin(
      { headers: requestHeaders, tenantId, requestId },
      async (actor) =>
        listCatalogRows(kind.slug, {
          tenantId: actor.tenantId,
          role: actor.role,
        }),
      { entity: kind.entity },
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/sign-in");
    if (error instanceof AppError && error.status === 403) notFound();
    throw error;
  }
}

export default async function ConfiguracionCatalogPage({
  params,
}: {
  params: Promise<{ catalog: string }>;
}) {
  const { catalog } = await params;
  const kind = resolveCatalog(catalog);
  if (!kind) notFound();

  const rows = await loadRows(kind);

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <PageHeader
        title={kind.label}
        description={`Administra el catálogo de ${kind.label}.`}
        actions={<CatalogCreateDialog kind={kind.slug} />}
      />

      <CatalogTable kind={kind.slug} rows={rows} />
    </div>
  );
}
