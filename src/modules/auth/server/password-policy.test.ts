import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  passwordPolicySchema,
} from "./password-policy";

const SPECIFIC_MESSAGE =
  "La contraseña debe tener al menos 12 caracteres e incluir mayúsculas, minúsculas, números o símbolos (al menos 3 de 4 tipos).";

describe("passwordPolicySchema (Story 1.4 Task 1, AC 1)", () => {
  it("rejects a password shorter than MIN_PASSWORD_LENGTH with the specific message", () => {
    const result = passwordPolicySchema.safeParse("Short1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(SPECIFIC_MESSAGE);
    }
  });

  it("rejects a 12+ character password that only hits 2 of 4 character classes (all lowercase + digits)", () => {
    // 12 chars, lowercase + digits only (2 classes) — long enough, not complex enough.
    const result = passwordPolicySchema.safeParse("lowercase123");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(SPECIFIC_MESSAGE);
    }
  });

  it("rejects a 12+ character password that is all lowercase (1 class)", () => {
    const result = passwordPolicySchema.safeParse("alllowercase");
    expect(result.success).toBe(false);
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
