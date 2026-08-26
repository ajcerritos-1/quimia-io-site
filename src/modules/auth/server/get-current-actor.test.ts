/**
 * Story 1.5 Review Patch (2026-08-24) — unit coverage for the P4
 * `cache()` refactor in `get-current-actor.ts`.
 *
 * EMPIRICAL SCOPE NOTE (verified 2026-08-24): React's `cache()` memoization
 * is a no-op passthrough OUTSIDE a real Next.js request scope — the
 * dedupe-on-argument-identity contract only exists when the RSC cache
 * dispatcher is installed (i.e. under an actual HTTP request through the
 * running server, which is e2e territory, blocked on the Windows Playwright
 * hang tracked in deferred-work.md). A Vitest unit run CANNOT observe the
 * dedup — an attempt asserting "one session read for two identical calls"
 * fails with 2 reads. That verification therefore lives in the deferred e2e
 * bucket, NOT here.
 *
 * What this file DOES cover (environment-independent contract):
 * 1. A missing session rejects with the generic 401 envelope (no hint).
 * 2. A missing/inactive user row rejects with the same 401 envelope.
 * 3. A successful resolution returns the resolved actor and re-runs `fn`
 *    once per `getCurrentActor()` call — `fn` is deliberately NOT cached.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/db", () => ({
  scoped: vi.fn(),
}));

vi.mock("../../../shared/context/request-context", () => ({
  runWithContext: (_ctx: unknown, fn: () => unknown) => fn(),
}));

vi.mock("./auth", () => ({
  auth: { api: { getSession: vi.fn() } },
  AUTH_INVALID_CREDENTIALS: {
    code: "AUTH_INVALID_CREDENTIALS",
    message: "Invalid credentials.",
  },
}));

import { getCurrentActor } from "./get-current-actor";
import { auth } from "./auth";
import { scoped } from "../../../shared/db";

const getSession = vi.mocked(auth.api.getSession);
const scopedMock = vi.mocked(scoped);
const findUnique = vi.fn();

describe("getCurrentActor (Story 1.5 review patch — P4 cache() contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({
      id: "user-1",
      isActive: true,
      role: "admin",
    });
    getSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    scopedMock.mockReturnValue({ user: { findUnique } } as never);
  });

  it("resolves the actor and re-runs fn once per call (fn is deliberately NOT cached)", async () => {
    const headers = new Headers();
    const request = { headers, tenantId: "tenant-1", requestId: "req-1" };
    const fn = vi.fn(async (actor: { userId: string }) => actor.userId);

    const first = await getCurrentActor(request, fn);
    const second = await getCurrentActor(request, fn);

    expect(first).toBe("user-1");
    expect(second).toBe("user-1");
    // P4's comment: "The re-run of fn under the real role is NOT cached, so a
    // caller's own per-invocation side effects still run exactly once per
    // getCurrentActor() call, as before."
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rejects with the generic 401 envelope when there is no session", async () => {
    getSession.mockResolvedValue(null as never);

    await expect(
      getCurrentActor(
        { headers: new Headers(), tenantId: "tenant-1", requestId: "req-1" },
        async (actor) => actor.userId,
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects with the generic 401 envelope when the user row is missing or inactive", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      getCurrentActor(
        { headers: new Headers(), tenantId: "tenant-1", requestId: "req-1" },
        async (actor) => actor.userId,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects with the generic 401 envelope when the user row exists but is deactivated", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      isActive: false,
      role: "admin",
    });

    await expect(
      getCurrentActor(
        { headers: new Headers(), tenantId: "tenant-1", requestId: "req-1" },
        async (actor) => actor.userId,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});