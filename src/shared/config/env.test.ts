import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

// Shared valid fixture for tests that only care about ONE other field —
// keeps each test's intent (what's being validated) visible in its own
// override, without repeating every required key everywhere.
const VALID_ENV = {
  DATABASE_URL: "postgresql://quimia_app:secret@host/db?sslmode=require",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

function withoutKey<K extends keyof typeof VALID_ENV>(
  key: K,
): Record<string, string | undefined> {
  const copy: Record<string, string | undefined> = { ...VALID_ENV };
  delete copy[key];
  return copy;
}

describe("loadEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    expect(() => loadEnv({})).toThrow();
  });

  it("throws when DATABASE_URL is not a valid postgres connection string", () => {
    expect(() =>
      loadEnv({ ...VALID_ENV, DATABASE_URL: "not-a-url" }),
    ).toThrow();
    expect(() =>
      loadEnv({
        ...VALID_ENV,
        DATABASE_URL: "mysql://user:pass@host:3306/db",
      }),
    ).toThrow();
  });

  it("parses a valid environment and defaults NODE_ENV to development", () => {
    const env = loadEnv(VALID_ENV);

    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
  });

  it("accepts an explicit NODE_ENV value", () => {
    const env = loadEnv({ ...VALID_ENV, NODE_ENV: "test" });

    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects an unrecognized NODE_ENV value", () => {
    expect(() =>
      loadEnv({ ...VALID_ENV, NODE_ENV: "staging" }),
    ).toThrow();
  });

  it("throws when BETTER_AUTH_SECRET is missing (Phase 6 — Better Auth config)", () => {
    expect(() => loadEnv(withoutKey("BETTER_AUTH_SECRET"))).toThrow();
  });

  it("throws when BETTER_AUTH_SECRET is shorter than 32 chars", () => {
    expect(() =>
      loadEnv({ ...VALID_ENV, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow();
  });

  it("throws when BETTER_AUTH_URL is missing or not a URL", () => {
    expect(() => loadEnv(withoutKey("BETTER_AUTH_URL"))).toThrow();
    expect(() =>
      loadEnv({ ...VALID_ENV, BETTER_AUTH_URL: "not-a-url" }),
    ).toThrow();
  });
});
