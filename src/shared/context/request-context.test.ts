import { describe, expect, it } from "vitest";
import { getContext, runWithContext } from "./request-context";

describe("request-context", () => {
  it("is empty outside of runWithContext", () => {
    expect(getContext()).toBeUndefined();
  });

  it("exposes the context synchronously inside runWithContext", () => {
    const result = runWithContext(
      { requestId: "req-1", tenant: { tenantId: "tenant-a", role: "admin" } },
      () => getContext(),
    );

    expect(result).toEqual({
      requestId: "req-1",
      tenant: { tenantId: "tenant-a", role: "admin" },
    });
  });

  it("does not leak context across separate runWithContext calls", () => {
    runWithContext(
      { requestId: "req-1", tenant: { tenantId: "tenant-a", role: "admin" } },
      () => {
        expect(getContext()?.requestId).toBe("req-1");
      },
    );

    expect(getContext()).toBeUndefined();
  });

  it("isolates concurrent async contexts from each other", async () => {
    const readAfterDelay = (requestId: string, tenantId: string) =>
      runWithContext(
        { requestId, tenant: { tenantId, role: "admin" } },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return getContext();
        },
      );

    const [a, b] = await Promise.all([
      readAfterDelay("req-a", "tenant-a"),
      readAfterDelay("req-b", "tenant-b"),
    ]);

    expect(a?.tenant.tenantId).toBe("tenant-a");
    expect(b?.tenant.tenantId).toBe("tenant-b");
  });

  it("returns the value produced by the wrapped function", () => {
    const value = runWithContext(
      { requestId: "req-1", tenant: { tenantId: "tenant-a", role: "admin" } },
      () => 42,
    );

    expect(value).toBe(42);
  });
});
