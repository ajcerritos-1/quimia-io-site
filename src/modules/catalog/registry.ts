/**
 * Client-safe source of truth for the five supporting catalogs (Story 2.1,
 * change 2/6). Mirrors `src/modules/auth/roles.ts`'s zero-runtime-import
 * pattern: this file has NO imports at all, so it is safe to import from
 * both server code and a "use client" component without pulling in
 * `src/shared/db`'s Prisma-backed module graph (which requires DATABASE_URL
 * etc. at import time and would break a plain unit-test environment).
 *
 * The registry key IS the canonical kebab-case slug (AD-11): `Object.keys(
 * CATALOGS)` is the canonical slug list, and `catalogHref(slug)` is trivially
 * `/configuracion/${slug}`. `entity` (the Prisma model name, e.g.
 * "SampleType") and `actionPrefix` (the uppercase snake audit prefix, e.g.
 * "SAMPLE_TYPE") are plain strings used only for `writeAuditLog` and as doc
 * references in the server `switch (kind)` — never as a dynamic delegate key.
 */
export type CatalogSlug =
  | "metodos"
  | "tecnicas"
  | "equipos"
  | "recipientes"
  | "tipos-de-muestra";

export interface CatalogFieldDef {
  label: string;
  type: "text" | "date";
  required: boolean;
}

export interface CatalogKindDef {
  slug: CatalogSlug;
  label: string;
  /** Prisma model name — used as writeAuditLog `entity` and as the doc
   *  reference in the server `switch`. Never used as a dynamic delegate key. */
  entity: "Method" | "Technique" | "Equipment" | "Container" | "SampleType";
  /** Uppercase snake audit prefix: action = `${actionPrefix}_CREATED|_UPDATED|...`. */
  actionPrefix:
    | "METHOD"
    | "TECHNIQUE"
    | "EQUIPMENT"
    | "CONTAINER"
    | "SAMPLE_TYPE";
  fields: Record<string, CatalogFieldDef>;
}

export const CATALOGS: Record<CatalogSlug, CatalogKindDef> = {
  metodos: {
    slug: "metodos",
    label: "Métodos",
    entity: "Method",
    actionPrefix: "METHOD",
    fields: { name: { label: "Nombre", type: "text", required: true } },
  },
  tecnicas: {
    slug: "tecnicas",
    label: "Técnicas",
    entity: "Technique",
    actionPrefix: "TECHNIQUE",
    fields: { name: { label: "Nombre", type: "text", required: true } },
  },
  equipos: {
    slug: "equipos",
    label: "Equipos",
    entity: "Equipment",
    actionPrefix: "EQUIPMENT",
    fields: {
      name: { label: "Nombre", type: "text", required: true },
      model: { label: "Modelo", type: "text", required: true },
      serialNumber: { label: "N.º de Serie", type: "text", required: true },
      calibrationDate: {
        label: "Fecha de Calibración",
        type: "date",
        required: false,
      },
    },
  },
  recipientes: {
    slug: "recipientes",
    label: "Recipientes",
    entity: "Container",
    actionPrefix: "CONTAINER",
    fields: { name: { label: "Nombre", type: "text", required: true } },
  },
  "tipos-de-muestra": {
    slug: "tipos-de-muestra",
    label: "Tipos de Muestra",
    entity: "SampleType",
    actionPrefix: "SAMPLE_TYPE",
    fields: { name: { label: "Nombre", type: "text", required: true } },
  },
};

export const catalogHref = (slug: CatalogSlug) =>
  `/configuracion/${slug}` as const;
