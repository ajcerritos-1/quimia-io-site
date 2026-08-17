import { describe, expect, it } from "vitest";
import type { UserRole } from "../../shared/db";
import { isRoleAllowed } from "./roles";

describe("isRoleAllowed (Task 1 — the one place role-comparison logic lives)", () => {
  it("returns true when the role is in the allowed-roles list", () => {
    const admin: UserRole = "admin";
    expect(isRoleAllowed(admin, [admin])).toBe(true);
  });

  it("returns true when the role is one of several allowed roles", () => {
    const admin: UserRole = "admin";
    const quimico: UserRole = "quimico";
    expect(isRoleAllowed(quimico, [admin, quimico])).toBe(true);
  });

  it("returns false when the role is not in the allowed-roles list", () => {
    const admin: UserRole = "admin";
    const recepcionista: UserRole = "recepcionista";
    expect(isRoleAllowed(recepcionista, [admin])).toBe(false);
  });

  it("returns false for an empty allowed-roles list", () => {
    const admin: UserRole = "admin";
    expect(isRoleAllowed(admin, [])).toBe(false);
  });
});
