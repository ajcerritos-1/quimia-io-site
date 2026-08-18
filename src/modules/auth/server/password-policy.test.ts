import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  passwordPolicySchema,
} from "./password-policy";

const LENGTH_MESSAGE = "La contraseña debe tener al menos 12 caracteres.";
const COMPLEXITY_MESSAGE =
  "La contraseña debe incluir mayúsculas, minúsculas, números y símbolos (al menos 3 de 4 tipos).";

describe("passwordPolicySchema (Story 1.4 Task 1, AC 1)", () => {
  it("rejects a password shorter than MIN_PASSWORD_LENGTH with the length-specific message", () => {
    const result = passwordPolicySchema.safeParse("Short1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(LENGTH_MESSAGE);
    }
  });

  it("rejects a too-short-but-already-complex password with the LENGTH message, not the complexity message (Review Findings patch)", () => {
    // 8 chars, hits all 4 character classes — long enough is the ONLY thing
    // missing, so the report must say so instead of asking for variety the
    // password already has.
    const result = passwordPolicySchema.safeParse("Ab1!Ab1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(LENGTH_MESSAGE);
      expect(result.error.issues[0].message).not.toBe(COMPLEXITY_MESSAGE);
    }
  });

  it("rejects a 12+ character password that only hits 2 of 4 character classes (all lowercase + digits) with the complexity-specific message", () => {
    // 12 chars, lowercase + digits only (2 classes) — long enough, not complex enough.
    const result = passwordPolicySchema.safeParse("lowercase123");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(COMPLEXITY_MESSAGE);
      expect(result.error.issues[0].message).not.toBe(LENGTH_MESSAGE);
    }
  });

  it("rejects a 12+ character password that is all lowercase (1 class) with the complexity-specific message", () => {
    const result = passwordPolicySchema.safeParse("alllowercase");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(COMPLEXITY_MESSAGE);
    }
  });

  it("accepts a 12+ character password meeting exactly 3 of 4 classes (upper+lower+digit, no symbol)", () => {
    const result = passwordPolicySchema.safeParse("Password12345");
    expect(result.success).toBe(true);
  });

  it("accepts a 12+ character password meeting all 4 classes", () => {
    const result = passwordPolicySchema.safeParse("Password123!");
    expect(result.success).toBe(true);
  });

  it("MIN_PASSWORD_LENGTH stays at 12 (NOM-024-SSA3 baseline, unchanged by this story)", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });
});
