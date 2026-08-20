-- AlterTable
ALTER TABLE "guardians" ADD COLUMN "accountEmail" TEXT,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'INACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "guardians_accountEmail_key" ON "guardians"("accountEmail");

-- CreateIndex
CREATE INDEX "guardians_createdByUserId_idx" ON "guardians"("createdByUserId");

-- CreateIndex
CREATE INDEX "guardians_status_idx" ON "guardians"("status");

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;