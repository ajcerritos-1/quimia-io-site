/**
 * The app shell (Story 1.5 Task 6, AC 1/2/4/5). A Next.js route group —
 * `(app)` adds no URL segment, so every route nested inside it keeps its
 * existing URL (`(app)/usuarios/page.tsx` still serves at `/usuarios`,
 * `(app)/page.tsx` still serves at `/`). This is the standard Next.js
 * pattern for one shared layout across several routes with no path segment
 * added — not a custom higher-order-component wrapper.
 *
 * Resolves the actor via `getCurrentActor()` — not `requireAdmin`/
 * `requireRole`, since the shell is shared across every role. Follows
 * `usuarios/page.tsx`'s exact existing pattern for resolving
 * `CurrentActorRequest` from `headers()` and its exact `catch` pattern: an
 * `AppError` with `status === 401` (no session / inactive user) redirects to
 * `/sign-in`. The shell does NOT handle 403 — it imposes no role
 * restriction of its own; a nested page (like `/usuarios`) still enforces
 * its OWN role gate exactly as it does today, unchanged (AC 4).
 *
 * Breakpoint: desktop/tablet (>= Tailwind's `md`, 768px) gets the full,
 * always-visible sidebar (`Sidebar`'s `hidden md:flex`); phone (< 768px)
 * gets the off-canvas drawer (`NavDrawer`, composed inside `Topbar`). No
 * exact px value is pinned by any project document — this is epics.md's own
 * two-state AC, not `EXPERIENCE.md`'s optional three-tier/icon-collapsed
 * tablet variant (out of scope, see this story's Dev Notes).
 *
 * This layout and any nested page (e.g. `(app)/page.tsx`) each
 * independently call `getCurrentActor()` — Next.js Server Components don't
 * pass data from a layout down to its nested page via props (a layout only
 * receives `children`), so this is the established, correct pattern in this
 * codebase, not duplication to eliminate.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UNRESOLVED_TENANT } from "@/middleware";
import { AppError } from "@/shared/http/errors";
import {
  getCurrentActor,
  type Actor,
} from "@/modules/auth/server/get-current-actor";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

async function resolveShellActor(): Promise<Actor> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) notFound();
  const requestId = requestHeaders.get("x-request-id") ?? randomUUID();

  try {
    return await getCurrentActor(
      { headers: requestHeaders, tenantId, requestId },
      async (actor) => actor,
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/sign-in");
    throw error;
  }
}

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const actor = await resolveShellActor();

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar role={actor.role} className="hidden md:flex" />
      <div className="flex flex-1 flex-col">
        <Topbar role={actor.role} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
