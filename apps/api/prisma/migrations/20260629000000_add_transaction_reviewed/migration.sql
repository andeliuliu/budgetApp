-- AlterTable: add reviewed flag (pending vs. triaged). Existing rows default to
-- unreviewed (so today's "other" pile becomes triageable)...
ALTER TABLE "transactions" ADD COLUMN "reviewed" BOOLEAN NOT NULL DEFAULT false;

-- ...except transfers, which are noise the user shouldn't have to triage.
UPDATE "transactions" SET "reviewed" = true WHERE "is_transfer" = true;
