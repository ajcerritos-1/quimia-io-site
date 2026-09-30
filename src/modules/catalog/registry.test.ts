import { describe, expect, it } from "vitest";
import { CATALOGS, catalogHref } from "./registry";

describe("CATALOGS registry (Story 2.1, Phase 1 — canonical slug contract)", () => {
  it("defines exactly the five canonical kebab-case slugs", () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([
      "equipos",
      "metodos",
      "recipientes",
      "tecnicas",
      "tipos-de-muestra",
    ]);
  });

  it("keys the SampleType catalog as 'tipos-de-muestra' and never 'tiposDeMuestra'", () => {
    expect(CATALOGS).toHaveProperty("tipos-de-muestra");
    expect(CATALOGS).not.toHaveProperty("tiposDeMuestra");
  });

  it("exposes the locked Spanish labels for all five catalogs", () => {
    expect(CATALOGS.metodos.label).toBe("Métodos");
    expect(CATALOGS.tecnicas.label).toBe("Técnicas");
    expect(CATALOGS.equipos.label).toBe("Equipos");
    expect(CATALOGS.recipientes.label).toBe("Recipientes");
    expect(CATALOGS["tipos-de-muestra"].label).toBe("Tipos de Muestra");
  });

  it("gives equipment four fields and every other catalog a single name field", () => {
    expect(Object.keys(CATALOGS.equipos.fields).sort()).toEqual([
      "calibrationDate",
      "model",
      "name",
      "serialNumber",
    ]);

    for (const slug of [
      "metodos",
      "tecnicas",
      "recipientes",
      "tipos-de-muestra",
    ] as const) {
      expect(Object.keys(CATALOGS[slug].fields)).toEqual(["name"]);
    }
  });

  it("sets each entry's slug field equal to its registry key", () => {
    for (const [key, def] of Object.entries(CATALOGS)) {
      expect(def.slug).toBe(key);
    }
  });

  it("carries slug, label, entity, actionPrefix, and fields on every entry", () => {
    for (const def of Object.values(CATALOGS)) {
      expect(def).toEqual(
        expect.objectContaining({
          slug: expect.any(String),
          label: expect.any(String),
          entity: expect.any(String),
          actionPrefix: expect.any(String),
          fields: expect.any(Object),
        }),
      );
    }
  });

  it("maps the entity and actionPrefix to the per-entity audit contract", () => {
    expect(CATALOGS.metodos.entity).toBe("Method");
    expect(CATALOGS.metodos.actionPrefix).toBe("METHOD");
    expect(CATALOGS.equipos.entity).toBe("Equipment");
    expect(CATALOGS.equipos.actionPrefix).toBe("EQUIPMENT");
    expect(CATALOGS["tipos-de-muestra"].entity).toBe("SampleType");
    expect(CATALOGS["tipos-de-muestra"].actionPrefix).toBe("SAMPLE_TYPE");
  });

  it("builds the canonical href for a slug", () => {
    expect(catalogHref("metodos")).toBe("/configuracion/metodos");
    expect(catalogHref("tipos-de-muestra")).toBe("/configuracion/tipos-de-muestra");
  });
});
