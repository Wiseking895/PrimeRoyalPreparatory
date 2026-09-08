-- AlterTable: Add admission fields to Pupil
ALTER TABLE "pupils" ADD COLUMN "nationality" TEXT,
ADD COLUMN "religion" TEXT,
ADD COLUMN "admissionReason" TEXT,
ADD COLUMN "declarationAcknowledged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add occupation to Guardian
ALTER TABLE "guardians" ADD COLUMN "occupation" TEXT;
