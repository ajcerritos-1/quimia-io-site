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

  it("only defines the one real nav entry documented in the story (no premature scaffolding)", () => {
    expect(NAV_ITEMS).toHaveLength(1);
  });
});
