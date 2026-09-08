-- CreateEnum
CREATE TYPE "WorkOutputReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'CONFIRMED');

-- AlterTable: Add review/grading columns to work_output_records
ALTER TABLE "work_output_records" ADD COLUMN "reviewStatus" "WorkOutputReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "work_output_records" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "work_output_records" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "work_output_records" ADD COLUMN "score" DECIMAL(3,1);
ALTER TABLE "work_output_records" ADD COLUMN "classification" TEXT;
ALTER TABLE "work_output_records" ADD COLUMN "feedback" TEXT;

-- CreateIndex
CREATE INDEX "work_output_records_reviewStatus_idx" ON "work_output_records"("reviewStatus");

-- AddForeignKey
ALTER TABLE "work_output_records" ADD CONSTRAINT "work_output_records_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
