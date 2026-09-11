-- CreateTable
CREATE TABLE "daily_reconciliation_closes" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "daily_reconciliation_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_reconciliation_closes_date_key" ON "daily_reconciliation_closes"("date");

-- CreateIndex
CREATE INDEX "daily_reconciliation_closes_date_idx" ON "daily_reconciliation_closes"("date");

-- CreateIndex
CREATE INDEX "daily_reconciliation_closes_sessionId_termId_idx" ON "daily_reconciliation_closes"("sessionId", "termId");

-- AddForeignKey
ALTER TABLE "daily_reconciliation_closes" ADD CONSTRAINT "daily_reconciliation_closes_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reconciliation_closes" ADD CONSTRAINT "daily_reconciliation_closes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reconciliation_closes" ADD CONSTRAINT "daily_reconciliation_closes_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
