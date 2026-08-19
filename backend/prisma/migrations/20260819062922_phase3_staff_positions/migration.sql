-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "position" TEXT;

-- CreateIndex
CREATE INDEX "staff_profiles_position_idx" ON "staff_profiles"("position");
