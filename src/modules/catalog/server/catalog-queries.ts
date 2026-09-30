/**
 * Typed catalog reads (Story 2.1, change 2/6 — Phase 2). The hub and
 * per-kind pages' read helpers. Every function takes a `TenantContext` and
 * runs through `scoped()` (AD-2/AD-3) — a request scoped to tenant A can
 * never see tenant B's rows (RLS enforces it at the Postgres layer).
 *
 * Per the design's risk #3 mitigation, each `switch (kind)` calls the
 * CONCRETE typed delegate (`tx.method`, `tx.technique`, `tx.equipment`,
 * `tx.container`, `tx.sampleType`) — never `scoped()[kind.prismaModel]`
 * dynamic access. The registry `entity` string is documentation/audit only.
 */
import "server-only";
import { scoped, type TenantContext } from "../../../shared/db";
import { CATALOGS, type CatalogSlug } from "../registry";

export interface SerializedCatalogRow {
  id: string;
  isActive: boolean;
  /** Keyed by the registry field names; equipment's calibrationDate is
   *  "yyyy-MM-dd" | null (server → client safe shape). */
  values: Record<string, string | null>;
}

export async function listCatalogRows(
  kind: CatalogSlug,
  ctx: TenantContext,
): Promise<SerializedCatalogRow[]> {
  switch (kind) {
    case "metodos": {
      const rows = await scoped(ctx).method.findMany({ orderBy: { name: "asc" } });
      return rows.map((r) => ({
        id: r.id,
        isActive: r.isActive,
        values: { name: r.name },
      }));
    }
    case "tecnicas": {
      const rows = await scoped(ctx).technique.findMany({ orderBy: { name: "asc" } });
      return rows.map((r) => ({
        id: r.id,
        isActive: r.isActive,
        values: { name: r.name },
      }));
    }
    case "equipos": {
      const rows = await scoped(ctx).equipment.findMany({ orderBy: { name: "asc" } });
      return rows.map((r) => ({
        id: r.id,
        isActive: r.isActive,
        values: {
          name: r.name,
          model: r.model,
          serialNumber: r.serialNumber,
          calibrationDate: r.calibrationDate
            ? r.calibrationDate.toISOString().slice(0, 10)
            : null,
        },
      }));
    }
    case "recipientes": {
      const rows = await scoped(ctx).container.findMany({ orderBy: { name: "asc" } });
      return rows.map((r) => ({
        id: r.id,
        isActive: r.isActive,
        values: { name: r.name },
      }));
    }
    case "tipos-de-muestra": {
      const rows = await scoped(ctx).sampleType.findMany({ orderBy: { name: "asc" } });
      return rows.map((r) => ({
        id: r.id,
        isActive: r.isActive,
        values: { name: r.name },
      }));
    }
  }
}

export async function countActive(kind: CatalogSlug, ctx: TenantContext): Promise<number> {
  switch (kind) {
    case "metodos":
      return scoped(ctx).method.count({ where: { isActive: true } });
    case "tecnicas":
      return scoped(ctx).technique.count({ where: { isActive: true } });
    case "equipos":
      return scoped(ctx).equipment.count({ where: { isActive: true } });
    case "recipientes":
      return scoped(ctx).container.count({ where: { isActive: true } });
    case "tipos-de-muestra":
      return scoped(ctx).sampleType.count({ where: { isActive: true } });
  }
}

/** Active count per catalog kind for the hub page's card grid. */
export async function getCatalogStats(
  ctx: TenantContext,
): Promise<Record<CatalogSlug, number>> {
  const slugs = Object.keys(CATALOGS) as CatalogSlug[];
  const entries = await Promise.all(
    slugs.map(async (slug) => [slug, await countActive(slug, ctx)] as const),
  );
  return Object.fromEntries(entries) as Record<CatalogSlug, number>;
}