/**
 * Root landing page (Story 1.5 Task 8, AC 5). Replaces the create-next-app
 * placeholder, which is deleted entirely.
 *
 * `/` is a role-agnostic authenticated placeholder, NOT a role-conditional
 * redirect to `/usuarios` — see this story's own Dev Notes for why: a
 * `recepcionista`/`quimico` has genuinely nowhere else to go yet (Epics 2-11
 * haven't shipped), so redirecting them to `/usuarios` would just trade the
 * old dead end for an immediate 404 (`requireAdmin()` still gates that page,
 * unchanged). Every authenticated role sees this same minimal, professional-
 * tone Spanish placeholder (`UX-DR22`/NFR-9's voice-and-tone standard).
 *
 * The "Ir a Usuarios" shortcut renders only when the signed-in role sees the
 * `/usuarios` nav item in the registry (`visibleNavItems(...)` — which is
 * itself driven by `isRoleAllowed()` under the hood, AC 3). This derives the
 * visibility from the single source of truth (code review S1) instead of a
 * second hardcoded `["admin"]` literal, so if the `/usuarios` admin
 * requirement ever changes, only the registry (`nav-items.ts`) changes.
 *
 * Resolves its own actor via the shared `resolveActor()` (see
 * `(app)/layout.tsx`'s note on why the layout can't hand it down) —
 * unauthenticated visitors never reach this far; the shell layout already
 * redirected them to `/sign-in` before this page's own body would render.
 *
 * This placeholder is explicitly temporary scaffolding — Epic 10's real
 * Dashboard (`FR-51`) replaces it, not a first draft to iterate on.
 */
import "server-only";
import Link from "next/link";
import { resolveActor } from "@/modules/auth/server/resolve-actor";
import { visibleNavItems } from "@/components/shell/nav-items";

export default async function HomePage() {
  const actor = await resolveActor();
  const canManageUsers = visibleNavItems(actor.role).some(
    (item) => item.href === "/usuarios",
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Bienvenido a Quimia IO.</h1>
      <p className="text-sm text-muted-foreground">
        Sesión iniciada correctamente. Usa el menú de navegación para acceder
        a las secciones disponibles para tu rol.
      </p>
      {canManageUsers ? (
        <Link
          href="/usuarios"
          className="w-fit rounded-lg border border-transparent text-sm font-medium text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Ir a Usuarios
        </Link>
      ) : null}
    </div>
  );
}
