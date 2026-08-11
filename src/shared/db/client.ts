/**
 * Module-private base Prisma client (design.md "Wrapper API" — `client.ts`
 * is never re-exported from `index.ts`, the sole export surface). Every
 * other file in `src/shared/db` imports `base` from here; nothing outside
 * this directory may import it (ESLint boundary, AD-3).
 *
 * Import order guards P1010 (design.md "P1010 Mitigations"): `env` is
 * imported before `PrismaClient` is instantiated below, so `env.DATABASE_URL`
 * is validated — and `.env` is loaded, transitively, by whichever entrypoint
 * imported `env` first — before the adapter ever opens a connection.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";
import { PrismaClient } from "../../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const base = new PrismaClient({ adapter });
