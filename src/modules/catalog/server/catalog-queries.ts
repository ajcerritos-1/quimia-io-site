/**
 * Typed catalog reads (Story 2.1, change 2/6) — server-only. Every read
 * `switch`es on the validated `kind` slug and calls the concrete typed Prisma
 * delegate (`db.method`, `db.equipment`, ...). Dynamic delegate access
 * (`db[kind]`) is deliberately avoided: the per-model `findMany`/`count`
 * return types differ, so TS cannot unify the union safely (design decision
 * "Type-safe model access via explicit `switch (kind)`"). Reads go through
 * `scoped(ctx)` (AD-3) so `app.tenant_id` is set and RLS applies (AD-2).
 *
 * The server -> client row is serialized (`SerializedCatalogRow`): the form
 * and table are driven by the registry's `values` keys, and equipment's
 * `calibrationDate` becomes an `"yyyy-MM-dd"` string (or `null`) so it can
 * pre-fill an `<input type="date">` directly.
 */
import "server-only";
import { scoped, type TenantContext } from "../../../shared/db";
import { CATALOGS, type CatalogSlug } from "../registry";

export interface SerializedCatalogRow {
  id: string;
  isActive: boolean;
  /** Keyed by the registry field names; equipment's calibrationDate is "yyyy-MM-dd" | null. */
  values: Record<string, string | null>;
}

export interface CatalogStats {
  slug: CatalogSlug;
  label: string;
  activeCount: number;
}

/** The canonical display order of the hub cards / stats. */
const SLUG_ORDER: readonly CatalogSlug[] = [
  "metodos",
  "tecnicas",
  "equipos",
  "recipientes",
  "tipos-de-muestra",
];

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Lists a catalog's rows ordered by name ascending, serialized for a client
 * component. Exact `kind` -> delegate mapping per branch (no dynamic key).
 */
export async function listCatalogRows(
  slug: CatalogSlug,
  ctx: TenantContext,
): Promise<SerializedCatalogRow[]> {
  const db = scoped(ctx);
  switch (slug) {
    case "metodos": {
      const rows = await db.method.findMany({ orderBy: { name: "asc" } });
      return rows.map((row) => ({
        id: row.id,
        isActive: row.isActive,
        values: { name: row.name },
      }));
    }
    case "tecnicas": {
      const rows = await db.technique.findMany({ orderBy: { name: "asc" } });
      return rows.map((row) => ({
        id: row.id,
        isActive: row.isActive,
        values: { name: row.name },
      }));
    }
    case "equipos": {
      const rows = await db.equipment.findMany({ orderBy: { name: "asc" } });
      return rows.map((row) => ({
        id: row.id,
        isActive: row.isActive,
        values: {
          name: row.name,
          model: row.model,
          serialNumber: row.serialNumber,
          calibrationDate: row.calibrationDate ? toIsoDate(row.calibrationDate) : null,
        },
      }));
    }
    case "recipientes": {
      const rows = await db.container.findMany({ orderBy: { name: "asc" } });
      return rows.map((row) => ({
        id: row.id,
        isActive: row.isActive,
        values: { name: row.name },
      }));
    }
    case "tipos-de-muestra": {
      const rows = await db.sampleType.findMany({ orderBy: { name: "asc" } });
      return rows.map((row) => ({
        id: row.id,
        isActive: row.isActive,
        values: { name: row.name },
      }));
    }
  }
}

/** Counts a catalog's active rows (`isActive: true`). Exact delegate per branch. */
export async function countActive(
  slug: CatalogSlug,
  ctx: TenantContext,
): Promise<number> {
  const db = scoped(ctx);
  switch (slug) {
    case "metodos":
      return db.method.count({ where: { isActive: true } });
    case "tecnicas":
      return db.technique.count({ where: { isActive: true } });
    case "equipos":
      return db.equipment.count({ where: { isActive: true } });
    case "recipientes":
      return db.container.count({ where: { isActive: true } });
    case "tipos-de-muestra":
      return db.sampleType.count({ where: { isActive: true } });
  }
}

/** Active counts for every catalog kind, in canonical display order (hub). */
export async function getCatalogStats(ctx: TenantContext): Promise<CatalogStats[]> {
  const stats: CatalogStats[] = [];
  for (const slug of SLUG_ORDER) {
    stats.push({
      slug,
      label: CATALOGS[slug].label,
      activeCount: await countActive(slug, ctx),
    });
  }
  return stats;
}
