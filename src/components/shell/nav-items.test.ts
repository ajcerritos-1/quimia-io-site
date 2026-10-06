import { describe, expect, it } from "vitest";
import type { UserRole } from "../../shared/db";
import { NAV_ITEMS, visibleNavItems } from "./nav-items";

describe("visibleNavItems (Task 2 — the shell's RBAC-driven nav registry)", () => {
  it("includes 'Usuarios y Roles' for an admin, per isRoleAllowed()", () => {
    const admin: UserRole = "admin";
    const items = visibleNavItems(admin);
    expect(items.some((item) => item.href === "/usuarios")).toBe(true);
    expect(items.find((item) => item.href === "/usuarios")?.label).toBe(
      "Usuarios y Roles",
    );
  });

  it("hides 'Usuarios y Roles' entirely for a recepcionista", () => {
    const recepcionista: UserRole = "recepcionista";
    const items = visibleNavItems(recepcionista);
    expect(items.some((item) => item.href === "/usuarios")).toBe(false);
  });

  it("hides 'Usuarios y Roles' entirely for a quimico", () => {
    const quimico: UserRole = "quimico";
    const items = visibleNavItems(quimico);
    expect(items.some((item) => item.href === "/usuarios")).toBe(false);
  });

  it("includes 'Configuración' for an admin", () => {
    const admin: UserRole = "admin";
    const items = visibleNavItems(admin);
    expect(items.some((item) => item.href === "/configuracion")).toBe(true);
    expect(items.find((item) => item.href === "/configuracion")?.label).toBe(
      "Configuración",
    );
  });

  it("hides 'Configuración' entirely for a quimico and a recepcionista", () => {
    const quimico: UserRole = "quimico";
    const recepcionista: UserRole = "recepcionista";
    expect(visibleNavItems(quimico).some((item) => item.href === "/configuracion")).toBe(
      false,
    );
    expect(
      visibleNavItems(recepcionista).some(
        (item) => item.href === "/configuracion",
      ),
    ).toBe(false);
  });

  it("defines the two real nav entries documented in the stories (no premature scaffolding)", () => {
    expect(NAV_ITEMS).toHaveLength(2);
  });
});
