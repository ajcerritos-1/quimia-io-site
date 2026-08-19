/**
 * Story 1.5 Task 10 — e2e coverage for the app shell (AC 1, 2, 3, 5). Real
 * ephemeral Neon branch via the existing `seedTenant`/`seedUser`/
 * `withOwnerClient` harness (`tests/e2e/seed.ts`), same pattern
 * `usuarios.spec.ts`/`sign-in.spec.ts` already use. Does NOT modify either
 * of those files (AC 4, AC 6) — both keep passing unmodified.
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

test.describe("App shell — desktop RBAC nav visibility (AC 1, 3)", () => {
  test("an admin's sidebar shows the Usuarios y Roles link", async ({ page }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.goto(tenantUrl(tenant.slug, "/"));

    // This navigation locator resolves to exactly one element only because of
    // two stacked defaults — `Dialog.Portal`'s `keepMounted={false}` and the
    // desktop sidebar's Tailwind `hidden md:flex` (see the note in
    // `nav-drawer.tsx`). Don't "fix" either without reading that comment.
    const sidebar = page.getByRole("navigation", { name: /navegación principal/i });
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /usuarios y roles/i }),
    ).toBeVisible();
  });

  test("a recepcionista's sidebar renders but hides the Usuarios y Roles link entirely", async ({
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
    await page.goto(tenantUrl(tenant.slug, "/"));

    const sidebar = page.getByRole("navigation", { name: /navegación principal/i });
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /usuarios y roles/i }),
    ).toHaveCount(0);
  });
});

test.describe("App shell — phone off-canvas drawer (AC 2)", () => {
  test("the persistent sidebar hides on phone; the drawer opens from the topbar trigger and closes via its close control or Escape", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(tenantUrl(tenant.slug, "/"));

    // The persistent sidebar (desktop/tablet) is not visible on phone.
    await expect(
      page.getByRole("navigation", { name: /navegación principal/i }),
    ).not.toBeVisible();

    // A compact topbar with a drawer-trigger control is visible.
    const trigger = page.getByRole("button", { name: /abrir menú de navegación/i });
    await expect(trigger).toBeVisible();

    // Opening reveals the drawer containing the same nav content.
    await trigger.click();
    const drawerNav = page.getByRole("navigation", { name: /navegación principal/i });
    await expect(drawerNav).toBeVisible();
    await expect(
      drawerNav.getByRole("link", { name: /usuarios y roles/i }),
    ).toBeVisible();

    // Closing via its own close control hides it again.
    await page.getByRole("button", { name: /cerrar menú de navegación/i }).click();
    await expect(drawerNav).not.toBeVisible();

    // Reopen, then close via Escape.
    await trigger.click();
    await expect(drawerNav).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawerNav).not.toBeVisible();
  });

  test("the focused drawer trigger renders a real, visible focus affordance, not just a class string (AC 2)", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(tenantUrl(tenant.slug, "/"));

    // Real keyboard-driven focus (not `.focus()`), so Chromium's
    // `:focus-visible` heuristic actually applies — the drawer trigger is
    // the first focusable element in the shell's DOM order on phone.
    await page.keyboard.press("Tab");
    const boxShadow = await page.evaluate(() =>
      document.activeElement ? getComputedStyle(document.activeElement).boxShadow : null,
    );

    expect(boxShadow).not.toBeNull();
    expect(boxShadow).not.toBe("none");
    expect(boxShadow).not.toBe("");
  });
});

test.describe("App shell — unauthenticated redirect (AC 5)", () => {
  test("an unauthenticated visit to / redirects to /sign-in", async ({ page }) => {
    const { tenant } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      return { tenant };
    });

    await page.goto(tenantUrl(tenant.slug, "/"));
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("an unauthenticated visit to /usuarios redirects to /sign-in", async ({ page }) => {
    const { tenant } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      return { tenant };
    });

    await page.goto(tenantUrl(tenant.slug, "/usuarios"));
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe("App shell — root landing page (AC 5)", () => {
  test("a recepcionista sees the placeholder content, not a 404 or the old starter content, and no admin shortcut", async ({
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
    const response = await page.goto(tenantUrl(tenant.slug, "/"));

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /bienvenido a quimia io/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /ir a usuarios/i })).toHaveCount(0);
  });

  test("an admin sees the placeholder content plus the 'Ir a Usuarios' shortcut", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.goto(tenantUrl(tenant.slug, "/"));

    await expect(
      page.getByRole("heading", { name: /bienvenido a quimia io/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /ir a usuarios/i })).toBeVisible();
  });
});
