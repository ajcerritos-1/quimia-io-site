/**
 * Story 1.2 Task 7 — minimal admin UI at `/usuarios` (AC 1, 2, 3). No
 * sidebar/app shell (Story 1.5's scope) — this route just needs to exist
 * and be reachable by URL. Signs in through the real `/sign-in` UI (same
 * pattern as `sign-in.spec.ts`) to get a real browser session, then drives
 * create/edit-role/deactivate through the actual rendered page.
 */
import { expect, test } from "@playwright/test";
import { seedTenant, seedUser, withOwnerClient } from "./seed";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";
const PORT = process.env.E2E_PORT ?? "3100";

function tenantUrl(slug: string, pathName = "/sign-in"): string {
  return `http://${slug}.localhost:${PORT}${pathName}`;
}

async function signInViaUi(
  page: import("@playwright/test").Page,
  slug: string,
  email: string,
): Promise<void> {
  await page.goto(tenantUrl(slug));
  await page.getByLabel(/email or nickname/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByTestId("sign-in-success")).toBeVisible();
}

test.describe("Usuarios admin UI (Task 7, AC 1/2/3)", () => {
  test("an admin can list, create, edit the role of, and deactivate a user", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.goto(tenantUrl(tenant.slug, "/usuarios"));

    await expect(page.getByRole("heading", { name: /usuarios/i })).toBeVisible();
    await expect(page.getByText(admin.nickname)).toBeVisible();

    // Create a new user.
    const newEmail = `nuevo-${Date.now()}@example.com`;
    const newNickname = `nuevo${Date.now()}`;
    await page.getByLabel(/^nombre$/i).fill("Usuario Nuevo");
    await page.getByLabel(/nickname/i).fill(newNickname);
    await page.getByLabel(/^email$/i).fill(newEmail);
    await page.getByLabel(/contraseña inicial/i).fill("Otra-Password-Segura-1!");
    await page.getByLabel(/^rol$/i).selectOption("quimico");
    await page.getByRole("button", { name: /crear usuario/i }).click();

    await expect(page.getByText(newNickname)).toBeVisible();

    // Edit the new user's role.
    const row = page.getByRole("row", { name: new RegExp(newNickname) });
    await row.getByRole("combobox").selectOption("recepcionista");
    await expect(row.getByRole("combobox")).toHaveValue("recepcionista");

    // Deactivate the new user.
    await row.getByRole("button", { name: /desactivar/i }).click();
    await expect(row.getByText(/inactivo/i)).toBeVisible();
    await expect(row.getByRole("button", { name: /desactivar/i })).toHaveCount(0);
  });

  test("a non-admin cannot reach /usuarios", async ({ page }) => {
    const { tenant, recepcionista } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const recepcionista = await seedUser(
        client,
        tenant.tenantId,
        PASSWORD,
        "recepcionista",
      );
      return { tenant, recepcionista };
    });

    await signInViaUi(page, tenant.slug, recepcionista.email);
    const response = await page.goto(tenantUrl(tenant.slug, "/usuarios"));

    expect(response?.status()).toBe(404);
  });
});
