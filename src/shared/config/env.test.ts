import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    expect(() => loadEnv({})).toThrow();
  });

  it("throws when DATABASE_URL is not a valid postgres connection string", () => {
    expect(() => loadEnv({ DATABASE_URL: "not-a-url" })).toThrow();
    expect(() =>
      loadEnv({ DATABASE_URL: "mysql://user:pass@host:3306/db" }),
    ).toThrow();
  });

  it("parses a valid environment and defaults NODE_ENV to development", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://quimia_app:secret@host/db?sslmode=require",
    });

    expect(env.DATABASE_URL).toBe(
      "postgresql://quimia_app:secret@host/db?sslmode=require",
    );
    expect(env.NODE_ENV).toBe("development");
  });

  it("accepts an explicit NODE_ENV value", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://quimia_app:secret@host/db?sslmode=require",
      NODE_ENV: "test",
    });

    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects an unrecognized NODE_ENV value", () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgresql://quimia_app:secret@host/db?sslmode=require",
        NODE_ENV: "staging",
      }),
    ).toThrow();
  });
});
