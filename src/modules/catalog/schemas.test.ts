import { describe, expect, it } from "vitest";
import { catalogCreateSchema, catalogUpdateSchema } from "./schemas";

describe("catalogCreateSchema (Story 2.1, Phase 1 — shared client-safe schemas)", () => {
  it("accepts a uniform kind with only a name", () => {
    const result = catalogCreateSchema.safeParse({
      kind: "metodos",
      name: "QUIMICA SANGUINEA",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ kind: "metodos", name: "QUIMICA SANGUINEA" });
    }
  });

  it("rejects a uniform kind when the name is empty", () => {
    const result = catalogCreateSchema.safeParse({ kind: "tecnicas", name: "" });
    expect(result.success).toBe(false);
  });

  it("requires model and serialNumber for equipos", () => {
    const missing = catalogCreateSchema.safeParse({
      kind: "equipos",
      name: "Balanza",
    });
    expect(missing.success).toBe(false);

    const complete = catalogCreateSchema.safeParse({
      kind: "equipos",
      name: "Balanza",
      model: "M-200",
      serialNumber: "SN-123",
    });
    expect(complete.success).toBe(true);
  });

  it("normalizes an empty calibrationDate to null", () => {
    const result = catalogCreateSchema.safeParse({
      kind: "equipos",
      name: "Balanza",
      model: "M-200",
      serialNumber: "SN-123",
      calibrationDate: "",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "equipos") {
      expect(result.data.calibrationDate).toBeNull();
    }
  });

  it("normalizes a null calibrationDate to null", () => {
    const result = catalogCreateSchema.safeParse({
      kind: "equipos",
      name: "Balanza",
      model: "M-200",
      serialNumber: "SN-123",
      calibrationDate: null,
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "equipos") {
      expect(result.data.calibrationDate).toBeNull();
    }
  });

  it("coerces a date string to a Date instance", () => {
    const result = catalogCreateSchema.safeParse({
      kind: "equipos",
      name: "Balanza",
      model: "M-200",
      serialNumber: "SN-123",
      calibrationDate: "2026-01-15",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "equipos") {
      expect(result.data.calibrationDate).toBeInstanceOf(Date);
    }
  });

  it("rejects an unknown kind", () => {
    const result = catalogCreateSchema.safeParse({
      kind: "tiposDeMuestra",
      name: "Orina",
    });
    expect(result.success).toBe(false);
  });

  it("does not require an id on create", () => {
    const result = catalogCreateSchema.safeParse({
      kind: "recipientes",
      name: "Tubo",
    });
    expect(result.success).toBe(true);
  });
});

describe("catalogUpdateSchema (Story 2.1, Phase 1)", () => {
  it("requires an id alongside the kind and name", () => {
    const withoutId = catalogUpdateSchema.safeParse({
      kind: "metodos",
      name: "ELISA",
    });
    expect(withoutId.success).toBe(false);

    const withId = catalogUpdateSchema.safeParse({
      kind: "metodos",
      id: "abc123",
      name: "ELISA",
    });
    expect(withId.success).toBe(true);
  });

  it("requires model and serialNumber for equipos updates", () => {
    const result = catalogUpdateSchema.safeParse({
      kind: "equipos",
      id: "abc123",
      name: "Balanza",
    });
    expect(result.success).toBe(false);
  });
});
