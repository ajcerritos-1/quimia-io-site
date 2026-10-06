/**
 * Story 2.1 (change 2/6) — the "Configuración" admin catalog CRUD surface.
 * Exercises the user-visible flow end to end: the admin-only nav entry, the
 * hub with its five labeled cards, per-catalog slug resolution, create/edit/
 * deactivate/reactivate through the real modal dialogs, the empty state, the
 * sidebar's sub-route highlight, and the non-admin 404 gate.
 *
 * Pattern: `tests/e2e/usuarios.spec.ts` (seed tenant/user via the owner
 * client, sign in through the real `/sign-in` UI, drive the rendered page).
 */
import { expect, test, type Page } from "@playwright/test";
import { seedTenant, seedUser, withOwnerClient } from "./seed";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";
const PORT = process.env.E2E_PORT ?? "3100";

function tenantUrl(slug: string, pathName = "/sign-in"): string {
  return `http://${slug}.localhost:${PORT}${pathName}`;
}

async function signInViaUi(
  page: Page,
  slug: string,
  email: string,
): Promise<void> {
  await page.goto(tenantUrl(slug));
  await page.getByLabel(/email or nickname/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

function mainNav(page: Page) {
  return page.getByRole("navigation", { name: /navegación principal/i });
}

test.describe("Configuración catalog CRUD (Story 2.1)", () => {
  test("an admin sees the nav entry and the hub with five labeled cards linking to their catalogs", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);

    // Admin-only nav entry is visible.
    await expect(
      mainNav(page).getByRole("link", { name: "Configuración" }),
    ).toBeVisible();

    await page.goto(tenantUrl(tenant.slug, "/configuracion"));

    // Hub header + exactly five labeled cards.
    await expect(
      page.getByRole("heading", { name: /configuración/i, level: 1 }),
    ).toBeVisible();
    for (const label of [
      "Métodos",
      "Técnicas",
      "Equipos",
      "Recipientes",
      "Tipos de Muestra",
    ]) {
      await expect(
        page.getByRole("heading", { name: label, level: 2 }),
      ).toBeVisible();
    }

    // Fresh tenant: every catalog is empty, so every card shows "0 elementos".
    await expect(page.getByText("0 elementos")).toHaveCount(5);

    // The "Métodos" card links to its per-catalog page...
    await page.getByRole("link", { name: /métodos/i }).click();
    await expect(page).toHaveURL(/\/configuracion\/metodos$/);

    // ...and the sidebar keeps "Configuración" highlighted on the sub-route.
    await expect(
      mainNav(page).getByRole("link", { name: "Configuración" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      mainNav(page).getByRole("link", { name: "Usuarios y Roles" }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  test("an admin can create, edit, deactivate and reactivate a catalog row", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });
    const name = `GLUCOSA E2E ${Date.now()}`;
    const renamed = `${name} 2GEN`;

    await signInViaUi(page, tenant.slug, admin.email);
    await page.goto(tenantUrl(tenant.slug, "/configuracion/metodos"));

    // Page header uses the catalog label; a fresh catalog shows the empty state.
    await expect(
      page.getByRole("heading", { name: "Métodos", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("No hay Métodos todavía")).toBeVisible();

    // Open the create dialog from the page header trigger.
    await page.getByRole("button", { name: /crear métodos/i }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog).toBeVisible();
    await expect(
      createDialog.getByRole("heading", { name: /crear métodos/i }),
    ).toBeVisible();

    await createDialog.getByLabel(/^nombre$/i).fill(name);
    await createDialog.getByRole("button", { name: /crear métodos/i }).click();

    // Success auto-closes the dialog; the revalidated table shows the new row.
    await expect(createDialog).not.toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Activo")).toBeVisible();
    await expect(page.getByText("No hay Métodos todavía")).toHaveCount(0);

    // Edit pre-fills the current value and saves the rename.
    await row.getByRole("button", { name: /editar/i }).click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel(/^nombre$/i)).toHaveValue(name);
    await editDialog.getByLabel(/^nombre$/i).fill(renamed);
    await editDialog.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(editDialog).not.toBeVisible();
    const renamedRow = page.getByRole("row", { name: new RegExp(renamed) });
    await expect(renamedRow).toBeVisible();

    // Deactivate flips the badge to "Inactivo" without removing the row.
    await renamedRow.getByRole("button", { name: /desactivar/i }).click();
    await expect(renamedRow.getByText("Inactivo")).toBeVisible();
    await expect(renamedRow).toBeVisible();

    // Reactivate flips it back to "Activo".
    await renamedRow.getByRole("button", { name: /reactivar/i }).click();
    await expect(renamedRow.getByText("Activo")).toBeVisible();
  });

  test("a non-admin gets 404 on the hub and the per-catalog route and never sees the nav entry", async ({
    page,
  }) => {
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
    await expect(
      mainNav(page).getByRole("link", { name: "Configuración" }),
    ).toHaveCount(0);

    const hubResponse = await page.goto(tenantUrl(tenant.slug, "/configuracion"));
    expect(hubResponse?.status()).toBe(404);

    const catalogResponse = await page.goto(
      tenantUrl(tenant.slug, "/configuracion/metodos"),
    );
    expect(catalogResponse?.status()).toBe(404);
  });

  test("an unknown catalog slug returns 404 for an admin", async ({ page }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);

    const nonCanonical = await page.goto(
      tenantUrl(tenant.slug, "/configuracion/tiposDeMuestra"),
    );
    expect(nonCanonical?.status()).toBe(404);

    const unknown = await page.goto(
      tenantUrl(tenant.slug, "/configuracion/inexistente"),
    );
    expect(unknown?.status()).toBe(404);
  });
});
