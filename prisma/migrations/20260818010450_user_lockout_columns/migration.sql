-- Story 1.4 Task 3 (AC 2): plain ALTER TABLE, not the rls_roles/AuditLog
-- ceremony. `user` already has FORCE ROW LEVEL SECURITY and `quimia_app`
-- already holds GRANT SELECT, INSERT, UPDATE, DELETE on "user" (see
-- prisma/migrations/20260803061701_rls_roles/migration.sql) -- adding
-- columns to an already-RLS'd, already-granted table needs no new policy
-- and no new grant. Verified via `prisma migrate diff --from-config-datasource
-- --to-schema prisma/schema.prisma --script`: the only statements this
-- change produces are the two ADD COLUMNs below -- no RLS/grant statements
-- were dropped or altered.
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
