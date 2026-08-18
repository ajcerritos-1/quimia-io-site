import { describe, expect, it } from "vitest";
import {
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "./account-lockout";

describe("account-lockout constants (Story 1.4 Task 4, AC 2)", () => {
  it("MAX_FAILED_LOGIN_ATTEMPTS is 5 (confirmed 2026-08-17 product decision)", () => {
    expect(MAX_FAILED_LOGIN_ATTEMPTS).toBe(5);
  });

  it("LOCKOUT_DURATION_MINUTES is 15 (confirmed 2026-08-17 product decision)", () => {
    expect(LOCKOUT_DURATION_MINUTES).toBe(15);
  });
});
