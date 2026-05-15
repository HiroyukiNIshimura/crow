-- CreateTable
CREATE TABLE "monthly_work_standards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "hoursPerDay" DOUBLE PRECISION NOT NULL,
    "workDaysInMonth" INTEGER,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_work_standards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_work_standards_userId_year_idx" ON "monthly_work_standards"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_work_standards_userId_year_month_key" ON "monthly_work_standards"("userId", "year", "month");

-- AddForeignKey
ALTER TABLE "monthly_work_standards" ADD CONSTRAINT "monthly_work_standards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
