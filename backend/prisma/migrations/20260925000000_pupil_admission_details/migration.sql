-- Pupil admission details (admission form + Word import):
--   * sheet number and one-time admission fee on the pupil record
--   * five admission uniform collection items (one row per slot per pupil)
-- Existing columns, tables and indexes are untouched; all new columns are
-- nullable / defaulted so every existing pupil row stays valid.

-- CreateEnum
CREATE TYPE "UniformCollectionStatus" AS ENUM ('NOT_COLLECTED', 'COLLECTED');

-- AlterTable
ALTER TABLE "pupils" ADD COLUMN "admissionFee" DECIMAL(12,2),
ADD COLUMN "sheetNumber" TEXT;

-- CreateTable
CREATE TABLE "pupil_uniforms" (
    "id" TEXT NOT NULL,
    "pupilId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "label" TEXT,
    "status" "UniformCollectionStatus" NOT NULL DEFAULT 'NOT_COLLECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pupil_uniforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pupil_uniforms_pupilId_idx" ON "pupil_uniforms"("pupilId");

-- CreateIndex
CREATE UNIQUE INDEX "pupil_uniforms_pupilId_slot_key" ON "pupil_uniforms"("pupilId", "slot");

-- AddForeignKey
ALTER TABLE "pupil_uniforms" ADD CONSTRAINT "pupil_uniforms_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "pupils"("id") ON DELETE CASCADE ON UPDATE CASCADE;
