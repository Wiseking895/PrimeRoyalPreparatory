-- CreateEnum
CREATE TYPE "FeeAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXEMPT');

-- AlterTable: Change fee_assignments.status to use new enum
-- First backfill any existing data to ensure consistency
ALTER TABLE "fee_assignments" ALTER COLUMN "status" DROP DEFAULT;

-- AlterColumn: change type from AccountStatus to FeeAssignmentStatus
ALTER TABLE "fee_assignments" ALTER COLUMN "status" TYPE "FeeAssignmentStatus" USING (
  CASE "status"::text
    WHEN 'ACTIVE' THEN 'ACTIVE'::"FeeAssignmentStatus"
    WHEN 'INACTIVE' THEN 'INACTIVE'::"FeeAssignmentStatus"
    ELSE 'ACTIVE'::"FeeAssignmentStatus"
  END
);

-- Set default
ALTER TABLE "fee_assignments" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
