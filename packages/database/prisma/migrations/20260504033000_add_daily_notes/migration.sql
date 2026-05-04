-- CreateTable
CREATE TABLE "daily_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_notes_userId_workDate_key" ON "daily_notes"("userId", "workDate");

-- CreateIndex
CREATE INDEX "daily_notes_userId_idx" ON "daily_notes"("userId");

-- AddForeignKey
ALTER TABLE "daily_notes" ADD CONSTRAINT "daily_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
