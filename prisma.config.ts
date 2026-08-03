import { loadEnvConfig } from "@next/env";

// Prisma 7 no longer auto-loads `.env` files. Load env vars BEFORE anything
// below reads `process.env`, or every Prisma CLI command (migrate, generate,
// studio) fails with P1010 "denied access" against Neon. See ARCHITECTURE-SPINE.md
// AD-2 and design.md "P1010 Mitigations".
loadEnvConfig(process.cwd());

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations and introspection run as the owner/migration role, never the
    // pooled app role `quimia_app` created by the rls_roles migration (AD-2, D10).
    url: env("DIRECT_DATABASE_URL"),
  },
});
