/**
 * Phase 7.1/7.2 — sign-in happy path and invalid-credentials e2e coverage,
 * driving a real Chromium browser against a real `next dev` server (see
 * `playwright.config.ts` / `docs/e2e-testing.md` for why this replaces
 * design.md's original "Playwright against a preview deploy" plan).
 *
 * Tenants are seeded directly via the ephemeral Neon branch
 * `scripts/e2e/start-server.ts` creates for the running `next dev` server,
 * using the exact seeding pattern `tests/integration/auth-sign-in.test.ts`
 * (PR 4a) already uses (`seed.ts`).
 */
import { expect, test } from "@playwright/test";
import { seedTenant, seedUser, withOwnerClient } from "./seed";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";
const PORT = process.env.E2E_PORT ?? "3100";

function tenantUrl(slug: string, pathName = "/sign-in"): string {
  return `http://${slug}.localhost:${PORT}${pathName}`;
}

test.describe("Sign-in — happy path (7.1)", () => {
  test("valid credentials sign the user in and establish a real session", async ({
    page,
  }) => {
    const { tenant, user } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const user = await seedUser(client, tenant.tenantId, PASSWORD);
      return { tenant, user };
    });

    await page.goto(tenantUrl(tenant.slug));
    await page.getByLabel(/email or nickname/i).fill(user.email);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByTestId("sign-in-success")).toBeVisible();

    // Confirms a REAL, browser-held session cookie was established — not
    // just a UI-level success message — by navigating (same browser
    // context, cookie sent automatically) to Better Auth's own mounted
    // route (`src/app/api/auth/[...all]/route.ts`, PR 4a). Deliberately
    // `page.goto`, not `page.request.get`: Playwright's `APIRequestContext`
    // uses Node's own DNS resolution, which does not special-case
    // `*.localhost` wildcard subdomains the way Chromium's browser
    // navigation does (confirmed empirically — `page.request.get` against
    // this exact URL fails with `ENOTFOUND`, while every `page.goto` call
    // in this file, including the one just above, resolves fine).
    await page.goto(tenantUrl(tenant.slug, "/api/auth/get-session"));
    const session = JSON.parse(await page.locator("body").innerText());
    expect(session?.user?.email).toBe(user.email);
  });
});

test.describe("Sign-in — invalid credentials (7.2)", () => {
  test("wrong password renders the single generic message, no field-specific hint (AC-4)", async ({
    page,
  }) => {
    const { tenant, user } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const user = await seedUser(client, tenant.tenantId, PASSWORD);
      return { tenant, user };
    });

    await page.goto(tenantUrl(tenant.slug));
    await page.getByLabel(/email or nickname/i).fill(user.email);
    await page.getByLabel(/password/i).fill("totally-wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    const error = page.getByTestId("sign-in-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveText("Invalid credentials.");
    await expect(page.getByTestId("sign-in-success")).toHaveCount(0);
  });

  test("inactive account with a correct password renders the byte-for-byte identical generic message (D11)", async ({
    page,
  }) => {
    const { tenant, user } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const user = await seedUser(client, tenant.tenantId, PASSWORD);
      await client.query(`UPDATE "user" SET "isActive" = false WHERE id = $1`, [
        user.userId,
      ]);
      return { tenant, user };
    });

    await page.goto(tenantUrl(tenant.slug));
    await page.getByLabel(/email or nickname/i).fill(user.email);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    const error = page.getByTestId("sign-in-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveText("Invalid credentials.");
  });
});
