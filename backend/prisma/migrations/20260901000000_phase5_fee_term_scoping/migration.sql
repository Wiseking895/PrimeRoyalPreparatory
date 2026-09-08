-- AlterTable: Add termId to finance_fees (nullable first for safe backfill)
ALTER TABLE "finance_fees" ADD COLUMN "termId" TEXT;

-- Backfill: For each existing fee, assign the first ACTIVE term of its session.
-- If no active term exists, use the first term (by termNumber) of the session.
UPDATE "finance_fees" f
SET "termId" = (
  SELECT t."id"
  FROM "academic_terms" t
  WHERE t."sessionId" = f."sessionId"
  ORDER BY
    CASE WHEN t."status" = 'ACTIVE' THEN 0 ELSE 1 END,
    t."termNumber" ASC
  LIMIT 1
)
WHERE f."termId" IS NULL;

-- If any fees still have NULL termId (session has no terms at all), create a
-- placeholder term for each such session so the NOT NULL constraint holds.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT f."sessionId"
    FROM "finance_fees" f
    WHERE f."termId" IS NULL
  LOOP
    INSERT INTO "academic_terms" ("id", "sessionId", "name", "termNumber", "startDate", "endDate", "schoolDays", "status", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      rec."sessionId",
      'Default Term',
      1,
      NOW(),
      NOW(),
      0,
      'ACTIVE',
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING;

    UPDATE "finance_fees" f
    SET "termId" = (
      SELECT t."id" FROM "academic_terms" t
      WHERE t."sessionId" = rec."sessionId"
      ORDER BY t."termNumber" ASC LIMIT 1
    )
    WHERE f."sessionId" = rec."sessionId" AND f."termId" IS NULL;
  END LOOP;
END $$;

-- Now make termId NOT NULL
ALTER TABLE "finance_fees" ALTER COLUMN "termId" SET NOT NULL;

-- Drop the old unique constraint
ALTER TABLE "finance_fees" DROP CONSTRAINT "finance_fees_sessionId_name_key";

-- Add the new unique constraint including termId
ALTER TABLE "finance_fees" ADD CONSTRAINT "finance_fees_sessionId_termId_name_key" UNIQUE ("sessionId", "termId", "name");

-- Add foreign key
ALTER TABLE "finance_fees" ADD CONSTRAINT "finance_fees_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index for termId
CREATE INDEX "finance_fees_termId_idx" ON "finance_fees"("termId");
