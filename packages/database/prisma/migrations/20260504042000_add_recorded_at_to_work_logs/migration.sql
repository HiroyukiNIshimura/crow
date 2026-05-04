-- AlterTable
ALTER TABLE "work_logs" ADD COLUMN "recordedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "work_logs_recordedAt_idx" ON "work_logs"("recordedAt");
