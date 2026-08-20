-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_assignments" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_teachers" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sba_records" (
    "id" TEXT NOT NULL,
    "pupilId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sba_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE INDEX "subjects_status_idx" ON "subjects"("status");

-- CreateIndex
CREATE INDEX "teaching_assignments_teacherId_idx" ON "teaching_assignments"("teacherId");

-- CreateIndex
CREATE INDEX "teaching_assignments_subjectId_idx" ON "teaching_assignments"("subjectId");

-- CreateIndex
CREATE INDEX "teaching_assignments_classId_idx" ON "teaching_assignments"("classId");

-- CreateIndex
CREATE INDEX "teaching_assignments_status_idx" ON "teaching_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_assignments_teacherId_subjectId_classId_key" ON "teaching_assignments"("teacherId", "subjectId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "class_teachers_classId_key" ON "class_teachers"("classId");

-- CreateIndex
CREATE INDEX "class_teachers_teacherId_idx" ON "class_teachers"("teacherId");

-- CreateIndex
CREATE INDEX "class_teachers_classId_idx" ON "class_teachers"("classId");

-- CreateIndex
CREATE INDEX "sba_records_pupilId_idx" ON "sba_records"("pupilId");

-- CreateIndex
CREATE INDEX "sba_records_subjectId_idx" ON "sba_records"("subjectId");

-- CreateIndex
CREATE INDEX "sba_records_classId_idx" ON "sba_records"("classId");

-- CreateIndex
CREATE INDEX "sba_records_termId_idx" ON "sba_records"("termId");

-- CreateIndex
CREATE INDEX "sba_records_teacherId_idx" ON "sba_records"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "sba_records_pupilId_subjectId_classId_termId_key" ON "sba_records"("pupilId", "subjectId", "classId", "termId");

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sba_records" ADD CONSTRAINT "sba_records_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "pupils"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sba_records" ADD CONSTRAINT "sba_records_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sba_records" ADD CONSTRAINT "sba_records_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sba_records" ADD CONSTRAINT "sba_records_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sba_records" ADD CONSTRAINT "sba_records_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
