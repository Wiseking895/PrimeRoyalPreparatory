-- Phase 8 corrective migration: reconcile GPS staff attendance schema
--
-- This migration reconciles the differences between the original Phase 8
-- attendance migration (20260820170553) and the final verified schema.prisma.
--
-- The attendance table stores TWO types of records:
--   A. Pupil attendance (pupilId IS NOT NULL)
--   B. Staff GPS check-in (pupilId IS NULL)
--
-- Uniqueness rules:
--   A. Pupil attendance: UNIQUE(pupilId, date, staffId)
--      — one record per pupil/date/staff combination
--   B. Staff GPS check-in: UNIQUE(staffId, date) WHERE pupilId IS NULL
--      — only one staff check-in per staff per day
--
-- All operations are idempotent and safe to re-run.

-- A. Add GPS columns as nullable (idempotent — skip if already exist)
DO $$ BEGIN
  ALTER TABLE "attendance" ADD COLUMN "latitude" NUMERIC(10,7);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance" ADD COLUMN "longitude" NUMERIC(10,7);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance" ADD COLUMN "accuracy" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance" ADD COLUMN "capturedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- B. Make pupilId nullable (idempotent — safe to run even if already nullable)
ALTER TABLE "attendance" ALTER COLUMN "pupilId" DROP NOT NULL;

-- C. Drop the erroneous global UNIQUE(staffId, date) if it exists
DROP INDEX IF EXISTS "attendance_staffId_date_key";

-- D. Restore UNIQUE(pupilId, date, staffId) for pupil attendance uniqueness
-- In PostgreSQL, NULL values are considered distinct for unique constraints,
-- so this does NOT prevent staff check-in rows (pupilId = NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_pupilId_date_staffId_key"
  ON "attendance" ("pupilId", "date", "staffId");

-- E. Add partial UNIQUE(staffId, date) WHERE pupilId IS NULL for staff check-ins
-- This ensures only one staff GPS check-in per staff per day,
-- without affecting pupil attendance rows.
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_staffId_date_staff_checkin_key"
  ON "attendance" ("staffId", "date")
  WHERE "pupilId" IS NULL;

-- F. Change pupilId FK: CASCADE → SET NULL (idempotent)
DO $$ BEGIN
  ALTER TABLE "attendance" DROP CONSTRAINT "attendance_pupilId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_pupilId_fkey"
  FOREIGN KEY ("pupilId") REFERENCES "pupils"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- G. Change staffId FK: SET NULL → RESTRICT (idempotent)
DO $$ BEGIN
  ALTER TABLE "attendance" DROP CONSTRAINT "attendance_staffId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- H. Ensure erroneous single-column UNIQUE(staffId) does not exist
DROP INDEX IF EXISTS "attendance_staffId_key";
