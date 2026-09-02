/**
 * Story 1.5 Task 10 — e2e coverage for the app shell (AC 1, 2, 3, 5). Real
 * ephemeral Neon branch via the existing `seedTenant`/`seedUser`/
 * `withOwnerClient` harness (`tests/e2e/seed.ts`), same pattern
 * `usuarios.spec.ts`/`sign-in.spec.ts` already use. Does NOT modify either
 * of those files (AC 4, AC 6) — both keep passing unmodified.
 *
 * Updated for the landing-page change: the shell home moved from `/` to
 * `/inicio` (the public landing now serves `/` for any host), and the
 * sign-in form redirects there on success — so `signInViaUi` and every
 * shell-home navigation target `/inicio`, and the success assertion waits
 * for the URL rather than the transient `sign-in-success` marker (no race,
 * per the sign-in form's own header comment). The unauthenticated-redirect
 * and per-role-content tests keep their original intent against `/inicio`.
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
  // The form redirects to the shell home on success — assert the resulting
  // URL, not the transient `sign-in-success` marker (deterministic).
  await expect(page).toHaveURL(/\/inicio$/);
}

test.describe("App shell — desktop RBAC nav visibility (AC 1, 3)", () => {
  test("an admin's sidebar shows the Usuarios y Roles link", async ({ page }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.goto(tenantUrl(tenant.slug, "/inicio"));

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
    await page.goto(tenantUrl(tenant.slug, "/inicio"));

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
    await page.goto(tenantUrl(tenant.slug, "/inicio"));

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

  test("tapping a nav link inside the drawer closes it (P1 regression)", async ({
    page,
  }) => {
    const { tenant, admin } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      const admin = await seedUser(client, tenant.tenantId, PASSWORD, "admin");
      return { tenant, admin };
    });

    await signInViaUi(page, tenant.slug, admin.email);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(tenantUrl(tenant.slug, "/inicio"));

    const trigger = page.getByRole("button", { name: /abrir menú de navegación/i });
    await trigger.click();
    const drawerNav = page.getByRole("navigation", { name: /navegación principal/i });
    await expect(drawerNav).toBeVisible();

    // P1 (2026-08-18): tapping a nav link left the drawer/backdrop covering
    // the newly-navigated page. The fix wired `Sidebar.onNavigate` to close
    // the drawer — this assertion catches a regression of the original bug.
    await drawerNav.getByRole("link", { name: /usuarios y roles/i }).click();
    await expect(drawerNav).not.toBeVisible();
    await expect(page).toHaveURL(/\/usuarios$/);
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
    await page.goto(tenantUrl(tenant.slug, "/inicio"));

    // Real keyboard-driven focus (not `.focus()`), so Chromium's
    // `:focus-visible` heuristic actually applies — the drawer trigger is
    // the first focusable element in the shell's DOM order on phone.
    await page.keyboard.press("Tab");
    const boxShadow = await page.evaluate(() =>
      document.activeElement ? getComputedStyle(document.activeElement).boxShadow : null,
    );

    // Strengthened assertion (2026-08-24 review patch): a bare "not none"
    // check would pass for ANY box-shadow, including a transparent or
    // zero-spread one. A real visible ring (the story's Task 9
    // `focus-visible:ring-3 focus-visible:ring-ring/50` pattern) renders as
    // a colored shadow with a >= 2px spread — assert that, not just presence.
    //
    // Tailwind's ring chain serializes as a box-shadow LIST whose last entry
    // is a trailing empty `0 0 #0000` shadow — so "the" shadow is never one
    // value. Parse every shadow and accept if ANY of them is a visible ring
    // (spread >= 2px AND non-transparent color). Fixed 2026-08-24 review:
    // the original patch grabbed the LAST shadow (the empty one) and the
    // FIRST rgba() (also transparent), so it would false-fail on a correct
    // render — verified against the project's actual Tailwind 4.3.3 output.
    expect(boxShadow).not.toBeNull();
    expect(boxShadow).not.toBe("none");
    expect(boxShadow).not.toBe("");
    const ringVisible = (boxShadow ?? "")
      .split(", ")
      .some((shadow) => {
        // Spread is the last px token in both color-first and color-last
        // serializations (offsets/blur/spread carry px; the color never does).
        const spread = Number(shadow.match(/([\d.]+)px\s*$/)?.[1]);
        if (Number.isNaN(spread) || spread < 2) return false;
        // Color alpha: rgba(…, a) / rgb(… / a) -> 4th component; opaque
        // rgb()/hex/named colors have no alpha -> treat as fully visible.
        const color = shadow.match(/rgba?\(\s*([^)]*)\)/);
        if (!color) return true;
        const parts = color[1].split(/[,/]/).map((p) => p.trim());
        const alpha = parts.length >= 4 ? parts[3] : "1";
        const alphaNum = alpha.endsWith("%") ? parseFloat(alpha) / 100 : parseFloat(alpha);
        return alphaNum > 0;
      });
    expect(ringVisible).toBe(true);
  });
});

test.describe("App shell — unauthenticated redirect (AC 5)", () => {
  test("an unauthenticated visit to /inicio redirects to /sign-in", async ({ page }) => {
    const { tenant } = await withOwnerClient(async (client) => {
      const tenant = await seedTenant(client);
      return { tenant };
    });

    await page.goto(tenantUrl(tenant.slug, "/inicio"));
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

test.describe("App shell — shell home page at /inicio (moved from /)", () => {
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
    const response = await page.goto(tenantUrl(tenant.slug, "/inicio"));

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
    await page.goto(tenantUrl(tenant.slug, "/inicio"));

    await expect(
      page.getByRole("heading", { name: /bienvenido a quimia io/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /ir a usuarios/i })).toBeVisible();
  });
});

test.describe("Public landing page at /", () => {
  test("the bare root renders the public landing with the sign-in CTA for any host", async ({
    page,
  }) => {
    // Bare root (`localhost:3100` — no tenant subdomain, no session): the
    // landing must render without any tenant context because it never calls
    // resolveActor(); `/` is public by choice, not by weakening the tenant
    // model (the workspace is protected at `/inicio`).
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /quimia io/i }),
    ).toBeVisible();

    const cta = page.getByRole("link", { name: /iniciar sesión/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
