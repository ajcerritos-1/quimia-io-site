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

/**
 * Escapes regex metacharacters (Review Findings patch 2026-08-17) before a
 * dynamically generated value (a nickname) is interpolated into a
 * `new RegExp(...)` locator — today's nickname generators never emit a
 * metacharacter, but building an unescaped RegExp from arbitrary dynamic
 * text is a footgun the moment that stops being true.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

    // Self-action guard (Story 1.3 AC 6): the signed-in admin's OWN row
    // renders its role <select> and Desactivar control visibly disabled with
    // a stated, visible reason — never silently inert.
    const ownRow = page.getByRole("row", {
      name: new RegExp(escapeRegExp(admin.nickname)),
    });
    const ownRoleSelect = ownRow.getByRole("combobox");
    await expect(ownRoleSelect).toBeDisabled();
    const ownRoleReasonId = await ownRoleSelect.getAttribute("aria-describedby");
    expect(ownRoleReasonId).toBeTruthy();
    await expect(page.locator(`#${ownRoleReasonId}`)).toHaveText(
      "No puedes cambiar tu propio rol.",
    );

    const ownDeactivateButton = ownRow.getByRole("button", { name: /desactivar/i });
    await expect(ownDeactivateButton).toBeDisabled();
    const ownDeactivateReasonId = await ownDeactivateButton.getAttribute(
      "aria-describedby",
    );
    expect(ownDeactivateReasonId).toBeTruthy();
    await expect(page.locator(`#${ownDeactivateReasonId}`)).toHaveText(
      "No puedes desactivar tu propia cuenta.",
    );

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
    const row = page.getByRole("row", {
      name: new RegExp(escapeRegExp(newNickname)),
    });
    await row.getByRole("combobox").selectOption("recepcionista");
    await expect(row.getByRole("combobox")).toHaveValue("recepcionista");

    // Deactivate the new user.
    await row.getByRole("button", { name: /desactivar/i }).click();
    await expect(row.getByText(/inactivo/i)).toBeVisible();
    await expect(row.getByRole("button", { name: /desactivar/i })).toHaveCount(0);
  });

  test("create-user form renders the specific password-policy message inline for a client-side rejection (Review Findings patch)", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.goto(tenantUrl(tenant.slug, "/usuarios"));

    const newEmail = `nuevo-${Date.now()}@example.com`;
    const newNickname = `nuevo${Date.now()}`;

    // React resets this form's uncontrolled inputs after every action call,
    // including a validation-failure call (the action promise still
    // resolves, it just carries `ok: false`) — so every attempt below
    // refills every field, mirroring how a real user would re-enter data
    // after a rejected submission rather than relying on values surviving
    // across submits.
    async function fillAndSubmit(password: string): Promise<void> {
      await page.getByLabel(/^nombre$/i).fill("Usuario Nuevo");
      await page.getByLabel(/nickname/i).fill(newNickname);
      await page.getByLabel(/^email$/i).fill(newEmail);
      await page.getByLabel(/^rol$/i).selectOption("quimico");
      await page.getByLabel(/contraseña inicial/i).fill(password);
      await page.getByRole("button", { name: /crear usuario/i }).click();
    }

    // 8 chars, hits all 4 character classes but fails the 12-char minimum —
    // the client must render the LENGTH-specific message, not the
    // complexity one (this is the first real UI exercise of the shared
    // `passwordPolicySchema` on the client, not just code inspection).
    await fillAndSubmit("Ab1!Ab1!");
    await expect(
      page.getByText("La contraseña debe tener al menos 12 caracteres."),
    ).toBeVisible();

    // 12+ chars, all lowercase (1 of 4 classes) — the client must now
    // render the COMPLEXITY-specific message instead.
    await fillAndSubmit("alllowercase");
    await expect(
      page.getByText(
        "La contraseña debe incluir mayúsculas, minúsculas, números y símbolos (al menos 3 de 4 tipos).",
      ),
    ).toBeVisible();

    // A password meeting the shared policy actually goes through — proves
    // this was a real client-side Zod rejection above, not a static string
    // the page never removes.
    await fillAndSubmit("Password-123!");
    await expect(page.getByText(newNickname)).toBeVisible();
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
