-- Add object-storage document metadata (Cloudflare R2).
--
-- PostgreSQL stays the source of truth: every object in the private R2 bucket
-- gets exactly one row here describing what it is, who it belongs to, its
-- SHA-256 integrity hash and its lifecycle status. Only the object KEY is
-- stored — presigned URLs are short-lived and never persisted.
--
-- Purely additive: two new enums, one new table, no changes to existing
-- tables, columns or constraints, and no data is modified or deleted.

-- CreateEnum
CREATE TYPE "StoredDocumentType" AS ENUM ('ADMISSION_FORM', 'PROFILE_PHOTO');

-- CreateEnum
CREATE TYPE "StoredDocumentStatus" AS ENUM ('UPLOADING', 'AVAILABLE', 'FAILED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "stored_documents" (
    "id" TEXT NOT NULL,
    "documentType" "StoredDocumentType" NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'r2',
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "StoredDocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "pupilId" TEXT,
    "userId" TEXT,
    "academicYearId" TEXT,
    "termId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_documents_storageKey_key" ON "stored_documents"("storageKey");

-- CreateIndex
CREATE INDEX "stored_documents_documentType_pupilId_idx" ON "stored_documents"("documentType", "pupilId");

-- CreateIndex
CREATE INDEX "stored_documents_pupilId_idx" ON "stored_documents"("pupilId");

-- CreateIndex
CREATE INDEX "stored_documents_userId_idx" ON "stored_documents"("userId");

-- CreateIndex
CREATE INDEX "stored_documents_status_idx" ON "stored_documents"("status");

-- CreateIndex
CREATE INDEX "stored_documents_createdAt_idx" ON "stored_documents"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stored_documents_documentType_pupilId_academicYearId_sha256_key" ON "stored_documents"("documentType", "pupilId", "academicYearId", "sha256", "status");

-- AddForeignKey
ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "pupils"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
