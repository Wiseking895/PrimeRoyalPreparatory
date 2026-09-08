-- CreateEnum
CREATE TYPE "WorkOutputType" AS ENUM ('EXERCISE', 'QUIZ', 'HOMEWORK', 'MIDTERM_EXAM');

-- CreateTable
CREATE TABLE "work_output_records" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "workType" "WorkOutputType" NOT NULL,
    "title" TEXT,
    "dateGiven" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_output_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_output_records_teacherId_idx" ON "work_output_records"("teacherId");

-- CreateIndex
CREATE INDEX "work_output_records_subjectId_idx" ON "work_output_records"("subjectId");

-- CreateIndex
CREATE INDEX "work_output_records_classId_idx" ON "work_output_records"("classId");

-- CreateIndex
CREATE INDEX "work_output_records_termId_idx" ON "work_output_records"("termId");

-- CreateIndex
CREATE INDEX "work_output_records_weekNumber_idx" ON "work_output_records"("weekNumber");

-- CreateIndex
CREATE INDEX "work_output_records_workType_idx" ON "work_output_records"("workType");

-- AddForeignKey
ALTER TABLE "work_output_records" ADD CONSTRAINT "work_output_records_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_output_records" ADD CONSTRAINT "work_output_records_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_output_records" ADD CONSTRAINT "work_output_records_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_output_records" ADD CONSTRAINT "work_output_records_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
