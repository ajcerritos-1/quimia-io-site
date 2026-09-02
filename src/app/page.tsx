/**
 * Public landing page, served at `/` for ANY host — the bare root domain,
 * an unknown subdomain, any tenant's subdomain, with or without a session.
 * It is public BY CHOICE: it never calls `resolveActor()` and never reads
 * tenant context, so it renders unconditionally — the tenant model itself
 * is untouched (the workspace stays protected and tenant-scoped at
 * `/inicio`, inside the `(app)` shell, which still resolves the actor).
 *
 * Replaces the old shell home at `/` (Story 1.5 Task 8), which moved to
 * `(app)/inicio/page.tsx` unchanged. Professional Spanish voice
 * (`UX-DR22`/NFR-9), branded via the shared `APP_NAME` constant
 * (`src/components/shell/brand.ts`). Clean and static — no images, plain
 * `globals.css`/Tailwind tokens only.
 */
import Link from "next/link";
import { APP_NAME } from "@/components/shell/brand";
import { env } from "@/shared/config/env";

/**
 * Sign-in target for the landing CTA. Falls back to the relative `/sign-in`,
 * which is correct for local dev and the e2e suite (tenant subdomains like
 * `{slug}.localhost:3100` resolve the tenant fine). On a deployed preview or
 * production, set `SIGN_IN_URL` to the client's tenant host — e.g.
 * `https://liticc.dev.quimiaio.com/sign-in` — because the bare-root
 * `/sign-in` can never complete a sign-in (no tenant slug on the apex host).
 */
const SIGN_IN_HREF = env.SIGN_IN_URL ?? "/sign-in";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 p-8 text-center">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground">
          Plataforma de gestión multi-tenant para clínicas y laboratorios.
        </p>
      </header>

      <ul className="mx-auto flex max-w-xl list-disc flex-col gap-3 pl-5 text-left text-sm text-muted-foreground">
        <li>
          Espacios de trabajo aislados por organización: cada clínica o
          laboratorio opera únicamente sobre sus propios datos.
        </li>
        <li>
          Gestión centralizada de usuarios, roles y accesos en cada tenant.
        </li>
        <li>
          Trazabilidad y auditoría de las operaciones sensibles de tu
          organización.
        </li>
      </ul>

      <Link
        href={SIGN_IN_HREF}
        className="rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Iniciar sesión
      </Link>
    </div>
  );
}