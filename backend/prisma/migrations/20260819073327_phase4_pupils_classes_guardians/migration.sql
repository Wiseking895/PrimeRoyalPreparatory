-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PupilStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pupil_guardians" (
    "pupilId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pupil_guardians_pkey" PRIMARY KEY ("pupilId","guardianId")
);

-- CreateTable
CREATE TABLE "pupils" (
    "id" TEXT NOT NULL,
    "pupilId" TEXT NOT NULL,
    "admissionNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "profilePictureUrl" TEXT,
    "classId" TEXT NOT NULL,
    "dateAdmitted" TIMESTAMP(3) NOT NULL,
    "status" "PupilStatus" NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pupils_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classes_key_key" ON "classes"("key");

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");

-- CreateIndex
CREATE INDEX "classes_status_idx" ON "classes"("status");

-- CreateIndex
CREATE INDEX "classes_sortOrder_idx" ON "classes"("sortOrder");

-- CreateIndex
CREATE INDEX "guardians_email_idx" ON "guardians"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pupils_pupilId_key" ON "pupils"("pupilId");

-- CreateIndex
CREATE UNIQUE INDEX "pupils_admissionNumber_key" ON "pupils"("admissionNumber");

-- CreateIndex
CREATE INDEX "pupils_status_idx" ON "pupils"("status");

-- CreateIndex
CREATE INDEX "pupils_classId_idx" ON "pupils"("classId");

-- CreateIndex
CREATE INDEX "pupils_firstName_idx" ON "pupils"("firstName");

-- CreateIndex
CREATE INDEX "pupils_lastName_idx" ON "pupils"("lastName");

-- CreateIndex
CREATE INDEX "pupils_dateAdmitted_idx" ON "pupils"("dateAdmitted");

-- CreateIndex
CREATE INDEX "pupils_createdAt_idx" ON "pupils"("createdAt");

-- AddForeignKey
ALTER TABLE "pupil_guardians" ADD CONSTRAINT "pupil_guardians_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "pupils"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pupil_guardians" ADD CONSTRAINT "pupil_guardians_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pupils" ADD CONSTRAINT "pupils_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
