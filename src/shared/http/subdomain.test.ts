import { describe, expect, it } from "vitest";
import { extractSubdomain } from "./subdomain";

describe("extractSubdomain", () => {
  it("extracts the leftmost label from a tenant subdomain host", () => {
    expect(extractSubdomain("acme.quimiaio.com")).toBe("acme");
  });

  it("strips the port before extracting", () => {
    expect(extractSubdomain("acme.quimiaio.com:3000")).toBe("acme");
  });

  it("returns null for the bare root domain (no subdomain)", () => {
    expect(extractSubdomain("quimiaio.com")).toBeNull();
  });

  it("returns null for a bare host with no dots", () => {
    expect(extractSubdomain("localhost")).toBeNull();
    expect(extractSubdomain("localhost:3000")).toBeNull();
  });

  it("returns null for a missing host header", () => {
    expect(extractSubdomain(null)).toBeNull();
  });

  it("supports the {lab}.localhost dev convention", () => {
    expect(extractSubdomain("acme.localhost:3000")).toBe("acme");
  });
});
